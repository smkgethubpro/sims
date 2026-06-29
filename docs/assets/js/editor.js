/**
 * editor.js
 * -----------------------------------------------------------------------------
 * The package editor: a clean form bound to a canonical package, with live
 * JSON preview and inline validation. Used for both "Add Package" and
 * "Edit Package" (and as the target of "Duplicate").
 *
 * The editor is UI-only: it produces a serialized canonical package and hands
 * it back to the caller via onSave. Persistence (writing to the repo) is the
 * caller's concern — on GitHub Pages we cannot write directly, so the caller
 * shows copy/commit instructions.
 */

import { emptyPackage, serializePackage } from './schema.js';
import { validatePackage } from './validation.js';
import { el, esc, openModal, closeModal } from './ui.js';

const FIELDS = [
  { key: 'name', label: 'Package name', placeholder: 'e.g. Monthly Supreme', required: true },
  { key: 'price', label: 'Price', placeholder: 'e.g. 1738', required: true, type: 'text' },
  { key: 'code', label: 'USSD / dial code', placeholder: 'e.g. *117*30#', required: true },
  { key: 'data', label: 'Data amount', placeholder: 'e.g. 25GB', required: true },
  { key: 'validity', label: 'Validity', placeholder: 'e.g. 30 Days', required: true },
  { key: 'network', label: 'Network', placeholder: 'e.g. Jazz', required: false },
];

/**
 * Open the package editor modal.
 * @param {object} opts
 * @param {object} opts.pkg            canonical package (or undefined for new)
 * @param {string} opts.mode           'add' | 'edit' | 'duplicate'
 * @param {string} opts.pathHint       repo path, e.g. pakistan/jazz/data.json
 * @param {string} opts.networkDefault default network value for new packages
 * @param {(pkg:object)=>void} opts.onSave
 */
export function openPackageEditor({ pkg, mode = 'add', pathHint = '', networkDefault = '', onSave }) {
  const model = { ...emptyPackage(), ...(pkg || {}) };
  if (mode === 'add' && !model.network) model.network = networkDefault;
  // preserve extras across edit
  if (pkg && pkg._extra) {
    Object.defineProperty(model, '_extra', { value: { ...pkg._extra }, enumerable: false, writable: true });
  }

  const titleMap = { add: 'Add package', edit: 'Edit package', duplicate: 'Duplicate package' };

  const form = el('form', { class: 'pkg-form', novalidate: 'novalidate' });

  // Build fields
  const inputs = {};
  for (const f of FIELDS) {
    const id = `pf_${f.key}`;
    const wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', {
      class: 'field__label',
      for: id,
      html: `${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}`,
    }));
    const input = el('input', {
      id, class: 'input', type: f.type || 'text',
      placeholder: f.placeholder, value: model[f.key] ?? '',
    });
    inputs[f.key] = input;
    wrap.appendChild(input);
    wrap.appendChild(el('p', { class: 'field__error', id: `${id}_err` }));
    form.appendChild(wrap);
    input.addEventListener('input', () => { model[f.key] = input.value; refresh(); });
  }

  // active toggle
  const activeWrap = el('div', { class: 'field field--inline' });
  const activeInput = el('input', { id: 'pf_active', class: 'checkbox', type: 'checkbox' });
  activeInput.checked = model.active !== false;
  activeInput.addEventListener('change', () => { model.active = activeInput.checked; refresh(); });
  activeWrap.appendChild(activeInput);
  activeWrap.appendChild(el('label', { for: 'pf_active', class: 'field__label', text: 'Active (package is currently offered)' }));
  form.appendChild(activeWrap);

  // Live JSON preview
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
    const result = validatePackage(model);
    paintErrors(result);
    if (!result.valid) return;
    onSave(serializePackage(model), mode);
  });

  function refresh() {
    const serialized = serializePackage(model);
    code.textContent = JSON.stringify(serialized, null, 2);
    const result = validatePackage(model);
    paintErrors(result, /*soft*/ true);
    warnBox.innerHTML = result.warnings.length
      ? `<div class="banner banner--warn"><span class="banner__icon">⚠️</span><div>${result.warnings.map(esc).join('<br>')}</div></div>`
      : '';
  }

  function paintErrors(result, soft = false) {
    for (const f of FIELDS) {
      const errNode = document.getElementById(`pf_${f.key}_err`);
      if (!errNode) continue;
      const msg = result.errors[f.key];
      if (soft) {
        // While typing: only clear an error once the field is filled; never
        // newly "shout" about a still-empty required field.
        if (model[f.key]) {
          errNode.textContent = '';
          inputs[f.key].classList.remove('input--error');
        }
      } else {
        // On submit: show all current errors.
        errNode.textContent = msg || '';
        inputs[f.key].classList.toggle('input--error', Boolean(msg));
      }
    }
  }

  openModal({ title: titleMap[mode] || 'Package', body: layout, footer: foot });
  refresh();
}
