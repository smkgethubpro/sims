/**
 * app.js
 * -----------------------------------------------------------------------------
 * Orchestrator. Owns app state and wires the three panels together.
 * Pure rendering helpers live in ui.js; data access in api.js; the package
 * form in editor.js; repo workflows in workflows.js. This file stays focused
 * on state + panel composition + event handling.
 */

import * as api from './api.js';
import { normalizePackage } from './schema.js';
import { el, esc, $, loadingState, emptyState, errorState, warningBanner, toast } from './ui.js';
import { openPackageEditor } from './editor.js';
import {
  openAddOperator, openAddCategory, showSaveInstructions,
  openEditCountry, openDeleteCountry, openEditOperator, openDeleteOperator,
  openEditCategory, openDeleteCategory,
} from './workflows.js';
import { confirmDialog, openModal, closeModal } from './ui.js';
import { requireAccess } from './lock.js';
import { getToken, setToken, hasToken } from './github.js';

const state = {
  countries: [],
  filteredCountries: [],
  operators: [],
  base: '',
  categories: [],
  packages: [],          // RAW package objects (custom keys preserved) for current category
  rawCategoryFile: null, // raw loaded file (to preserve meta on save)
  categoryPath: '',
  selected: { country: null, operator: null, category: null },
  warnings: [],
};

const dom = {};

// Gate the whole app behind the access-code lock screen. The app only boots
// after a correct code (or an already-unlocked session).
document.addEventListener('DOMContentLoaded', () => {
  requireAccess(init);
});

async function init() {
  cacheDom();
  bindGlobalEvents();
  await loadCountries();
  loadStatistics(); // async, fire and forget
}

function cacheDom() {
  dom.countryList = $('#countryList');
  dom.countrySearch = $('#countrySearch');
  dom.operatorPanel = $('#operatorPanel');
  dom.packagePanel = $('#packagePanel');
  dom.globalSearch = $('#globalSearch');
  dom.repoStatus = $('#repoStatus');
  dom.statCountries = $('#statCountries');
  dom.statOperators = $('#statOperators');
  dom.statPackages = $('#statPackages');
  dom.settingsBtn = $('#settingsBtn');
  dom.refreshBtn = $('#refreshBtn');
}

function bindGlobalEvents() {
  dom.countrySearch.addEventListener('input', () => renderCountryList());
  dom.globalSearch.addEventListener('input', () => {
    dom.countrySearch.value = dom.globalSearch.value;
    renderCountryList();
  });
  if (dom.settingsBtn) dom.settingsBtn.addEventListener('click', openSettings);
  if (dom.refreshBtn) dom.refreshBtn.addEventListener('click', hardRefresh);
  refreshSettingsIndicator();
}

/* -------------------------------- refresh --------------------------------- */

/**
 * Real refresh: bypass the raw GitHub CDN cache (cache-buster) and the in-memory
 * cache, then reload the data and re-render whatever the user was looking at —
 * without a full page reload. Fixes "I committed a change but the site still
 * shows the old data after a browser refresh".
 */
async function hardRefresh() {
  const btn = dom.refreshBtn;
  if (btn) { btn.disabled = true; btn.textContent = '↻ Refreshing…'; }
  api.hardRefresh();
  toast('Fetching latest data from GitHub…', 'info');

  const sel = state.selected;
  try {
    await loadCountries();

    // Re-select the previously selected country/operator/category if possible,
    // matching by id so the new (fresh) objects are used.
    if (sel.country) {
      const country = state.countries.find((c) => c.id === sel.country.id) || sel.country;
      await selectCountry(country, true);
    }
    loadStatistics();
    toast('✅ Refreshed', 'success');
  } catch (e) {
    toast(`Refresh failed: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  }
}

/* ------------------------------- settings --------------------------------- */

/**
 * Settings modal: paste / clear the GitHub Personal Access Token used for
 * auto-committing changes. The token is stored in localStorage.
 */
function openSettings() {
  const wrap = el('div', { class: 'pkg-form' });

  wrap.appendChild(el('div', { class: 'banner banner--info', html:
    `<span class="banner__icon">ℹ️</span><div>Paste a GitHub <strong>Personal Access Token</strong> with <code>repo</code> scope to auto-save changes directly to <code>smkgethubpro/sims</code>. Leave it empty to use the copy-paste flow. The token is stored only in this browser (localStorage).</div>` }));

  const field = el('div', { class: 'field' });
  field.appendChild(el('label', { class: 'field__label', for: 'ghToken', text: 'GitHub Personal Access Token' }));
  const input = el('input', {
    id: 'ghToken', class: 'input', type: 'password',
    placeholder: 'ghp_… or github_pat_…', value: getToken(),
    autocomplete: 'off', spellcheck: 'false',
  });
  field.appendChild(input);
  field.appendChild(el('p', { class: 'field__hint', html:
    'Need one? <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">Create a token</a> with <code>repo</code> scope.' }));
  wrap.appendChild(field);

  const showRow = el('label', { class: 'field field--inline' }, [
    el('input', { class: 'checkbox', type: 'checkbox', id: 'ghShow',
      onChange: (e) => { input.type = e.target.checked ? 'text' : 'password'; } }),
    el('span', { class: 'field__label', text: 'Show token' }),
  ]);
  wrap.appendChild(showRow);

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Save token' });
  saveBtn.addEventListener('click', () => {
    setToken(input.value);
    refreshSettingsIndicator();
    closeModal();
    toast(hasToken() ? 'Token saved — changes will auto-save to GitHub' : 'Token cleared — using copy-paste mode', hasToken() ? 'success' : 'info');
  });

  const clearBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Clear token' });
  clearBtn.addEventListener('click', () => {
    setToken('');
    input.value = '';
    refreshSettingsIndicator();
    closeModal();
    toast('Token cleared — using copy-paste mode', 'info');
  });

  const foot = el('div', { class: 'btn-row btn-row--end' }, [
    clearBtn,
    el('button', { class: 'btn btn--ghost', type: 'button', text: 'Cancel', onClick: closeModal }),
    saveBtn,
  ]);

  openModal({ title: 'GitHub auto-save settings', body: wrap, footer: foot });
}

/** Reflect token presence on the Settings button (subtle ✓ when connected). */
function refreshSettingsIndicator() {
  if (!dom.settingsBtn) return;
  if (hasToken()) {
    dom.settingsBtn.textContent = '⚙ Settings ✓';
    dom.settingsBtn.title = 'GitHub auto-save is ON';
  } else {
    dom.settingsBtn.textContent = '⚙ Settings';
    dom.settingsBtn.title = 'GitHub auto-save settings';
  }
}

/* ------------------------------- countries -------------------------------- */

async function loadCountries() {
  dom.countryList.innerHTML = loadingState('Loading countries…');
  try {
    state.countries = await api.getCountries();
    state.filteredCountries = state.countries;
    dom.statCountries.textContent = state.countries.length;
    setRepoStatus('ok', 'Connected');
    renderCountryList();
  } catch (e) {
    dom.countryList.innerHTML = errorState('Could not load countries.json', e.message);
    setRepoStatus('error', 'Failed to load repository');
  }
}

function renderCountryList() {
  const q = dom.countrySearch.value.trim().toLowerCase();
  const list = q
    ? state.countries.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
    : state.countries;
  state.filteredCountries = list;

  if (list.length === 0) {
    dom.countryList.innerHTML = emptyState('🔍', 'No countries match', `“${q}”`);
    return;
  }
  dom.countryList.innerHTML = '';
  list.forEach((c) => {
    const row = el('div', {
      class: 'nav-item' + (state.selected.country === c ? ' nav-item--active' : ''),
    });
    const main = el('button', { class: 'nav-item__main', type: 'button' }, [
      el('span', { class: 'nav-item__name', text: c.name }),
      el('span', { class: 'nav-item__meta', text: c.id.toUpperCase() }),
    ]);
    main.addEventListener('click', () => selectCountry(c));

    const actions = el('div', { class: 'nav-item__actions' }, [
      iconBtn('✏️', `Edit ${c.name}`, (e) => {
        e.stopPropagation();
        openEditCountry({ country: c, allCountries: state.countries, onComplete: () => {} });
      }, 'icon-btn--xs'),
      iconBtn('🗑', `Delete ${c.name}`, async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog(`Remove <strong>${esc(c.name)}</strong> from countries.json? You'll also need to delete its folder on GitHub.`, { confirmText: 'Delete', danger: true });
        if (ok) openDeleteCountry({ country: c, allCountries: state.countries, base: api.countryBasePath(c), onComplete: () => {} });
      }, 'icon-btn--xs icon-btn--danger'),
    ]);

    row.appendChild(main);
    row.appendChild(actions);
    dom.countryList.appendChild(row);
  });
}

/* ------------------------------- operators -------------------------------- */

async function selectCountry(country, force = false) {
  if (!force && state.selected.country === country) return;
  state.selected = { country, operator: null, category: null };
  state.warnings = [];
  renderCountryList();
  resetPackagePanel();

  dom.operatorPanel.innerHTML = operatorPanelShell(country, loadingState('Loading operators…'));
  bindOperatorHeader(country);

  try {
    const { operators, exists, base } = await api.getOperators(country);
    state.operators = operators;
    state.base = base;

    let warnHtml = '';
    if (!exists) {
      // Country listed in countries.json but folder/operators.json missing.
      warnHtml = warningBanner(
        `Country <strong>${esc(country.name)}</strong> is listed in countries.json but <code>${esc(base)}/operators.json</code> was not found. The country folder may not exist yet.`
      );
    }

    const bodyHost = $('#operatorBody');
    if (operators.length === 0) {
      bodyHost.innerHTML = warnHtml + emptyState('📭', 'No operators yet', 'Use “Add Operator” to create the first one.');
      return;
    }

    bodyHost.innerHTML = warnHtml;
    const list = el('div', { class: 'op-list' });
    for (const op of operators) {
      list.appendChild(operatorCard(country, op));
    }
    bodyHost.appendChild(list);

    // Load package counts lazily per operator.
    operators.forEach((op) => loadOperatorCount(country, op));
  } catch (e) {
    $('#operatorBody').innerHTML = errorState('Could not load operators', e.message);
  }
}

function operatorPanelShell(country, inner) {
  return `
    <div class="panel__head">
      <div>
        <h2 class="panel__title">${esc(country.name)}</h2>
        <p class="panel__sub"><code class="path-hint">${esc(api.countryBasePath(country))}/operators.json</code></p>
      </div>
      <button class="btn btn--primary btn--sm" id="addOperatorBtn" type="button">+ Add operator</button>
    </div>
    <div id="operatorBody" class="panel__body">${inner}</div>`;
}

function bindOperatorHeader(country) {
  const btn = $('#addOperatorBtn');
  if (btn) btn.addEventListener('click', () => {
    openAddOperator({
      country,
      base: state.base || api.countryBasePath(country),
      existingOperators: state.operators,
      onComplete: () => {},
    });
  });
}

function operatorCard(country, op) {
  const key = op.folder || op.id;
  const card = el('div', {
    class: 'op-card' + (state.selected.operator === op ? ' op-card--active' : ''),
    'data-op': key,
  });

  const head = el('button', { class: 'op-card__head', type: 'button' }, [
    el('div', { class: 'op-card__info' }, [
      el('span', { class: 'op-card__name', text: op.name }),
      el('span', { class: 'op-card__folder path-hint', text: key }),
    ]),
    el('span', { class: 'badge badge--count', id: `count_${key}`, text: '…' }),
  ]);
  head.addEventListener('click', () => selectOperator(country, op, card));

  const actions = el('div', { class: 'op-card__actions' }, [
    iconBtn('✏️', `Edit ${op.name}`, (e) => {
      e.stopPropagation();
      openEditOperator({
        country, base: state.base || api.countryBasePath(country),
        operator: op, existingOperators: state.operators, onComplete: () => {},
      });
    }, 'icon-btn--xs'),
    iconBtn('🗑', `Delete ${op.name}`, async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog(`Remove <strong>${esc(op.name)}</strong> from operators.json? You'll also need to delete its folder on GitHub.`, { confirmText: 'Delete', danger: true });
      if (ok) openDeleteOperator({
        base: state.base || api.countryBasePath(country),
        operator: op, existingOperators: state.operators, onComplete: () => {},
      });
    }, 'icon-btn--xs icon-btn--danger'),
  ]);

  const topRow = el('div', { class: 'op-card__top' }, [head, actions]);
  card.appendChild(topRow);
  card.appendChild(el('div', { class: 'op-card__cats', id: `cats_${key}` }));
  return card;
}

async function loadOperatorCount(country, op) {
  const badge = document.getElementById(`count_${op.folder || op.id}`);
  if (!badge) return;
  try {
    const { categories, exists } = await api.getCategories(country, op);
    if (!exists) { badge.textContent = '0'; badge.title = 'No categories.json'; return; }
    let total = 0;
    await Promise.all(categories.map(async (cat) => {
      const { raw, exists: fileExists } = await api.getCategoryFile(country, op, cat);
      if (fileExists && raw && Array.isArray(raw.packages)) total += raw.packages.length;
    }));
    badge.textContent = String(total);
    badge.title = `${total} package${total === 1 ? '' : 's'} across ${categories.length} categories`;
  } catch {
    badge.textContent = '?';
  }
}

/* ------------------------------ categories -------------------------------- */

async function selectOperator(country, op, cardNode) {
  state.selected.operator = op;
  state.selected.category = null;
  // toggle active visual
  document.querySelectorAll('.op-card').forEach((n) => n.classList.remove('op-card--active'));
  cardNode.classList.add('op-card--active');

  const catHost = document.getElementById(`cats_${op.folder || op.id}`);
  catHost.innerHTML = loadingState('Loading categories…');
  resetPackagePanel();

  try {
    const { categories, exists } = await api.getCategories(country, op);
    state.categories = categories;

    catHost.innerHTML = '';
    if (!exists) {
      catHost.innerHTML = warningBanner(`No <code>categories.json</code> for ${esc(op.name)} yet.`);
    }

    const chipRow = el('div', { class: 'chip-row' });
    categories.forEach((cat) => {
      const chipWrap = el('div', { class: 'cat-chip' });
      const chip = el('button', { class: 'chip cat-chip__main', type: 'button', text: cat.name });
      chip.addEventListener('click', () => {
        chipRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip--on'));
        chip.classList.add('chip--on');
        selectCategory(country, op, cat);
      });
      const editBtn = iconBtn('✏️', `Edit ${cat.name}`, (e) => {
        e.stopPropagation();
        openEditCategory({
          base: state.base || api.countryBasePath(country),
          operator: op, category: cat, existingCategories: categories,
          onComplete: () => selectOperator(country, op, cardNode),
        });
      }, 'icon-btn--xs');
      const delBtn = iconBtn('🗑', `Delete ${cat.name}`, async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog(`Delete category <strong>${esc(cat.name)}</strong> from ${esc(op.name)}? Its package file will also be removed.`, { confirmText: 'Delete', danger: true });
        if (ok) openDeleteCategory({
          base: state.base || api.countryBasePath(country),
          operator: op, category: cat, existingCategories: categories,
          onComplete: () => selectOperator(country, op, cardNode),
        });
      }, 'icon-btn--xs icon-btn--danger');
      const actions = el('div', { class: 'cat-chip__actions' }, [editBtn, delBtn]);
      chipWrap.appendChild(chip);
      chipWrap.appendChild(actions);
      chipRow.appendChild(chipWrap);
    });
    const addChip = el('button', { class: 'chip chip--add', type: 'button', text: '+ Category' });
    addChip.addEventListener('click', () => openAddCategory({
      country, base: state.base, operator: op, existingCategories: categories, onComplete: () => selectOperator(country, op, cardNode),
    }));
    chipRow.appendChild(addChip);
    catHost.appendChild(chipRow);

    if (categories.length === 0) {
      catHost.appendChild(el('p', { class: 'muted', text: 'No categories. Add one to start.' }));
    }
  } catch (e) {
    catHost.innerHTML = errorState('Could not load categories', e.message);
  }
}

/* ------------------------------- packages --------------------------------- */

async function selectCategory(country, op, cat) {
  state.selected.category = cat;
  dom.packagePanel.innerHTML = packagePanelShell(cat, loadingState('Loading packages…'));

  try {
    const { raw, file, exists, parseError } = await api.getCategoryFile(country, op, cat);
    state.categoryPath = file;
    state.rawCategoryFile = raw;

    const head = $('#pkgPanelPath');
    if (head) head.textContent = file;

    const body = $('#pkgPanelBody');
    if (!exists) {
      const msg = parseError
        ? `The category metadata exists but <code>${esc(file)}</code> could not be parsed (invalid JSON).`
        : `The category is listed in categories.json but the file <code>${esc(file)}</code> is missing.`;
      body.innerHTML = warningBanner(msg) +
        emptyState('📄', 'No package file', 'Add a package to generate the file.');
      bindPackageHeader(country, op, cat);
      return;
    }

    // Keep RAW objects so custom keys survive edit/save; normalize only for display.
    state.packages = Array.isArray(raw.packages) ? raw.packages.map((p) => ({ ...p })) : [];
    renderPackages(country, op, cat);
  } catch (e) {
    $('#pkgPanelBody').innerHTML = errorState('Could not load packages', e.message);
  }
  bindPackageHeader(country, op, cat);
}

function packagePanelShell(cat, inner) {
  return `
    <div class="panel__head">
      <div>
        <h2 class="panel__title">${esc(cat.name)}</h2>
        <p class="panel__sub"><code class="path-hint" id="pkgPanelPath">…</code></p>
      </div>
      <button class="btn btn--primary btn--sm" id="addPackageBtn" type="button">+ Add package</button>
    </div>
    <div id="pkgPanelBody" class="panel__body">${inner}</div>`;
}

function bindPackageHeader(country, op, cat) {
  const btn = $('#addPackageBtn');
  if (btn) btn.addEventListener('click', () => {
    openPackageEditor({
      mode: 'add',
      pathHint: state.categoryPath,
      networkDefault: op.name,
      onSave: (pkg) => persistPackage({ index: -1, pkg, country, op, cat }),
    });
  });
}

function renderPackages(country, op, cat) {
  const body = $('#pkgPanelBody');
  if (state.packages.length === 0) {
    body.innerHTML = emptyState('📦', 'No packages yet', 'Click “Add package” to create the first one.');
    return;
  }

  const table = el('table', { class: 'pkg-table' });
  table.innerHTML = `
    <thead><tr>
      <th>Name</th><th>Price</th><th>Data</th><th>Validity</th><th>Code</th><th>Status</th><th class="ta-right">Actions</th>
    </tr></thead>`;
  const tbody = el('tbody');
  state.packages.forEach((pkg, i) => tbody.appendChild(packageRow(pkg, i, country, op, cat)));
  table.appendChild(tbody);
  body.innerHTML = '';
  body.appendChild(table);
}

function packageRow(rawPkg, index, country, op, cat) {
  // Normalize only for display; the raw object (with custom keys) is preserved.
  const view = normalizePackage(rawPkg);
  const tr = el('tr', {});
  tr.appendChild(el('td', { class: 'td-name', text: view.name || '—' }));
  tr.appendChild(el('td', { text: view.price ? `${view.price}` : '—' }));
  tr.appendChild(el('td', { text: view.data || '—' }));
  tr.appendChild(el('td', { text: view.validity || '—' }));
  tr.appendChild(el('td', {}, [el('code', { class: 'code-pill', text: view.code || '—' })]));
  tr.appendChild(el('td', {}, [
    el('span', {
      class: 'badge ' + (view.active === false ? 'badge--off' : 'badge--on'),
      text: view.active === false ? 'Inactive' : 'Active',
    }),
  ]));

  const actions = el('div', { class: 'row-actions' }, [
    iconBtn('👁', 'Preview', () => previewPackage(rawPkg)),
    iconBtn('✏️', 'Edit', () => openPackageEditor({
      mode: 'edit', pkg: rawPkg, pathHint: state.categoryPath, networkDefault: op.name,
      onSave: (updated) => persistPackage({ index, pkg: updated, country, op, cat }),
    })),
    iconBtn('⧉', 'Duplicate', () => openPackageEditor({
      mode: 'duplicate',
      pkg: { ...rawPkg, name: `${rawPkg.name || view.name || 'Package'} (copy)` },
      pathHint: state.categoryPath, networkDefault: op.name,
      onSave: (dup) => persistPackage({ index: -1, pkg: dup, country, op, cat }),
    })),
    iconBtn('🗑', 'Delete', async () => {
      const ok = await confirmDialog(`Delete <strong>${esc(view.name || 'this package')}</strong> from this category?`, { confirmText: 'Delete', danger: true });
      if (ok) persistPackage({ index, pkg: null, country, op, cat, remove: true });
    }, 'icon-btn--danger'),
  ]);
  tr.appendChild(el('td', { class: 'ta-right' }, [actions]));
  return tr;
}

function iconBtn(glyph, title, onClick, extra = '') {
  const b = el('button', { class: `icon-btn ${extra}`, type: 'button', title, 'aria-label': title, text: glyph });
  b.addEventListener('click', onClick);
  return b;
}

function previewPackage(rawPkg) {
  const json = JSON.stringify(rawPkg, null, 2);
  showSaveInstructions({
    title: (rawPkg && rawPkg.name) || 'Package preview',
    note: 'The exact JSON stored for this package (all keys preserved).',
    files: [{ path: state.categoryPath, json, isNew: false }],
  });
}

/**
 * Apply an add/edit/duplicate/delete to the in-memory package list, then show
 * the resulting full category file JSON ready to commit (static site = no
 * direct write). Preserves the original file's `category`/`meta` envelope and
 * every package's custom keys.
 */
function persistPackage({ index, pkg, country, op, cat, remove = false }) {
  const list = state.packages.map((p) => ({ ...p })); // raw objects, custom keys intact
  if (remove) {
    list.splice(index, 1);
  } else if (index >= 0) {
    list[index] = pkg;
  } else {
    list.push(pkg);
  }

  // Rebuild file envelope, preserving meta from the original file if present.
  const envelope = {};
  const orig = state.rawCategoryFile || {};
  if (orig.category || cat.id) envelope.category = orig.category || cat.id;
  if (orig.type) envelope.type = orig.type;
  if (orig.meta) envelope.meta = orig.meta;
  envelope.packages = list;

  const json = JSON.stringify(envelope, null, 2);

  // Optimistically update the UI so it feels live.
  state.rawCategoryFile = envelope;
  state.packages = list;
  renderPackages(country, op, cat);
  loadOperatorCount(country, op);

  const verb = remove ? 'Delete from' : index >= 0 ? 'Update' : 'Add to';
  showSaveInstructions({
    title: `${verb} ${cat.name}`,
    note: `This is the <strong>complete</strong> updated <code>${esc(state.categoryPath)}</code>. Commit it to save your change. (The preview above already reflects it locally.)`,
    files: [{ path: state.categoryPath, json, isNew: false }],
  });
}

function resetPackagePanel() {
  dom.packagePanel.innerHTML = `
    <div class="panel__head"><h2 class="panel__title">Packages</h2></div>
    <div class="panel__body">${emptyState('👈', 'Select a category', 'Pick an operator and category to view packages.')}</div>`;
}

/* ------------------------------ statistics -------------------------------- */

async function loadStatistics() {
  // Real counts. To avoid ~195 guaranteed 404s on load, first ask the GitHub
  // contents API which top-level folders actually exist, then scan only the
  // countries whose folder is present. If the API is unavailable we fall back
  // to scanning only the countries the user has interacted with (cheap), and
  // leave the totals as best-effort.
  let operators = 0;
  let packages = 0;
  let scanned = 0;

  const folders = await api.getRepoTopFolders();

  const candidates = folders
    ? state.countries.filter((c) => folders.has(api.countryBasePath(c)))
    : state.countries.slice(0, 0); // no API: skip the noisy full scan

  for (const country of candidates) {
    try {
      const { operators: ops, exists } = await api.getOperators(country);
      if (!exists) continue;
      scanned++;
      operators += ops.length;
      for (const op of ops) {
        const { categories, exists: cex } = await api.getCategories(country, op);
        if (!cex) continue;
        const counts = await Promise.all(categories.map(async (cat) => {
          const { raw, exists: fex } = await api.getCategoryFile(country, op, cat);
          return fex && raw && Array.isArray(raw.packages) ? raw.packages.length : 0;
        }));
        packages += counts.reduce((a, b) => a + b, 0);
      }
    } catch { /* skip */ }
  }

  dom.statCountries.textContent = String(state.countries.length);
  if (folders) {
    dom.statOperators.textContent = String(operators);
    dom.statPackages.textContent = String(packages);
    setRepoStatus('ok', 'Connected');
  } else {
    // Graceful: show countries count, defer operator/package totals.
    dom.statOperators.textContent = '—';
    dom.statPackages.textContent = '—';
    setRepoStatus('ok', 'Connected');
  }
  void scanned;
}

function setRepoStatus(kind, text) {
  if (!dom.repoStatus) return;
  dom.repoStatus.className = `repo-status repo-status--${kind}`;
  dom.repoStatus.innerHTML = `<span class="dot"></span><span>${esc(text)}</span>`;
}
