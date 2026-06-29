/**
 * editor.js
 * -----------------------------------------------------------------------------
 * The package editor. Only `name` is a fixed, required field. Every other
 * property is an editable key = value row: the user can rename the key, edit
 * the value, remove the row, or add brand-new rows. This makes the schema fully
 * flexible while keeping `name` as the one guaranteed field.
 *
 * A live JSON preview reflects the exact object that will be written. The
 * editor is UI-only: it hands the built object back via onSave; persistence is
 * the caller's concern.
 */

import { el, esc, openModal, closeModal, toast } from './ui.js';

// Suggested keys offered when adding a new row (purely convenience).
const SUGGESTED_KEYS = ['price', 'code', 'data', 'validity', 'network', 'active'];

/**
 * Open the package editor modal.
 * @param {object} opts
 * @param {object} opts.pkg            package object (canonical or with extras)
 * @param {string} opts.mode           'add' | 'edit' | 'duplicate'
 * @param {string} opts.pathHint       repo path, e.g. pakistan/jazz/data.json
 * @param {string} opts.networkDefault default network value for new packages
 * @param {(pkg:object, mode:string)=>void} opts.onSave
 */
export function openPackageEditor({ pkg, mode = 'add', pathHint = '', networkDefault = '', onSave }) {
  // Build the working model. `name` is special; everything else is a row list.
  const source = buildSource(pkg, mode, networkDefault);
  let name = source.name;
  // rows: [{ key, value }] preserving order. Coerce non-string values to a
  // displayable string but remember booleans/numbers for re-serialization.
  const rows = Object.entries(source.rest).map(([key, value]) => makeRow(key, value));

  const titleMap = { add: 'Add package', edit: 'Edit package', duplicate: 'Duplicate package' };

  /* ----------------------------- name field ----------------------------- */
  const form = el('form', { class: 'pkg-form', novalidate: 'novalidate' });

  const nameWrap = el('div', { class: 'field' });
  nameWrap.appendChild(el('label', { class: 'field__label', for: 'pf_name', html: 'Package name <span class="req">*</span>' }));
  const nameInput = el('input', { id: 'pf_name', class: 'input', type: 'text', placeholder: 'e.g. Monthly Supreme', value: name });
  nameWrap.appendChild(nameInput);
  const nameErr = el('p', { class: 'field__error', id: 'pf_name_err' });
  nameWrap.appendChild(nameErr);
  nameInput.addEventListener('input', () => { name = nameInput.value; refresh(); });
  form.appendChild(nameWrap);

  /* ---------------------------- key=value rows --------------------------- */
  form.appendChild(el('div', { class: 'kv-head' }, [
    el('span', { class: 'kv-head__k', text: 'Key' }),
    el('span', { class: 'kv-head__v', text: 'Value' }),
    el('span', { class: 'kv-head__x' }),
  ]));

  const rowsHost = el('div', { class: 'kv-rows' });
  form.appendChild(rowsHost);

  const addRowBtn = el('button', { class: 'btn btn--ghost btn--sm kv-add', type: 'button', text: '+ Add field' });
  addRowBtn.addEventListener('click', () => {
    const row = makeRow('', '');
    rows.push(row);
    renderRows();
    // focus the new key input
    const last = rowsHost.querySelector('.kv-row:last-child .kv-row__key');
    if (last) last.focus();
    refresh();
  });
  form.appendChild(addRowBtn);

  /* ------------------------------ preview -------------------------------- */
  const previewWrap = el('div', { class: 'preview' });
  previewWrap.appendChild(el('div', { class: 'preview__head' }, [
    el('span', { text: 'Live JSON preview' }),
    pathHint ? el('code', { class: 'path-hint', text: pathHint }) : null,
  ]));
  const pre = el('pre', { class: 'preview__code' });
  const code = el('code');
  pre.appendChild(code);
  previewWrap.appendChild(pre);

  const warnBox = el('div', { class: 'pkg-warnings' });
  const layout = el('div', { class: 'editor-grid' }, [form, el('div', { class: 'editor-side' }, [previewWrap, warnBox])]);

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: mode === 'edit' ? 'Save changes' : 'Add package' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    saveBtn,
  ]);

  saveBtn.addEventListener('click', () => {
    if (!name.trim()) {
      nameErr.textContent = 'Package name is required.';
      nameInput.classList.add('input--error');
      nameInput.focus();
      return;
    }
    const dupKey = firstDuplicateKey();
    if (dupKey) { toast(`Duplicate key "${dupKey}" — keys must be unique.`, 'error'); return; }
    onSave(buildObject(), mode);
  });

  /* ----------------------------- rendering ------------------------------- */
  function renderRows() {
    rowsHost.innerHTML = '';
    rows.forEach((row, idx) => rowsHost.appendChild(renderRow(row, idx)));
  }

  function renderRow(row, idx) {
    const wrap = el('div', { class: 'kv-row' });

    const keyInput = el('input', {
      class: 'input kv-row__key', type: 'text', placeholder: 'key',
      value: row.key, list: 'kvKeySuggest',
    });
    keyInput.addEventListener('input', () => {
      row.key = keyInput.value.trim();
      keyInput.classList.toggle('input--error', isDuplicate(row, idx));
      refresh();
    });

    const valInput = el('input', {
      class: 'input kv-row__val', type: 'text', placeholder: 'value', value: row.value,
    });
    valInput.addEventListener('input', () => { row.value = valInput.value; refresh(); });

    const del = el('button', { class: 'icon-btn icon-btn--xs icon-btn--danger', type: 'button', title: 'Remove field', 'aria-label': 'Remove field', text: '✕' });
    del.addEventListener('click', () => {
      const i = rows.indexOf(row);
      if (i >= 0) rows.splice(i, 1);
      renderRows();
      refresh();
    });

    wrap.appendChild(keyInput);
    wrap.appendChild(valInput);
    wrap.appendChild(del);
    return wrap;
  }

  function isDuplicate(row, idx) {
    if (!row.key) return false;
    return rows.some((r, i) => i !== idx && r.key && r.key === row.key);
  }
  function firstDuplicateKey() {
    const seen = new Set();
    for (const r of rows) {
      if (!r.key) continue;
      if (seen.has(r.key) || r.key === 'name') return r.key;
      seen.add(r.key);
    }
    return null;
  }

  /* --------------------------- serialization ----------------------------- */
  // Convert a value string back to boolean/number when it clearly is one,
  // otherwise keep it as a string. This keeps `active: true` a real boolean.
  function coerce(value) {
    const t = value.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t !== '' && /^-?\d+(\.\d+)?$/.test(t) && String(Number(t)) === t) return Number(t);
    return value;
  }

  function buildObject() {
    const out = { name: name.trim() };
    for (const r of rows) {
      const k = r.key.trim();
      if (!k || k === 'name') continue;
      out[k] = r.original !== undefined && r.original === r.value && r.rawType !== 'string'
        ? r.rawValue
        : coerce(r.value);
    }
    return out;
  }

  function refresh() {
    code.textContent = JSON.stringify(buildObject(), null, 2);
    const warnings = [];
    if (!name.trim()) warnings.push('Package name is required.');
    const dup = firstDuplicateKey();
    if (dup) warnings.push(`Duplicate / reserved key "${dup}".`);
    const emptyKeys = rows.filter((r) => !r.key && r.value).length;
    if (emptyKeys) warnings.push(`${emptyKeys} field(s) have a value but no key and will be dropped.`);
    warnBox.innerHTML = warnings.length
      ? `<div class="banner banner--warn"><span class="banner__icon">⚠️</span><div>${warnings.map(esc).join('<br>')}</div></div>`
      : '';
    if (name.trim()) { nameErr.textContent = ''; nameInput.classList.remove('input--error'); }
  }

  // key suggestion datalist (shared)
  if (!document.getElementById('kvKeySuggest')) {
    const dl = el('datalist', { id: 'kvKeySuggest' },
      SUGGESTED_KEYS.map((k) => el('option', { value: k })));
    document.body.appendChild(dl);
  }

  openModal({ title: titleMap[mode] || 'Package', body: layout, footer: foot });
  renderRows();
  refresh();
}

/* ------------------------------ helpers ----------------------------------- */

function makeRow(key, value) {
  const rawType = typeof value;
  return {
    key,
    value: value === undefined || value === null ? '' : (rawType === 'object' ? JSON.stringify(value) : String(value)),
    // remember the original so we can preserve exact boolean/number/object
    // values if the user doesn't touch them.
    original: rawType === 'object' ? JSON.stringify(value) : String(value),
    rawValue: value,
    rawType,
  };
}

/**
 * Split an incoming package into { name, rest } where `rest` is every other
 * key in a stable order. Handles canonical packages and the preserved `_extra`
 * bag. For brand-new packages, seed sensible default keys.
 */
function buildSource(pkg, mode, networkDefault) {
  if (!pkg) {
    return {
      name: '',
      rest: {
        price: '',
        code: '',
        data: '',
        validity: '',
        network: networkDefault || '',
        active: true,
      },
    };
  }

  // Merge canonical fields + any preserved extras into one plain object.
  const merged = { ...pkg };
  if (pkg._extra) Object.assign(merged, pkg._extra);

  const name = merged.name || '';
  const rest = {};
  for (const [k, v] of Object.entries(merged)) {
    if (k === 'name' || k === '_extra') continue;
    // drop empty optional fields so the editor isn't cluttered, but keep
    // explicit false/0 values.
    if (v === '' || v === undefined || v === null) continue;
    rest[k] = v;
  }
  // For duplicate mode, network default helps if missing.
  if (!('network' in rest) && networkDefault && mode !== 'edit') rest.network = networkDefault;
  return { name, rest };
}
