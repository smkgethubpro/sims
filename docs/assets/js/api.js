/**
 * api.js
 * -----------------------------------------------------------------------------
 * All network / data access lives here. Nothing else fetches.
 *
 * Reads from the raw GitHub content of the repository so the dashboard works
 * unchanged on GitHub Pages (static, no backend).
 *
 * IMPORTANT repo-structure note:
 *   countries.json entries look like:
 *     { "id": "pk", "name": "Pakistan", "file": "pakistan/operators.json" }
 *   The country *id* ("pk") is NOT the folder name ("pakistan"). The previous
 *   app wrongly fetched `${id}/operators.json` which 404s. We derive the base
 *   path from the `file` field instead.
 */

const RAW_BASE = 'https://raw.githubusercontent.com/smkgethubpro/sims/main';
const API_BASE = 'https://api.github.com/repos/smkgethubpro/sims/contents';

const cache = new Map();

function cacheKey(path) {
  return path;
}

/** Low-level JSON fetch with caching. Throws on non-OK. */
async function fetchJson(path) {
  const key = cacheKey(path);
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(`${RAW_BASE}/${path}`, { cache: 'no-cache' });
  if (!res.ok) {
    const err = new Error(`Failed to load ${path} (HTTP ${res.status})`);
    err.status = res.status;
    err.path = path;
    throw err;
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const err = new Error(`Invalid JSON in ${path}: ${e.message}`);
    err.path = path;
    err.parseError = true;
    throw err;
  }
  cache.set(key, data);
  return data;
}

/** Returns true if a path exists (HEAD-ish GET, cached negative/positive). */
async function pathExists(path) {
  const key = `exists:${path}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(`${RAW_BASE}/${path}`, { cache: 'no-cache' });
    const ok = res.ok;
    cache.set(key, ok);
    return ok;
  } catch {
    cache.set(key, false);
    return false;
  }
}

/** Clear cached entries (used after a refresh). */
export function clearCache() {
  cache.clear();
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
 * limited / offline), letting callers fall back gracefully.
 */
export async function getRepoTopFolders() {
  const key = 'repo:topfolders';
  if (cache.has(key)) return cache.get(key);
  try {
    const res = await fetch(API_BASE, { cache: 'no-cache' });
    if (!res.ok) { cache.set(key, null); return null; }
    const items = await res.json();
    const folders = new Set(
      (Array.isArray(items) ? items : [])
        .filter((i) => i.type === 'dir')
        .map((i) => i.name)
    );
    cache.set(key, folders);
    return folders;
  } catch {
    cache.set(key, null);
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
