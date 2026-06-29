# SIM Packages — Admin Dashboard

A lightweight, **static** admin dashboard for managing SIM package data stored
as JSON in this repository. It runs entirely in the browser and is served from
**GitHub Pages** at https://smkgethubpro.github.io/sims/ — no backend required.

The dashboard is optimized for **editing and adding operators and packages**
efficiently, not for marketing. It reads the repository's JSON over the GitHub
raw CDN and, because Pages is static (no write token), produces ready‑to‑commit
JSON + exact repo paths for every change.

---

## Information architecture

A modern **three‑panel** layout replaces the old 4‑tab UI:

```
┌──────────── Top bar: brand · global search · repo status · refresh · repo link ┐
├──────────── Stat strip: real Countries / Operators / Packages counts ──────────┤
│ Left sidebar      │ Middle panel              │ Right panel                     │
│ Countries + search│ Operators (w/ counts)     │ Package table + editor          │
│                   │ Category chips per operator│ edit · duplicate · delete · view│
└───────────────────┴───────────────────────────┴─────────────────────────────────┘
```

- **Left** — country list + live filter (and a global search in the top bar).
- **Middle** — operators for the selected country, each with a real package
  count badge; category chips per operator; **+ Add operator** / **+ Category**.
- **Right** — package table with **Edit / Duplicate / Delete / Preview**, plus
  **+ Add package** with a clean form and **live JSON preview**.

---

## Project structure

```
sims/
├── countries.json              # Master index: { id, name, file }
├── <country-folder>/           # NOTE: folder name comes from `file`, not `id`
│   ├── operators.json          # { operators: [{ id, name, folder }] }
│   └── <operator-folder>/
│       ├── categories.json     # { categories: [{ id, name, file }] }
│       └── <category>.json     # { category, meta?, packages: [...] }
└── docs/                       # GitHub Pages site
    ├── index.html
    └── assets/
        ├── css/styles.css      # Design system
        └── js/
            ├── app.js          # Orchestrator: state + panels + events
            ├── api.js          # All data loading (raw CDN + contents API)
            ├── schema.js       # Canonical shape + legacy-key mapper
            ├── validation.js   # Field/structure validation + slug helpers
            ├── editor.js       # Package form + live JSON preview
            ├── workflows.js    # Add operator / category + commit instructions
            └── ui.js           # DOM helpers, states, modal, toast
```

The code is split so **data loading, rendering, validation and editing are
separate** modules with single responsibilities.

---

## Canonical package schema

Every package is normalized into **one** canonical structure for display and
editing:

```json
{
  "name": "",
  "price": "",
  "code": "",
  "data": "",
  "validity": "",
  "network": "",
  "active": true
}
```

### Schema normalization strategy (`schema.js`)

Source files use many inconsistent keys. The mapper resolves them by trying a
prioritized list of aliases per canonical field (first present wins):

| Canonical  | Accepted source keys                                            |
|------------|-----------------------------------------------------------------|
| `name`     | `name`, `title`, `package_name`, `pkg_name`, `label`            |
| `price`    | `price`, `cost`, `amount`, `rate`, `mrp`                        |
| `code`     | `code`, `ussd`, `dial_code`, `ussd_code`, `short_code`         |
| `data`     | `data`, `internet`, `data_amount` (+`unit`), `volume`, `quota` |
| `validity` | `validity`, `validity_days`, `duration_days`, `duration`, `days`|
| `network`  | `network`, `operator`, `carrier`                               |
| `active`   | `active`, `is_active`, `enabled` (defaults to `true`)          |

- Numeric `validity_days`/`duration_days` are humanized (`7` → `"7 Days"`).
- `data_amount` + `unit` are composed (`25` + `GB` → `"25GB"`).
- **Unknown keys are preserved** under a non‑enumerable `_extra` so editing a
  package never destroys extra metadata; on save they are re‑attached after the
  canonical fields, keeping a consistent key order.

Validation (`validation.js`) enforces required fields
(`name, price, code, data, validity`) and emits non‑blocking warnings (e.g.
non‑numeric price, suspicious USSD code, empty network).

---

## Workflows

### Add operator
Generates, in order: an **updated** `operators.json` (with the new operator
appended), a new `<folder>/categories.json` for the chosen starter categories,
and an empty `<folder>/<category>.json` for each. You get copy buttons and
GitHub "create file" deep links for each.

### Add category
Updates `categories.json` and creates the new empty category file.

### Edit / delete country & operator
- Each country row (left panel) and operator card (middle panel) has inline
  **edit** (rename) and **delete** actions.
- Renaming only changes the display `name`; the `id`/`folder`/`file` paths are
  kept stable so existing files don't break.
- Deleting removes the entry from `countries.json` / `operators.json` and
  reminds you to delete the corresponding folder on GitHub.

### Add / Edit / Duplicate / Delete package
The editor treats **only `name` as a fixed, required field**. Every other
property is an editable **key = value** row — you can rename the key, edit the
value, remove a row, or **+ Add field** for brand‑new keys. This makes the
package schema fully flexible while guaranteeing a `name`. Values that look like
booleans/numbers (`true`, `false`, `30`) are stored as real JSON types; untouched
complex values (objects/arrays) are preserved exactly.

A **live JSON preview** shows the exact object that will be written. Saving
produces the **complete** updated category file (preserving the original
`category`/`meta` envelope and every package's custom keys) with the exact repo
path, ready to commit. The on‑screen table updates optimistically so it feels
live. The table columns still use the normalized canonical view for display.

Because GitHub Pages is static, the dashboard cannot write to the repo
directly. Each save shows the precise file path, the JSON to paste, a **Copy
JSON** button, and a **Create/Edit on GitHub** deep link.

---

## States & warnings

- Clear **loading / empty / error** states throughout.
- Warning when a country is listed in `countries.json` but its
  `operators.json` folder is missing.
- Warning when a category is listed in `categories.json` but its file is
  missing (or contains invalid JSON).

---

## Real statistics

Counts are computed from the repo, not hardcoded. To avoid hundreds of
guaranteed 404s on load, the dashboard asks the GitHub contents API **once**
which top‑level folders exist, then scans only populated countries. If the API
is rate‑limited, totals degrade gracefully to "—" while the countries count
(from `countries.json`) is always shown.

---

## Repository issues fixed / flagged during this work

1. **Invalid JSON** — `pakistan/jazz/data.json` contained JavaScript‑style
   `// comments` and a stray blank line, which made `JSON.parse` (and the live
   site) fail for the entire Data category. **Fixed**: converted to valid JSON
   while keeping the intentional mixed‑schema test packages.
2. **Country id ≠ folder name** — `countries.json` uses a `file` path
   (`pakistan/operators.json`) while the country `id` is `pk`. The old code
   fetched `${id}/operators.json` (`pk/operators.json`), which 404s. **Fixed**:
   the folder/base path is now always derived from the `file` field.
3. **Hardcoded statistics** — the old UI hardcoded "197 countries" and "100+"
   packages. The repo actually indexes **196** countries. **Fixed**: all stats
   are computed live.
4. **Dead dependency** — `js-yaml` was loaded from a CDN but never used.
   **Removed**.
5. **No editing workflow** — the old "Add Package" tab only printed JSON for a
   single object with no edit/duplicate/delete, no operator/category creation,
   and no validation. **Replaced** with the full editor + workflows above.
6. **Data consistency to address in the repo** (not code bugs):
   - Operators listed in `pakistan/operators.json` (zong, ufone, telenor,
     scom, rox, onic) have **no folders yet** — the dashboard surfaces these as
     `0` counts and missing‑file warnings until their folders are created.
   - Mixed schema keys across packages should ideally be normalized at rest;
     the mapper handles them at read time, and re‑saving any package through
     the editor writes it back in canonical form.

---

## Development

Edit files under `docs/` and push to `main`; GitHub Pages serves them. To run
locally:

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

The app fetches live data from the repository's raw CDN, so local runs show the
same data as production.

## Technical notes

- **Stack:** plain HTML + CSS + vanilla JS (ES modules). No framework, no build
  step, no backend.
- **Browser support:** modern browsers (ES modules required).
- **Rate limits:** the unauthenticated GitHub contents API allows 60
  requests/hour; the dashboard caches responses and degrades gracefully.
