/**
 * validation.js
 * -----------------------------------------------------------------------------
 * Field-level and structural validation for canonical packages.
 * Returns plain result objects so the UI layer decides how to render them.
 */

import { REQUIRED_KEYS } from './schema.js';

const FIELD_LABELS = {
  name: 'Package name',
  price: 'Price',
  code: 'USSD / dial code',
  data: 'Data amount',
  validity: 'Validity',
  network: 'Network',
};

/**
 * Validate a canonical package.
 * @returns {{ valid: boolean, errors: Record<string,string>, warnings: string[] }}
 */
export function validatePackage(pkg) {
  const errors = {};
  const warnings = [];

  for (const key of REQUIRED_KEYS) {
    const v = pkg[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      errors[key] = `${FIELD_LABELS[key] || key} is required.`;
    }
  }

  // Soft checks (non-blocking warnings).
  if (pkg.price && !/^\d+(\.\d+)?$/.test(String(pkg.price).replace(/[,\s]/g, ''))) {
    warnings.push('Price contains non-numeric characters — store a plain number when possible.');
  }
  if (pkg.code && !/[#*\d]/.test(String(pkg.code))) {
    warnings.push('USSD code looks unusual (expected something like *117*30#).');
  }
  if (!pkg.network) {
    warnings.push('Network is empty — it will be omitted from the saved file.');
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings };
}

/**
 * Validate the overall structure of a category file payload.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCategoryFile(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    errors.push('File is not a JSON object.');
    return { valid: false, errors };
  }
  if (!Array.isArray(obj.packages)) {
    errors.push('Missing a "packages" array.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an operator id/folder slug.
 */
export function validateSlug(slug) {
  if (!slug) return 'Identifier is required.';
  if (!/^[a-z0-9_]+$/.test(slug)) {
    return 'Use only lowercase letters, numbers and underscores.';
  }
  return null;
}

/**
 * Normalize any human label into a safe slug.
 */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
