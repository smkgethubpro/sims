/**
 * lock.js
 * -----------------------------------------------------------------------------
 * Access-code lock screen shown before the app loads.
 *
 * - A full-screen overlay blocks ALL interaction until unlocked.
 * - The expected code is never stored in plain text: we compare the SHA-256
 *   hash of the typed code against a known hash constant.
 * - On success the unlocked state is saved in sessionStorage, so refreshing the
 *   page during the same tab session does not re-prompt.
 * - Wrong code → input shakes and a red "Wrong code" message appears.
 *
 * Pure vanilla JS + the Web Crypto API (crypto.subtle.digest). No libraries.
 */

// SHA-256 hash of the access code. The plaintext is NOT present in this file.
// (This is the hash of the agreed access code.)
const CODE_HASH = 'b29efe9043c73d5154818339db134dcfe117dfc2da3c74184ec9731b9a61187b';

const SESSION_KEY = 'sims_unlocked';

/** Compute the lowercase hex SHA-256 of a string. */
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Whether this tab session has already been unlocked. */
function isUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markUnlocked() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Gate the app behind the lock screen.
 * @param {() => void} onUnlock called exactly once when access is granted.
 */
export function requireAccess(onUnlock) {
  if (isUnlocked()) {
    onUnlock();
    return;
  }

  const overlay = buildLockScreen(() => {
    markUnlocked();
    overlay.classList.add('lock--hide');
    // Remove after the fade so it never intercepts clicks.
    setTimeout(() => overlay.remove(), 250);
    onUnlock();
  });

  document.body.appendChild(overlay);
  // Focus the field once attached.
  requestAnimationFrame(() => {
    const input = overlay.querySelector('#lockInput');
    if (input) input.focus();
  });
}

function buildLockScreen(grant) {
  const overlay = document.createElement('div');
  overlay.className = 'lock';
  overlay.id = 'lockScreen';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Access code required');

  overlay.innerHTML = `
    <div class="lock__card">
      <div class="lock__logo" aria-hidden="true">◎</div>
      <h1 class="lock__title">SIM Packages Admin</h1>
      <p class="lock__sub">Enter your access code to continue.</p>
      <form class="lock__form" id="lockForm" autocomplete="off">
        <input id="lockInput" class="input lock__input" type="password"
               placeholder="Access code" aria-label="Access code"
               autocomplete="off" spellcheck="false">
        <button class="btn btn--primary lock__btn" type="submit">Unlock</button>
      </form>
      <p class="lock__error" id="lockError" role="alert"></p>
    </div>`;

  const form = overlay.querySelector('#lockForm');
  const input = overlay.querySelector('#lockInput');
  const errBox = overlay.querySelector('#lockError');
  const card = overlay.querySelector('.lock__card');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value;
    let ok = false;
    try {
      ok = (await sha256Hex(value)) === CODE_HASH;
    } catch {
      ok = false;
    }

    if (ok) {
      errBox.textContent = '';
      grant();
      return;
    }

    // Wrong code: red message + shake the input.
    errBox.textContent = 'Wrong code';
    input.classList.add('input--error');
    card.classList.remove('lock--shake');
    // reflow to restart the animation
    void card.offsetWidth;
    card.classList.add('lock--shake');
    input.select();
  });

  // Clear the error styling as the user retypes.
  input.addEventListener('input', () => {
    if (errBox.textContent) {
      errBox.textContent = '';
      input.classList.remove('input--error');
    }
  });

  return overlay;
}
