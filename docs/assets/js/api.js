/**
 * api.js
 * -----------------------------------------------------------------------------
 * All network / data access lives here. Nothing else fetches.
 *
 * REAL-TIME ONLY — never stale:
 *   The dashboard must always reflect the very latest committed content. To
 *   guarantee that, this layer:
 *     1. Fetches through the GitHub **Contents API** with the
 *        `Accept: application/vnd.github.raw` header. The Contents API returns
 *        the live file straight from Git, so it is NOT subject to the multi-
 *        minute CDN caching that affects raw.githubusercontent.com.
 *     2. Falls back to `raw.githubusercontent.com` (with a unique cache-buster
 *        and no-store) only if the Contents API is unavailable.
 *     3. Sends `cache: 'no-store'` and a unique `?t=<timestamp>` on EVERY
 *        request so neither the browser nor any CDN can serve old data.
 *     4. Keeps NO persistent success cache. (A tiny in-flight de-dupe map only
 *        coalesces identical concurrent requests within the same render pass;
 *        it is cleared as soon as each request settles.)
 *   If the network is down or the latest data cannot be retrieved, the fetch
 *   throws and callers render a loading/error state — never stale content.
 *
 * IMPORTANT repo-structure note:
 *   countries.json entries look like:
 *     { "id": "pk", "name": "Pakistan", "file": "pakistan/operators.json" }
 *   The country *id* ("pk") is NOT the folder name ("pakistan"). We derive the
 *   base path from the `file` field instead.
 */

import { getToken } from './github.js';

const OWNER = 'smkgethubpro';
const REPO = 'sims';
const BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const CONTENTS_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

// In-flight de-dupe only. Maps path -> Promise while a request is pending so
// that the same file requested twice concurrently (e.g. during one render)
// shares a single network round-trip. Entries are deleted the moment the
// request settles, so nothing is ever cached across user actions.
const inFlight = new Map();

/** A unique token per request to defeat browser/CDN caching. */
function bustParam() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Encode a repo path for a URL, preserving the slashes between segments. */
function encodePath(path) {
  return String(path)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Fetch a file's text via the GitHub Contents API (live, never CDN-cached). */
async function fetchViaApi(path) {
  const url = `${CONTENTS_API}/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}&t=${bustParam()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: authHeaders({ Accept: 'application/vnd.github.raw' }),
  });
  if (res.ok) return { text: await res.text() };
  const err = new Error(`Contents API ${res.status} for ${path}`);
  err.status = res.status;
  err.path = path;
  throw err;
}

/** Fetch a file's text via the raw host with a unique cache-buster. */
async function fetchViaRaw(path) {
  const res = await fetch(`${RAW_BASE}/${encodePath(path)}?t=${bustParam()}`, { cache: 'no-store' });
  if (res.ok) return { text: await res.text() };
  const err = new Error(`Failed to load ${path} (HTTP ${res.status})`);
  err.status = res.status;
  err.path = path;
  throw err;
}

/**
 * Fetch raw file text for `path`, always real-time.
 *
 * Strategy:
 *   - With a token (auto-save users): use the Contents API first — it returns
 *     the live committed file (never CDN-stale) and has a 5000/hr rate limit.
 *     Fall back to raw+cache-buster if the API hiccups.
 *   - Without a token: use raw+cache-buster first (the unique ?t= defeats the
 *     CDN cache and there's no 60/hr API limit to exhaust), and only fall back
 *     to the unauthenticated Contents API if raw itself fails.
 *
 * A genuine 404 (missing file) is surfaced immediately and never masked.
 * Returns { text } or throws an Error with `.status` set.
 */
async function fetchText(path) {
  const primary = getToken() ? fetchViaApi : fetchViaRaw;
  const secondary = getToken() ? fetchViaRaw : fetchViaApi;

  try {
    return await primary(path);
  } catch (e1) {
    if (e1.status === 404) throw e1;
    try {
      return await secondary(path);
    } catch (e2) {
      // Surface a definite 404 from the secondary; otherwise report the
      // primary error so the caller can show a clear loading/error state.
      if (e2.status === 404) throw e2;
      throw e1;
    }
  }
}

/** Low-level JSON fetch — always real-time, never cached across actions. */
async function fetchJson(path) {
  if (inFlight.has(path)) return inFlight.get(path);

  const promise = (async () => {
    const { text } = await fetchText(path);
    try {
      return JSON.parse(text);
    } catch (e) {
      const err = new Error(`Invalid JSON in ${path}: ${e.message}`);
      err.path = path;
      err.parseError = true;
      throw err;
    }
  })();

  inFlight.set(path, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(path);
  }
}

/** Returns true if a path exists right now (real-time). */
async function pathExists(path) {
  try {
    await fetchText(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * No-op kept for backwards compatibility: there is no persistent cache to
 * clear anymore (every read is already real-time).
 */
export function clearCache() {
  inFlight.clear();
}

/**
 * Kept for backwards compatibility with the Refresh button. Since reads are
 * already real-time, this just drops any in-flight de-dupe entries so the next
 * reads start fresh.
 */
export function hardRefresh() {
  inFlight.clear();
}

/**
 * Derive the country's folder base (e.g. "pakistan") from its `file` field
 * (e.g. "pakistan/operators.json"). Falls back to id only as a last resort.
 */
export function countryBasePath(country) {
  if (country && country.file) {
    return country.file.replace(/\/operators\.json$/i, '').replace(/\/+$/, '');
  }
  return country ? country.id : '';
}

/**
 * List the top-level directories that actually exist in the repo (one request
 * via the GitHub contents API). Used by statistics so we only scan countries
 * whose folder is really present — avoiding ~195 guaranteed 404s on load.
 * Returns a Set of folder names, or null if the API is unavailable (rate
 * limited / offline), letting callers fall back gracefully. Always real-time.
 */
export async function getRepoTopFolders() {
  try {
    const url = `${CONTENTS_API}?ref=${encodeURIComponent(BRANCH)}&t=${bustParam()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: authHeaders({ Accept: 'application/vnd.github+json' }),
    });
    if (!res.ok) return null;
    const items = await res.json();
    return new Set(
      (Array.isArray(items) ? items : [])
        .filter((i) => i.type === 'dir')
        .map((i) => i.name)
    );
  } catch {
    return null;
  }
}

/* ------------------------------- public API ------------------------------- */

export async function getCountries() {
  const data = await fetchJson('countries.json');
  return Array.isArray(data.countries) ? data.countries : [];
}

/**
 * Load operators for a country. Returns { operators, exists }.
 * `exists` is false when the country folder/operators.json is missing — used
 * to surface the "country listed but folder missing" warning.
 */
export async function getOperators(country) {
  const base = countryBasePath(country);
  const path = `${base}/operators.json`;
  try {
    const data = await fetchJson(path);
    return { operators: Array.isArray(data.operators) ? data.operators : [], exists: true, base };
  } catch (e) {
    if (e.status === 404) return { operators: [], exists: false, base, error: e };
    throw e;
  }
}

export async function getCategories(country, operator) {
  const base = countryBasePath(country);
  const folder = operator.folder || operator.id;
  const path = `${base}/${folder}/categories.json`;
  try {
    const data = await fetchJson(path);
    return { categories: Array.isArray(data.categories) ? data.categories : [], exists: true };
  } catch (e) {
    if (e.status === 404) return { categories: [], exists: false, error: e };
    throw e;
  }
}

/**
 * Load a category's raw file. Returns { raw, file, exists, error }.
 */
export async function getCategoryFile(country, operator, category) {
  const base = countryBasePath(country);
  const folder = operator.folder || operator.id;
  const file = category.file || `${category.id}.json`;
  const path = `${base}/${folder}/${file}`;
  try {
    const raw = await fetchJson(path);
    return { raw, file: path, exists: true };
  } catch (e) {
    if (e.status === 404) return { raw: null, file: path, exists: false, error: e };
    return { raw: null, file: path, exists: false, error: e, parseError: e.parseError };
  }
}

export { pathExists };
