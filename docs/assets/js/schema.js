/**
 * schema.js
 * -----------------------------------------------------------------------------
 * Single source of truth for the canonical package shape and the logic that
 * normalizes the many inconsistent legacy key variants found across the repo
 * into that one canonical structure.
 *
 * Canonical package:
 *   { name, price, code, data, validity, network, active }
 */

export const CANONICAL_KEYS = [
  'name',
  'price',
  'code',
  'data',
  'validity',
  'network',
  'active',
];

export const REQUIRED_KEYS = ['name', 'price', 'code', 'data', 'validity'];

/**
 * Maps legacy / alternate source keys onto canonical keys.
 * Order matters: the first present source key wins.
 */
const FIELD_ALIASES = {
  name: ['name', 'title', 'package_name', 'pkg_name', 'label'],
  price: ['price', 'cost', 'amount', 'rate', 'mrp'],
  code: ['code', 'ussd', 'dial_code', 'ussd_code', 'short_code'],
  data: ['data', 'internet', 'data_amount', 'volume', 'quota'],
  validity: ['validity', 'validity_days', 'duration_days', 'duration', 'days'],
  network: ['network', 'operator', 'carrier'],
  active: ['active', 'is_active', 'enabled'],
};

const canonicalKeySet = new Set(Object.values(FIELD_ALIASES).flat());

/**
 * Return an empty canonical package (used by the editor for "Add").
 */
export function emptyPackage() {
  return {
    name: '',
    price: '',
    code: '',
    data: '',
    validity: '',
    network: '',
    active: true,
  };
}

/**
 * Normalize a single raw package object (any legacy variant) into the
 * canonical structure. Anything that doesn't map to a canonical field is
 * preserved under `_extra` so we never silently lose data when editing.
 *
 * @param {object} raw
 * @returns {object} canonical package (+ non-enumerable `_extra`)
 */
export function normalizePackage(raw) {
  if (!raw || typeof raw !== 'object') return emptyPackage();

  const out = emptyPackage();

  for (const canonical of Object.keys(FIELD_ALIASES)) {
    for (const alias of FIELD_ALIASES[canonical]) {
      if (raw[alias] !== undefined && raw[alias] !== null && raw[alias] !== '') {
        out[canonical] = raw[alias];
        break;
      }
    }
  }

  // Coerce to friendly display strings.
  out.price = stringifyPrice(out.price);
  out.data = stringifyData(out.data, raw);
  out.validity = stringifyValidity(out.validity, raw);
  out.active = out.active === undefined ? true : Boolean(out.active);

  // Preserve unknown keys so editing a package doesn't destroy extra metadata.
  const extra = {};
  for (const key of Object.keys(raw)) {
    if (!canonicalKeySet.has(key)) extra[key] = raw[key];
  }
  Object.defineProperty(out, '_extra', {
    value: extra,
    enumerable: false,
    writable: true,
  });

  return out;
}

/**
 * Normalize a list of raw packages.
 */
export function normalizePackages(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizePackage);
}

/**
 * Convert a canonical package back into a clean JSON-serializable object that
 * follows the canonical key order, then re-attaches preserved `_extra` keys.
 */
export function serializePackage(pkg) {
  const clean = {
    name: String(pkg.name || '').trim(),
    price: String(pkg.price || '').trim(),
    code: String(pkg.code || '').trim(),
    data: String(pkg.data || '').trim(),
    validity: String(pkg.validity || '').trim(),
    network: String(pkg.network || '').trim(),
    active: pkg.active === undefined ? true : Boolean(pkg.active),
  };
  // Drop empty optional network to keep files tidy.
  if (!clean.network) delete clean.network;

  const extra = pkg._extra || {};
  return { ...clean, ...extra };
}

/* ----------------------------- coercion helpers --------------------------- */

function stringifyPrice(value) {
  if (value === undefined || value === null || value === '') return '';
  return String(value).trim();
}

function stringifyData(value, raw) {
  if (value === undefined || value === null || value === '') return '';
  // If the source used data_amount + unit, compose them.
  if (typeof value === 'number' && raw && raw.unit) {
    return `${value}${raw.unit}`;
  }
  return String(value).trim();
}

function stringifyValidity(value, raw) {
  if (value === undefined || value === null || value === '') return '';
  // If the source used validity_days / duration_days (a number), make it human.
  if (typeof value === 'number') {
    return `${value} Day${value === 1 ? '' : 's'}`;
  }
  return String(value).trim();
}
