/**
 * ui.js
 * -----------------------------------------------------------------------------
 * Small, dependency-free DOM helpers and reusable state renderers
 * (loading / empty / error). Keeps rendering logic out of app.js.
 */

/** Escape text for safe innerHTML insertion. */
export function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Create an element with attributes + children. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

/* ----------------------------- state renderers ---------------------------- */

export function loadingState(message = 'Loading…') {
  return `<div class="state state--loading">
    <div class="spinner" aria-hidden="true"></div>
    <p>${esc(message)}</p>
  </div>`;
}

export function emptyState(icon, title, subtitle = '') {
  return `<div class="state state--empty">
    <div class="state__icon">${esc(icon)}</div>
    <p class="state__title">${esc(title)}</p>
    ${subtitle ? `<p class="state__sub">${esc(subtitle)}</p>` : ''}
  </div>`;
}

export function errorState(title, detail = '') {
  return `<div class="state state--error">
    <div class="state__icon">⚠️</div>
    <p class="state__title">${esc(title)}</p>
    ${detail ? `<p class="state__sub">${esc(detail)}</p>` : ''}
  </div>`;
}

/** Inline warning banner (e.g. missing folder / category file). */
export function warningBanner(message) {
  return `<div class="banner banner--warn" role="alert">
    <span class="banner__icon">⚠️</span><span>${message}</span>
  </div>`;
}

/* --------------------------------- toast ---------------------------------- */

let toastTimer = null;
export function toast(message, type = 'info') {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = el('div', { id: 'toastHost', class: 'toast-host' });
    document.body.appendChild(host);
  }
  const t = el('div', { class: `toast toast--${type}`, text: message });
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--show'));
  clearTimeout(toastTimer);
  setTimeout(() => {
    t.classList.remove('toast--show');
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

/* --------------------------------- modal ---------------------------------- */

export function openModal({ title, body, footer }) {
  closeModal();
  const overlay = el('div', { class: 'modal-overlay', id: 'modalOverlay' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
  const head = el('div', { class: 'modal__head' }, [
    el('h2', { class: 'modal__title', text: title }),
    el('button', { class: 'icon-btn', 'aria-label': 'Close', text: '✕', onClick: closeModal }),
  ]);
  const content = el('div', { class: 'modal__body' });
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.appendChild(body);

  modal.appendChild(head);
  modal.appendChild(content);
  if (footer) {
    const f = el('div', { class: 'modal__foot' });
    if (typeof footer === 'string') f.innerHTML = footer;
    else f.appendChild(footer);
    modal.appendChild(f);
  }
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', escClose);
  document.body.appendChild(overlay);
  return { overlay, modal, content };
}

function escClose(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  const o = document.getElementById('modalOverlay');
  if (o) o.remove();
  document.removeEventListener('keydown', escClose);
}

/** Confirmation dialog returning a promise<boolean>. */
export function confirmDialog(message, { confirmText = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const foot = el('div', { class: 'btn-row btn-row--end' }, [
      el('button', { class: 'btn btn--ghost', text: 'Cancel', onClick: () => { closeModal(); resolve(false); } }),
      el('button', {
        class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
        text: confirmText,
        onClick: () => { closeModal(); resolve(true); },
      }),
    ]);
    openModal({ title: 'Please confirm', body: `<p class="confirm-text">${message}</p>`, footer: foot });
  });
}
