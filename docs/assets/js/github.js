/**
 * github.js
 * -----------------------------------------------------------------------------
 * GitHub Contents API write layer.
 *
 * The dashboard is a static GitHub Pages site (no backend). To let it commit
 * changes directly, the user pastes a GitHub Personal Access Token (repo scope)
 * via the ⚙ Settings modal. The token is stored in localStorage.
 *
 * When a token is present, every write operation funnels through `autoCommit`,
 * which:
 *   - GETs an existing file to read its `sha`, then PUTs with that sha (update)
 *   - PUTs without a sha to create a brand-new file (create)
 *
 * If no token is set, callers fall back to the copy-paste "save instructions"
 * flow, so the app keeps working exactly as before.
 *
 * No external libraries — only `fetch`, `btoa`, and TextEncoder for UTF-8 safe
 * base64 encoding of file contents.
 */

const OWNER = 'smkgethubpro';
const REPO = 'sims';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

const TOKEN_KEY = 'sims_gh_token';

/* ------------------------------ token storage ----------------------------- */

/** Read the stored Personal Access Token (or '' when not set). */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

/** Persist (or clear) the Personal Access Token in localStorage. */
export function setToken(token) {
  try {
    const t = (token || '').trim();
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** True when a token is present (auto-commit is possible). */
export function hasToken() {
  return getToken().length > 0;
}

/* ------------------------------ helpers ----------------------------------- */

/** UTF-8 safe base64 encode (handles non-ASCII content correctly). */
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Fetch the current sha for a file path, or null if it does not exist (404).
 * Throws on auth / network / other errors so callers can surface them.
 */
export async function getFileSha(path) {
  const url = `${API}/${encodeURIPath(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-cache' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await toError(res, `GET ${path}`);
  }
  const data = await res.json();
  return data && data.sha ? data.sha : null;
}

/**
 * Create or update a single file via the Contents API.
 * @param {object} opts
 * @param {string} opts.path     repo-relative path (e.g. pakistan/jazz/data.json)
 * @param {string} opts.content  raw text content (will be base64-encoded)
 * @param {string} opts.message  commit message
 * @param {string|null} [opts.sha] existing sha (omit/null to create)
 */
export async function putFile({ path, content, message, sha = null }) {
  const body = {
    message: message || `Update ${path}`,
    content: toBase64(content),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/${encodeURIPath(path)}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await toError(res, `PUT ${path}`);
  }
  return res.json();
}

/**
 * Delete a file via the Contents API. Requires the file's current sha, which we
 * look up first. If the file does not exist (404), this is a no-op.
 * @param {object} opts
 * @param {string} opts.path
 * @param {string} opts.message
 */
export async function deleteFile({ path, message }) {
  const sha = await getFileSha(path);
  if (!sha) return null; // already gone

  const res = await fetch(`${API}/${encodeURIPath(path)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || `Delete ${path}`, sha, branch: BRANCH }),
  });
  if (!res.ok) {
    throw await toError(res, `DELETE ${path}`);
  }
  return res.json();
}

/**
 * Commit a batch of files. Each file is { path, json, isNew, delete }.
 *   - delete === true → remove the file (DELETE; no-op if it doesn't exist)
 *   - isNew === true  → create (PUT without sha)
 *   - otherwise        → update: GET sha first, then PUT with that sha.
 *     (If the file turns out not to exist, we create it instead.)
 *
 * Files are committed sequentially so order is deterministic (e.g. update
 * operators.json before creating the operator's nested files).
 *
 * @param {Array<{path:string, json?:string, isNew?:boolean, delete?:boolean}>} files
 * @param {string} title  used to build commit messages
 * @returns {Promise<{committed:number}>}
 * @throws on the first failed file so the caller can fall back gracefully.
 */
export async function autoCommitFiles(files, title) {
  let committed = 0;
  for (const f of files) {
    if (f.delete) {
      await deleteFile({ path: f.path, message: commitMessage(title, f.path) });
      committed += 1;
      continue;
    }
    // Determine sha: for "update" files, look up the current sha. For "new"
    // files, skip the lookup but still tolerate the case where it already
    // exists (then we need its sha to avoid a 422).
    let sha = null;
    if (f.isNew) {
      // Brand-new file: try to create without sha, but if GitHub reports it
      // already exists, fetch the sha and retry as an update.
      try {
        await putFile({ path: f.path, content: f.json, message: commitMessage(title, f.path) });
        committed += 1;
        continue;
      } catch (e) {
        if (e.status === 422) {
          sha = await getFileSha(f.path);
        } else {
          throw e;
        }
      }
    } else {
      sha = await getFileSha(f.path);
    }
    await putFile({ path: f.path, content: f.json, message: commitMessage(title, f.path), sha });
    committed += 1;
  }
  return { committed };
}

function commitMessage(title, path) {
  const base = (title || 'Update').replace(/\s+/g, ' ').trim();
  return `${base} — ${path}`;
}

/** Encode a repo path for a URL while keeping the slashes between segments. */
function encodeURIPath(path) {
  return String(path)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** Build a descriptive Error from a failed GitHub response. */
async function toError(res, label) {
  let detail = '';
  try {
    const data = await res.json();
    detail = data && data.message ? data.message : '';
  } catch {
    /* non-JSON body */
  }
  const messages = {
    401: 'Bad credentials — check your token.',
    403: 'Forbidden — token missing repo scope or rate limited.',
    404: 'Not found — check repo/path or token permissions.',
    409: 'Conflict — the file changed on the server. Reload and retry.',
    422: 'Validation failed — the file may already exist.',
  };
  const friendly = messages[res.status] || `HTTP ${res.status}`;
  const err = new Error(`${label}: ${friendly}${detail ? ` (${detail})` : ''}`);
  err.status = res.status;
  return err;
}
