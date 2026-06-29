/**
 * app.js
 * -----------------------------------------------------------------------------
 * Orchestrator. Owns app state and wires the three panels together.
 * Pure rendering helpers live in ui.js; data access in api.js; the package
 * form in editor.js; repo workflows in workflows.js. This file stays focused
 * on state + panel composition + event handling.
 */

import * as api from './api.js';
import { normalizePackages, serializePackage } from './schema.js';
import { el, esc, $, loadingState, emptyState, errorState, warningBanner, toast } from './ui.js';
import { openPackageEditor } from './editor.js';
import { openAddOperator, openAddCategory, showSaveInstructions } from './workflows.js';
import { confirmDialog } from './ui.js';

const state = {
  countries: [],
  filteredCountries: [],
  operators: [],
  base: '',
  categories: [],
  packages: [],          // normalized, for current category
  rawCategoryFile: null, // raw loaded file (to preserve meta on save)
  categoryPath: '',
  selected: { country: null, operator: null, category: null },
  warnings: [],
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

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
  dom.refreshBtn = $('#refreshBtn');
}

function bindGlobalEvents() {
  dom.countrySearch.addEventListener('input', () => renderCountryList());
  dom.globalSearch.addEventListener('input', () => {
    dom.countrySearch.value = dom.globalSearch.value;
    renderCountryList();
  });
  dom.refreshBtn.addEventListener('click', async () => {
    api.clearCache();
    toast('Cache cleared — reloading', 'info');
    await loadCountries();
    if (state.selected.country) await selectCountry(state.selected.country, true);
    loadStatistics();
  });
}

/* ------------------------------- countries -------------------------------- */

async function loadCountries() {
  dom.countryList.innerHTML = loadingState('Loading countries…');
  try {
    state.countries = await api.getCountries();
    state.filteredCountries = state.countries;
    dom.statCountries.textContent = state.countries.length;
    setRepoStatus('ok', `${state.countries.length} countries indexed`);
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
    const item = el('button', {
      class: 'nav-item' + (state.selected.country === c ? ' nav-item--active' : ''),
      type: 'button',
    }, [
      el('span', { class: 'nav-item__name', text: c.name }),
      el('span', { class: 'nav-item__meta', text: c.id.toUpperCase() }),
    ]);
    item.addEventListener('click', () => selectCountry(c));
    dom.countryList.appendChild(item);
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
  const card = el('div', {
    class: 'op-card' + (state.selected.operator === op ? ' op-card--active' : ''),
    'data-op': op.folder || op.id,
  });
  const head = el('button', { class: 'op-card__head', type: 'button' }, [
    el('div', {}, [
      el('span', { class: 'op-card__name', text: op.name }),
      el('span', { class: 'op-card__folder path-hint', text: op.folder || op.id }),
    ]),
    el('span', { class: 'badge badge--count', id: `count_${op.folder || op.id}`, text: '…' }),
  ]);
  head.addEventListener('click', () => selectOperator(country, op, card));
  card.appendChild(head);
  card.appendChild(el('div', { class: 'op-card__cats', id: `cats_${op.folder || op.id}` }));
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
      const chip = el('button', { class: 'chip', type: 'button', text: cat.name });
      chip.addEventListener('click', () => {
        chipRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip--on'));
        chip.classList.add('chip--on');
        selectCategory(country, op, cat);
      });
      chipRow.appendChild(chip);
    });
    const addChip = el('button', { class: 'chip chip--add', type: 'button', text: '+ Category' });
    addChip.addEventListener('click', () => openAddCategory({
      country, base: state.base, operator: op, existingCategories: categories, onComplete: () => {},
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

    state.packages = normalizePackages(raw.packages || []);
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

function packageRow(pkg, index, country, op, cat) {
  const tr = el('tr', {});
  tr.appendChild(el('td', { class: 'td-name', text: pkg.name || '—' }));
  tr.appendChild(el('td', { text: pkg.price ? `${pkg.price}` : '—' }));
  tr.appendChild(el('td', { text: pkg.data || '—' }));
  tr.appendChild(el('td', { text: pkg.validity || '—' }));
  tr.appendChild(el('td', {}, [el('code', { class: 'code-pill', text: pkg.code || '—' })]));
  tr.appendChild(el('td', {}, [
    el('span', {
      class: 'badge ' + (pkg.active === false ? 'badge--off' : 'badge--on'),
      text: pkg.active === false ? 'Inactive' : 'Active',
    }),
  ]));

  const actions = el('div', { class: 'row-actions' }, [
    iconBtn('👁', 'Preview', () => previewPackage(pkg)),
    iconBtn('✏️', 'Edit', () => openPackageEditor({
      mode: 'edit', pkg, pathHint: state.categoryPath, networkDefault: op.name,
      onSave: (updated) => persistPackage({ index, pkg: updated, country, op, cat }),
    })),
    iconBtn('⧉', 'Duplicate', () => openPackageEditor({
      mode: 'duplicate',
      pkg: { ...serializePackage(pkg), name: `${pkg.name} (copy)` },
      pathHint: state.categoryPath, networkDefault: op.name,
      onSave: (dup) => persistPackage({ index: -1, pkg: dup, country, op, cat }),
    })),
    iconBtn('🗑', 'Delete', async () => {
      const ok = await confirmDialog(`Delete <strong>${esc(pkg.name)}</strong> from this category?`, { confirmText: 'Delete', danger: true });
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

function previewPackage(pkg) {
  const json = JSON.stringify(serializePackage(pkg), null, 2);
  showSaveInstructions({
    title: pkg.name || 'Package preview',
    note: 'Normalized canonical JSON for this package.',
    files: [{ path: state.categoryPath, json, isNew: false }],
  });
}

/**
 * Apply an add/edit/duplicate/delete to the in-memory package list, then show
 * the resulting full category file JSON ready to commit (static site = no
 * direct write). Preserves the original file's `category`/`meta` envelope.
 */
function persistPackage({ index, pkg, country, op, cat, remove = false }) {
  const list = state.packages.map((p) => serializePackage(p));
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
  state.packages = normalizePackages(list);
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
    setRepoStatus('ok', `${state.countries.length} countries · ${scanned} populated · ${operators} operators · ${packages} packages`);
  } else {
    // Graceful: show countries count, defer operator/package totals.
    dom.statOperators.textContent = '—';
    dom.statPackages.textContent = '—';
    setRepoStatus('ok', `${state.countries.length} countries indexed · totals unavailable (API limit)`);
  }
}

function setRepoStatus(kind, text) {
  if (!dom.repoStatus) return;
  dom.repoStatus.className = `repo-status repo-status--${kind}`;
  dom.repoStatus.innerHTML = `<span class="dot"></span><span>${esc(text)}</span>`;
}
