/**
 * workflows.js
 * -----------------------------------------------------------------------------
 * Higher-level repo workflows that produce the file/folder structure the repo
 * expects, then present ready-to-commit JSON with exact repo paths.
 *
 * Because the site is static on GitHub Pages (no backend, no write token), we
 * cannot commit directly. Instead each workflow yields:
 *   - the exact repo path(s) to create/update
 *   - the precise JSON to paste
 *   - a one-click copy + a "create file on GitHub" deep link
 * This keeps the editing workflow fast and unambiguous.
 */

import { el, esc, openModal, closeModal, toast } from './ui.js';
import { slugify, validateSlug } from './validation.js';

const GH_BASE = 'https://github.com/smkgethubpro/sims';

function newFileUrl(path, contents) {
  // GitHub "create new file" deep link with prefilled name + value.
  const params = new URLSearchParams({ filename: path, value: contents });
  return `${GH_BASE}/new/main?${params.toString()}`;
}
function editFileUrl(path) {
  return `${GH_BASE}/edit/main/${path}`;
}

/** Reusable block that shows a path + JSON + copy + GitHub link. */
function fileBlock({ path, json, isNew = true }) {
  const wrap = el('div', { class: 'file-block' });
  wrap.appendChild(el('div', { class: 'file-block__head' }, [
    el('code', { class: 'path-hint', text: path }),
    el('div', { class: 'btn-row' }, [
      el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button', text: 'Copy JSON',
        onClick: () => { navigator.clipboard.writeText(json).then(() => toast('JSON copied', 'success')); },
      }),
      el('a', {
        class: 'btn btn--primary btn--sm', target: '_blank', rel: 'noopener',
        href: isNew ? newFileUrl(path, json) : editFileUrl(path),
        text: isNew ? 'Create on GitHub ↗' : 'Edit on GitHub ↗',
      }),
    ]),
  ]));
  const pre = el('pre', { class: 'preview__code' });
  pre.appendChild(el('code', { text: json }));
  wrap.appendChild(pre);
  return wrap;
}

/**
 * Show a "commit instructions" modal for one or more files.
 */
export function showSaveInstructions({ title, files, note }) {
  const body = el('div', {});
  if (note) body.appendChild(el('div', { class: 'banner banner--info', html: `<span class="banner__icon">ℹ️</span><div>${note}</div>` }));
  for (const f of files) body.appendChild(fileBlock(f));
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--primary', type: 'button', text: 'Done', onClick: closeModal }),
  ]);
  openModal({ title, body, footer: foot });
}

/**
 * Add Operator workflow. Produces:
 *   - updated operators.json (append new operator)
 *   - new <folder>/categories.json (with chosen starter categories)
 *   - new <folder>/<category>.json (empty packages) for each category
 */
export function openAddOperator({ country, base, existingOperators, onComplete }) {
  const form = el('form', { class: 'pkg-form' });

  const nameField = textField('Operator name', 'e.g. Zong', true);
  const idField = textField('Identifier (folder)', 'e.g. zong', true);
  form.appendChild(nameField.wrap);
  form.appendChild(idField.wrap);

  // auto-slug
  nameField.input.addEventListener('input', () => {
    if (!idField.touched) idField.input.value = slugify(nameField.input.value);
  });
  idField.input.addEventListener('input', () => { idField.touched = true; });

  // starter categories
  const catWrap = el('div', { class: 'field' });
  catWrap.appendChild(el('label', { class: 'field__label', text: 'Starter categories' }));
  const catRow = el('div', { class: 'chip-select' });
  const starter = [
    { id: 'data', name: 'Data Packages', file: 'data.json' },
    { id: 'social', name: 'Social Packages', file: 'social.json' },
    { id: 'voice', name: 'Voice Packages', file: 'voice.json' },
    { id: 'roaming', name: 'Roaming Packages', file: 'roaming.json' },
  ];
  const chosen = new Set(['data']);
  starter.forEach((c) => {
    const chip = el('button', { type: 'button', class: 'chip' + (chosen.has(c.id) ? ' chip--on' : ''), text: c.name });
    chip.addEventListener('click', () => {
      if (chosen.has(c.id)) { chosen.delete(c.id); chip.classList.remove('chip--on'); }
      else { chosen.add(c.id); chip.classList.add('chip--on'); }
    });
    catRow.appendChild(chip);
  });
  catWrap.appendChild(catRow);
  form.appendChild(catWrap);

  const errBox = el('p', { class: 'field__error' });
  form.appendChild(errBox);

  const createBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Generate files' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    createBtn,
  ]);

  createBtn.addEventListener('click', () => {
    const name = nameField.input.value.trim();
    const id = (idField.input.value.trim() || slugify(name));
    const slugErr = validateSlug(id);
    if (!name) { errBox.textContent = 'Operator name is required.'; return; }
    if (slugErr) { errBox.textContent = slugErr; return; }
    if (existingOperators.some((o) => (o.folder || o.id) === id)) {
      errBox.textContent = `An operator with folder "${id}" already exists.`;
      return;
    }
    if (chosen.size === 0) { errBox.textContent = 'Pick at least one category.'; return; }

    const cats = starter.filter((c) => chosen.has(c.id));

    // Build files
    const updatedOperators = {
      operators: [...existingOperators, { id, name, folder: id }],
    };
    const files = [];
    files.push({
      path: `${base}/operators.json`, isNew: false,
      json: JSON.stringify(updatedOperators, null, 2),
    });
    files.push({
      path: `${base}/${id}/categories.json`, isNew: true,
      json: JSON.stringify({ categories: cats.map((c) => ({ id: c.id, name: c.name, file: c.file })) }, null, 2),
    });
    cats.forEach((c) => {
      files.push({
        path: `${base}/${id}/${c.file}`, isNew: true,
        json: JSON.stringify({ category: c.id, packages: [] }, null, 2),
      });
    });

    closeModal();
    showSaveInstructions({
      title: `Add operator: ${name}`,
      note: `Create these files in order. The first one <strong>updates</strong> the existing operators.json; the rest are <strong>new</strong> files that build the expected folder structure under <code>${esc(base)}/${esc(id)}/</code>.`,
      files,
    });
    if (onComplete) onComplete();
  });

  openModal({ title: `Add operator to ${country.name}`, body: form, footer: foot });
}

/**
 * Add Category workflow for an existing operator.
 */
export function openAddCategory({ country, base, operator, existingCategories, onComplete }) {
  const folder = operator.folder || operator.id;
  const form = el('form', { class: 'pkg-form' });
  const nameField = textField('Category name', 'e.g. Voice Packages', true);
  const idField = textField('Identifier', 'e.g. voice', true);
  form.appendChild(nameField.wrap);
  form.appendChild(idField.wrap);
  nameField.input.addEventListener('input', () => {
    if (!idField.touched) idField.input.value = slugify(nameField.input.value);
  });
  idField.input.addEventListener('input', () => { idField.touched = true; });
  const errBox = el('p', { class: 'field__error' });
  form.appendChild(errBox);

  const createBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Generate files' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    createBtn,
  ]);

  createBtn.addEventListener('click', () => {
    const name = nameField.input.value.trim();
    const id = (idField.input.value.trim() || slugify(name));
    const slugErr = validateSlug(id);
    if (!name) { errBox.textContent = 'Category name is required.'; return; }
    if (slugErr) { errBox.textContent = slugErr; return; }
    if (existingCategories.some((c) => c.id === id)) {
      errBox.textContent = `Category "${id}" already exists.`;
      return;
    }
    const file = `${id}.json`;
    const updatedCats = { categories: [...existingCategories, { id, name, file }] };
    const files = [
      { path: `${base}/${folder}/categories.json`, isNew: false, json: JSON.stringify(updatedCats, null, 2) },
      { path: `${base}/${folder}/${file}`, isNew: true, json: JSON.stringify({ category: id, packages: [] }, null, 2) },
    ];
    closeModal();
    showSaveInstructions({
      title: `Add category: ${name}`,
      note: `Update <code>categories.json</code> then create the new empty category file.`,
      files,
    });
    if (onComplete) onComplete();
  });

  openModal({ title: `Add category to ${operator.name}`, body: form, footer: foot });
}

/* ------------------------------- helpers ---------------------------------- */

function textField(label, placeholder, required) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', { class: 'field__label', html: `${esc(label)}${required ? ' <span class="req">*</span>' : ''}` }));
  const input = el('input', { class: 'input', type: 'text', placeholder });
  wrap.appendChild(input);
  return { wrap, input, touched: false };
}
