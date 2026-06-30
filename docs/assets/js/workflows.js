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
import { hasToken, autoCommitFiles } from './github.js';
import { clearCache } from './api.js';

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
function fileBlock(file) {
  const { path, json, isNew = true } = file;
  const wrap = el('div', { class: 'file-block' });

  // A "delete" entry has no JSON; just show where to delete the file manually.
  if (file.delete) {
    wrap.appendChild(el('div', { class: 'file-block__head' }, [
      el('code', { class: 'path-hint', text: path }),
      el('a', {
        class: 'btn btn--danger btn--sm', target: '_blank', rel: 'noopener',
        href: editFileUrl(path), text: 'Delete on GitHub ↗',
      }),
    ]));
    wrap.appendChild(el('p', { class: 'field__hint', text: 'Open this file on GitHub and use the “Delete file” option.' }));
    return wrap;
  }

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
 * Render the copy-paste "commit instructions" modal for one or more files.
 * This is the fallback used when no token is set or an auto-commit fails.
 */
function showCopyPasteInstructions({ title, files, note }) {
  const body = el('div', {});
  if (note) body.appendChild(el('div', { class: 'banner banner--info', html: `<span class="banner__icon">ℹ️</span><div>${note}</div>` }));
  for (const f of files) body.appendChild(fileBlock(f));
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--primary', type: 'button', text: 'Done', onClick: closeModal }),
  ]);
  openModal({ title, body, footer: foot });
}

/**
 * Persist one or more files.
 *
 * When a GitHub token is configured (⚙ Settings), this auto-commits every file
 * directly to the repo via the Contents API and shows a success toast. If no
 * token is set, or if any commit fails, it falls back to the original
 * copy-paste instructions modal so the workflow always remains usable.
 *
 * Kept synchronous-looking for all existing callers (it returns a promise but
 * callers may ignore it).
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {Array<{path:string, json:string, isNew?:boolean}>} opts.files
 * @param {string} [opts.note]
 */
export async function showSaveInstructions({ title, files, note }) {
  if (!hasToken()) {
    showCopyPasteInstructions({ title, files, note });
    return;
  }

  // Close any open editor/workflow modal and show a brief "saving" toast.
  closeModal();
  toast('Saving to GitHub…', 'info');

  try {
    await autoCommitFiles(files, title);
    // Invalidate read cache so subsequent fetches see the new content.
    clearCache();
    toast('✅ Saved to GitHub', 'success');
  } catch (e) {
    toast(`GitHub save failed: ${e.message}`, 'error');
    // Fall back to the manual copy-paste flow so nothing is lost.
    showCopyPasteInstructions({
      title,
      files,
      note: note
        ? `${note}<br><br><strong>Auto-commit failed</strong> — you can commit manually below.`
        : 'Auto-commit failed — you can commit these files manually below.',
    });
  }
}

/**
 * Edit Country name workflow. Rewrites the matching entry in countries.json
 * (only the display name; id/file are kept stable to avoid breaking paths).
 */
export function openEditCountry({ country, allCountries, onComplete }) {
  const form = el('form', { class: 'pkg-form' });
  const nameField = textField('Country name', 'e.g. Pakistan', true);
  nameField.input.value = country.name;
  form.appendChild(nameField.wrap);
  form.appendChild(el('p', { class: 'field__hint', html: `ID <code>${esc(country.id)}</code> and path <code>${esc(country.file)}</code> are kept unchanged so existing files don't break.` }));
  const errBox = el('p', { class: 'field__error' });
  form.appendChild(errBox);

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Generate update' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    saveBtn,
  ]);

  saveBtn.addEventListener('click', () => {
    const name = nameField.input.value.trim();
    if (!name) { errBox.textContent = 'Country name is required.'; return; }
    const updated = { countries: allCountries.map((c) => (c.id === country.id ? { ...c, name } : c)) };
    closeModal();
    showSaveInstructions({
      title: `Rename country: ${country.name} → ${name}`,
      note: `This is the <strong>complete</strong> updated <code>countries.json</code> with only the display name changed.`,
      files: [{ path: 'countries.json', isNew: false, json: JSON.stringify(updated, null, 2) }],
    });
    if (onComplete) onComplete({ ...country, name });
  });

  openModal({ title: `Edit ${country.name}`, body: form, footer: foot });
}

/**
 * Delete Country workflow. Removes the entry from countries.json and reminds
 * the user to delete the country's folder on GitHub.
 */
export function openDeleteCountry({ country, allCountries, base, onComplete }) {
  const updated = { countries: allCountries.filter((c) => c.id !== country.id) };
  const folder = base || (country.file ? country.file.replace(/\/operators\.json$/i, '') : country.id);
  showSaveInstructions({
    title: `Delete country: ${country.name}`,
    note: `Two steps: (1) commit the updated <code>countries.json</code> below (entry removed), then (2) delete the folder <code>${esc(folder)}/</code> on GitHub if it exists.`,
    files: [{ path: 'countries.json', isNew: false, json: JSON.stringify(updated, null, 2) }],
  });
  if (onComplete) onComplete();
}

/**
 * Edit Operator name workflow. Rewrites the matching operator's display name in
 * operators.json (id/folder kept stable to avoid breaking paths).
 */
export function openEditOperator({ country, base, operator, existingOperators, onComplete }) {
  const form = el('form', { class: 'pkg-form' });
  const nameField = textField('Operator name', 'e.g. Jazz', true);
  nameField.input.value = operator.name;
  form.appendChild(nameField.wrap);
  form.appendChild(el('p', { class: 'field__hint', html: `Folder <code>${esc(operator.folder || operator.id)}</code> is kept unchanged so package files don't break.` }));
  const errBox = el('p', { class: 'field__error' });
  form.appendChild(errBox);

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Generate update' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    saveBtn,
  ]);

  saveBtn.addEventListener('click', () => {
    const name = nameField.input.value.trim();
    if (!name) { errBox.textContent = 'Operator name is required.'; return; }
    const key = operator.folder || operator.id;
    const updated = { operators: existingOperators.map((o) => ((o.folder || o.id) === key ? { ...o, name } : o)) };
    closeModal();
    showSaveInstructions({
      title: `Rename operator: ${operator.name} → ${name}`,
      note: `This is the <strong>complete</strong> updated <code>${esc(base)}/operators.json</code> with only the display name changed.`,
      files: [{ path: `${base}/operators.json`, isNew: false, json: JSON.stringify(updated, null, 2) }],
    });
    if (onComplete) onComplete({ ...operator, name });
  });

  openModal({ title: `Edit ${operator.name}`, body: form, footer: foot });
}

/**
 * Delete Operator workflow. Removes the operator from operators.json and
 * reminds the user to delete its folder on GitHub.
 */
export function openDeleteOperator({ base, operator, existingOperators, onComplete }) {
  const key = operator.folder || operator.id;
  const updated = { operators: existingOperators.filter((o) => (o.folder || o.id) !== key) };
  showSaveInstructions({
    title: `Delete operator: ${operator.name}`,
    note: `Two steps: (1) commit the updated <code>${esc(base)}/operators.json</code> below (operator removed), then (2) delete the folder <code>${esc(base)}/${esc(key)}/</code> on GitHub if it exists.`,
    files: [{ path: `${base}/operators.json`, isNew: false, json: JSON.stringify(updated, null, 2) }],
  });
  if (onComplete) onComplete();
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

/**
 * Edit Category name workflow. Rewrites the matching category's display name in
 * the operator's categories.json. The id/file are kept stable so the package
 * file path does not break.
 */
export function openEditCategory({ base, operator, category, existingCategories, onComplete }) {
  const folder = operator.folder || operator.id;
  const form = el('form', { class: 'pkg-form' });
  const nameField = textField('Category name', 'e.g. Voice Packages', true);
  nameField.input.value = category.name;
  form.appendChild(nameField.wrap);
  form.appendChild(el('p', { class: 'field__hint', html: `ID <code>${esc(category.id)}</code> and file <code>${esc(category.file || `${category.id}.json`)}</code> are kept unchanged so the package file doesn't break.` }));
  const errBox = el('p', { class: 'field__error' });
  form.appendChild(errBox);

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Generate update' });
  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    saveBtn,
  ]);

  saveBtn.addEventListener('click', () => {
    const name = nameField.input.value.trim();
    if (!name) { errBox.textContent = 'Category name is required.'; return; }
    const updated = { categories: existingCategories.map((c) => (c.id === category.id ? { ...c, name } : c)) };
    closeModal();
    showSaveInstructions({
      title: `Rename category: ${category.name} → ${name}`,
      note: `This is the <strong>complete</strong> updated <code>${esc(base)}/${esc(folder)}/categories.json</code> with only the display name changed.`,
      files: [{ path: `${base}/${folder}/categories.json`, isNew: false, json: JSON.stringify(updated, null, 2) }],
    });
    if (onComplete) onComplete({ ...category, name });
  });

  openModal({ title: `Edit ${category.name}`, body: form, footer: foot });
}

/**
 * Delete Category workflow. Removes the category from categories.json and
 * reminds the user to delete its package file on GitHub.
 */
export function openDeleteCategory({ base, operator, category, existingCategories, onComplete }) {
  const folder = operator.folder || operator.id;
  const file = category.file || `${category.id}.json`;
  const updated = { categories: existingCategories.filter((c) => c.id !== category.id) };
  showSaveInstructions({
    title: `Delete category: ${category.name}`,
    note: `Removing <strong>${esc(category.name)}</strong>: the updated <code>${esc(base)}/${esc(folder)}/categories.json</code> is committed and its package file <code>${esc(file)}</code> is deleted.`,
    files: [
      { path: `${base}/${folder}/categories.json`, isNew: false, json: JSON.stringify(updated, null, 2) },
      { path: `${base}/${folder}/${file}`, delete: true },
    ],
  });
  if (onComplete) onComplete();
}

/* ------------------------------- helpers ---------------------------------- */

function textField(label, placeholder, required) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('label', { class: 'field__label', html: `${esc(label)}${required ? ' <span class="req">*</span>' : ''}` }));
  const input = el('input', { class: 'input', type: 'text', placeholder });
  wrap.appendChild(input);
  return { wrap, input, touched: false };
}
