# AMS99 Parity Audit and Implementation Plan

**Audit date:** 2026-08-20  
**Target repository:** `rehmanahmedca-source/ams99` at `380d38c899bebfc57d4aaa90469ed30f2d7729b3` (`main`)  
**TypeScript repository baseline:** `5a60c4dc636e257100959376d8dfd3ae218c684d`  

## 1. Goal and parity definition

The goal is to keep this repository on its TypeScript/React/Express platform while reproducing AMS99's:

1. business rules and accounting results;
2. database contract and migration behavior;
3. pages, forms, actions, filters, exports, prints, and workflows;
4. authentication, roles, permissions, auditability, maintenance, and backup behavior;
5. visual hierarchy, navigation, labels, theme, and responsive behavior;
6. compatibility with existing AMS99 databases and import/export files.

“Identical” should mean **observable parity**, not line-for-line source parity. React and Flask naturally differ internally, but the same data and user action must produce the same result.

## 2. Executive conclusion

The current repository is a **partial rewrite**, not an identical AMS99 implementation.

It has a useful base: React shell, shared theme assets, 29 page components, 85 Express API handler registrations, 63 AMS tables, and substantial booking/client-ledger work. However, AMS99 is much larger and includes 289 route decorators, 64 tables, 68 top-level templates/partials, 195 automated test functions, extensive domain services, role/security controls, migrations, audit tools, and operational workflows.

The most important findings are:

- Shared `theme.css`, `ui.css`, `theme.js`, and `ui.js` are byte-identical to AMS99, but page markup and navigation are not.
- The current schema is missing one table, 27 columns, one foreign key, and all 218 explicit indexes found in the audited AMS99 database.
- Authentication and authorization are effectively absent. All current API routes are exposed and the UI assumes an Admin user.
- Major modules are absent or represented by summary-only pages.
- The XLSX “master import” advertises many sheets but actually imports only material categories, materials, clients, suppliers, and delivery persons.
- There are no TypeScript tests, while AMS99 has 29 main test files and 195 test functions.
- The React production build succeeds, but the server TypeScript check fails with many configuration and type errors.
- Legacy Express/EJS files coexist with the active React server and are not part of the active runtime.

A safe parity project must therefore be executed in vertical slices with a database/accounting compatibility harness. Styling-only changes would create a dangerous appearance of completion without financial correctness.

## 3. Measured comparison

| Area | Current TypeScript repository | AMS99 reference | Result |
|---|---:|---:|---|
| Application/domain source footprint | about 20,342 lines overall | about 110,247 lines overall (includes tests/tools/artifacts) | Current is substantially smaller |
| Active UI pages/templates | 29 React pages | 68 top-level Jinja templates/partials | Many workflows missing |
| HTTP registrations | 85 Express API handlers (34 GET, 51 POST) | 289 route decorators, 279 distinct declared paths | Major route gap |
| Database tables | 63 | 64 | 1 table missing |
| Database columns | 754 | 781 | 27 columns missing |
| Foreign keys | 55 | 56 | 1 missing |
| Explicit indexes | 0 | 218 | Serious performance/contract gap |
| Automated business tests | 0 | 29 primary files / 195 test functions | No regression safety |
| Shared core theme assets | 4 exact matches | 4 source assets | Good base |
| Vendored browser dependencies | absent; Bootstrap/icons use CDN | Bootstrap, icons, Flatpickr vendored | Offline/deployment mismatch |
| Authentication | no login/session enforcement | Flask-Login, password migration, session management | Critical missing control |
| Roles/permissions | UI hardcodes Admin fallback | role and module permissions | Critical missing control |
| Build | Vite client build passes | Python app/tests | Client is buildable |
| Server type check | fails | n/a | Must be fixed before parity work |

## 4. Database compatibility findings

### 4.1 Missing table

- `cash_flow_entry_audit`

### 4.2 Missing columns

- `cash_flow_category`: `notes`, `updated_at`
- `cash_flow_subcategory`: `notes`, `updated_at`
- `cash_flow_party`: `updated_at`
- `cash_flow_entry`:
  - `amount_minor`
  - `destination_account_id`
  - `idempotency_key`
  - `reference`
  - `revision`
  - `source_id`
  - `source_type`
  - `updated_at`
  - `updated_by`
  - `void_reason`
  - `voided_at`
  - `voided_by`
- `user`: `can_manage_accounts`, `can_view_cash_flow`

### 4.3 Index and lifecycle gaps

The current `schema.sql` creates no explicit indexes; the reference database has 218. These cover bills, dates, source links, void state, booking allocations, account transactions, cash-flow entities, imports, audit records, and other high-use relations.

The current schema bootstrapping runs `CREATE TABLE IF NOT EXISTS`; it is not a full migration system. It will not safely upgrade an older live database with new columns, indexes, repair steps, or schema-version gates. AMS99 includes schema versioning, upgrade logic, consistency repairs, and integrity checks.

### 4.4 Required compatibility policy

- Use integer minor-unit columns as the authoritative money representation wherever AMS99 does.
- Turn foreign-key enforcement on for every SQLite connection.
- Preserve all AMS99 table and column names.
- Add versioned, idempotent migrations; never rely on destructive database replacement.
- Test both a fresh database and a cloned production-format AMS99 database.
- Compare post-operation database state, not only API response shape.

## 5. Module-by-module gap analysis

Legend: **Partial** means a visible page or API exists but does not yet cover the reference workflow.

### 5.1 Identity, security, and administration — Missing

AMS99 includes login/logout, secure password hashing and plaintext-password remediation, root recovery and recovery codes, login-session history, user status, role permissions, module permissions, tenant administration, activity logs, and root backup settings.

Current state:

- no login page or login API;
- no server-side session guard;
- no route-level permission checks;
- bootstrap always falls back to Admin;
- no CSRF protection;
- permissive credentialed CORS reflects arbitrary origins;
- no session invalidation/history UI;
- no user administration UI;
- no tenant administration or root recovery workflow.

This is the highest-priority release blocker.

### 5.2 Dashboard — Partial

The current dashboard provides summary data and cards, but AMS99 has a denser operational dashboard, notification state, role-sensitive navigation, financial indicators, and links into detailed workflows. Each KPI must be compared using the same database fixture.

### 5.3 Inventory, materials, GRN, and receiving — Partial

Present:

- stock summary;
- daily summary;
- material CRUD/ledger basics;
- GRN create/edit/payment/void basics.

Missing or incomplete compared with AMS99:

- full material-category CRUD and activation behavior;
- merge materials and rename-label workflows;
- bulk unit updates and material integrity controls;
- GRN wizard/receiving workflow;
- supplier balance and payment interactions in the complete flow;
- FIFO costing/allocation parity and repair behavior;
- inventory log and complete daily drilldowns;
- export/import parity;
- negative-stock and material-return integrity rules;
- reference print/download behavior.

### 5.4 Direct sales, bills, bookings, and returns — Partial

Bookings are currently the deepest port and include create/edit, allocations, void/unvoid, payments, conflict handling, and client cancellation support.

Still missing or incomplete:

- exact direct-sale validation and accounting effects;
- hold/resume/delete sale drafts;
- all bill detail/collision-resolution views;
- invoice PDF/download and print layout;
- mixed transactions;
- exact booked-sale edit and allocation repair semantics;
- full refund flow and round-trip invariants;
- material return ledger behavior and all edit/void edge cases;
- uniform bill namespace/counter behavior;
- complete audit logging for edits, deletes, voids, and restores.

### 5.5 Clients, suppliers, and ledgers — Partial

Present:

- client and supplier lists;
- basic CRUD;
- client/supplier ledger endpoints;
- client booking cancellation;
- payments and opening balance support in some flows.

Missing or incomplete:

- financial ledger and financial-ledger detail parity;
- decision ledger;
- client clearance and complete-history reports;
- print/PDF downloads;
- client reclaim/delete/transfer rules;
- exact active/inactive bulk actions;
- full supplier payment edit/delete/restore and receipts;
- ledger reconciliation and unified-financial-ledger invariants;
- lazy modal detail workflows used by AMS99.

### 5.6 Delivery, dispatch, tracking, and driver accounting — Partial

Present pages are mostly lightweight summaries. AMS99 includes dispatch add/edit/delete/import, tracking, delivery records, driver ledgers, opening balances, driver payments with edit/void/restore, downloads, and unified-accounting behavior.

Required additions:

- tracking page and operational status updates;
- complete dispatch CRUD/import;
- delivery detail/receiving flow;
- delivery-person ledger and payment lifecycle;
- allocation to accounts and cash drawer;
- exact rent and driver-payment accounting effects;
- PDF/print exports.

### 5.7 Accounts and unified accounting — Partial

Present:

- account listing/add;
- transfer and expense actions;
- account ledger summary;
- some reconciliation APIs.

Missing or incomplete:

- categories, edit, toggle, and guarded delete parity;
- receipts, client payments, supplier payments, and expenditure pages;
- transaction edit/delete/void lifecycle;
- reconciliation history and previous-reconciliation links;
- all account KPI pages/APIs;
- accounting audit trail;
- source-linked/idempotent postings;
- exact cash/bank/company-money calculations.

### 5.8 Cash flow and reconciliation — Substantially incomplete

The current pages expose summary data and difference adjustments, but the reference contains a large cash-flow engine with:

- category, subcategory, and party masters;
- inflow/outflow/transfer entries;
- source and destination accounts;
- revisions and idempotency;
- void metadata and entry audit history;
- difference adjustments;
- reconciliation snapshots and audit records;
- detail pages and business validation.

The schema gaps in this area confirm that current behavior cannot be identical.

### 5.9 Reports, payables, profit, and documents — Substantially incomplete

Current report pages are mostly summaries. AMS99 includes:

- current payables/unpaid transactions;
- detailed profit reports and profit entries;
- daily and stock report drilldowns;
- financial details;
- PDF reports;
- bill/invoice views;
- client/supplier/driver ledgers and receipts;
- exports with exact filtering and totals.

All report totals must be parity-tested against fixed fixtures.

### 5.10 Pending bills and notifications — Partial / Missing

Pending bill basics exist, but AMS99 also has import/export, lazy detail modals, bill status interactions, due notifications, staff emails, reminders, contact history, severity, acknowledge/close actions, upcoming reminders, and bill detail pages. The notification subsystem is absent.

### 5.11 Import/export, migration, backup, and maintenance — Substantially incomplete

Current strengths:

- Excel generation;
- full-raw sheet generation;
- a synchronous upload endpoint;
- inline basic results.

Important gaps:

- the UI lists many master sheets, but master import currently processes only five areas;
- no staged upload/job/progress/history/cancel workflow;
- no validation preview or review workflow;
- no transfer JSON contract;
- no full raw history/artifacts;
- no tenant DB export/restore;
- no app upgrade/rollback workflow;
- no backup retention, health snapshots, locks, or recovery controls;
- no wipe preview, selective wipe, consistency rebuild, or system report.

Raw import currently uses `INSERT OR REPLACE`, which can delete/reinsert rows under SQLite semantics and can break relationships. It must be replaced by AMS99-compatible, dependency-ordered import behavior with backups and validation.

### 5.12 UI and navigation — Visually related, not identical

Positive finding: these four files are byte-identical to AMS99:

- `static/theme.css`
- `static/ui.css`
- `static/theme.js`
- `static/ui.js`

Differences:

- current React markup and grouping differ from the Jinja page structure;
- route names differ (`/stock` versus `/inventory/stock_summary`, `/sales` versus `/direct_sales`, etc.);
- missing navigation items include tracking, decision ledger, current payables, notifications, and supplier payments;
- role-sensitive nav visibility is absent;
- AMS99's top bar, reminder panel, logout, submenu behavior, and persisted sidebar behavior are not fully reproduced;
- Bootstrap Icons version differs;
- the current app depends on public CDNs, while AMS99 vendors Bootstrap, icons, and Flatpickr for offline reliability;
- numerous page-specific forms, modals, print layouts, and responsive details are missing.

## 6. Engineering and quality findings

### 6.1 Type safety

`npm run build` succeeds for the client. `npx tsc -p tsconfig.server.json --noEmit` fails with:

- `.ts` import extension configuration errors;
- unsafe `unknown` values flowing into SQLite inputs;
- invalid property accesses;
- incompatible payload fields;
- duplicate response properties.

A server type-check script must become a mandatory CI gate.

### 6.2 Tests

There is no test suite in the TypeScript repository. AMS99 has 195 test functions across 29 primary test files, covering accounts, bookings, cash flow, reconciliation, driver payments, FIFO, imports, inventory, maintenance, material returns, permissions, refunds, sales round trips, and financial ledgers.

These tests are the best available behavioral specification and should be ported into parity scenarios, not ignored.

### 6.3 Runtime structure

The active runtime is `server/index.ts` plus React. The repository also contains an older `server.js`, `data/store.js`, EJS `views/`, and duplicated `static/`/`public/` assets. These are not wired into the active server and create ambiguity. They should only be removed after confirming no parity fixtures or markup are still useful.

### 6.4 Dependency and deployment behavior

- Bootstrap and icons currently require internet access.
- No lockfile is committed, so installs are not fully reproducible.
- No CI scripts enforce client type check, server type check, linting, tests, migrations, or smoke tests.
- Upload limit is 12 MB, while AMS99 defaults to a configurable 256 MB.
- Database path is not currently configurable in the same manner as AMS99, making isolated tests and deployments harder.

## 7. Implementation plan

### Phase 0 — Freeze the parity contract

Deliverables:

1. Record the AMS99 target commit and maintain a route/page/action inventory.
2. Build machine-readable manifests for:
   - routes and methods;
   - tables, columns, constraints, and indexes;
   - page/navigation entries;
   - import/export sheets;
   - permission requirements.
3. Convert the 195 reference tests into a parity checklist grouped by domain.
4. Define golden fixtures: empty DB, seeded DB, edge-case DB, and sanitized production-format DB.
5. Establish exact URL compatibility. Preserve AMS99 URLs through React routes or server redirects.

Exit criteria: every AMS99 capability has a status, owner phase, and acceptance scenario.

### Phase 1 — Stabilize the TypeScript foundation

Deliverables:

1. Fix `tsconfig.server.json` and all server type errors.
2. Add scripts for `typecheck`, `typecheck:server`, `test`, `test:integration`, and `check`.
3. Add a committed lockfile and CI workflow.
4. Make DB path, upload limit, secrets, cookie options, and journal mode configurable.
5. Split the 1,763-line route file into domain routers/services/repositories.
6. Add centralized validation, error handling, transactions, request logging, and audit context.
7. Remove reflected wildcard credentialed CORS; default to same-origin.
8. Add isolated test DB creation and teardown.

Exit criteria: clean client/server type checks, reproducible install, health smoke test, and transactional test harness.

### Phase 2 — Schema and migration parity

Deliverables:

1. Add the missing table and 27 columns.
2. recreate all required indexes and missing foreign key;
3. introduce versioned, idempotent migrations and schema-version checks;
4. enable and verify foreign keys per connection;
5. port AMS99's integrity upgrades and repair reports;
6. create schema comparison tests against the reference manifest;
7. verify fresh installation and in-place upgrade from current schema;
8. verify open/read/write compatibility with an AMS99-format database copy.

Exit criteria: zero table/column/FK/index manifest differences and successful upgrade rollback/backup test.

### Phase 3 — Authentication, permissions, sessions, and audit

Deliverables:

1. Login/logout and secure session cookies.
2. Password hashing and safe legacy-password migration.
3. User CRUD, active status, roles, and all permission flags.
4. Route middleware and matching nav/action visibility.
5. Login session history and invalidation.
6. Root recovery codes and protected backup settings.
7. CSRF protection for cookie-authenticated mutations.
8. Activity log, accounting audit log, and consistent actor attribution.

Exit criteria: all reference role/permission and password migration scenarios pass; anonymous mutation is impossible.

### Phase 4 — Shared UI shell and exact navigation

Deliverables:

1. Vendor Bootstrap, Bootstrap Icons, and Flatpickr locally.
2. Reproduce the AMS99 sidebar order, groups, labels, icons, top bar, reminder area, logout, responsive overlay, and saved scroll state.
3. Add all missing routes and compatibility aliases.
4. Create reusable parity components for tables, filters, forms, searchable selectors, lazy modals, confirmation dialogs, pagination, status badges, and notices.
5. Match light/dark themes and role-based navigation.
6. Add screenshot tests at desktop and mobile widths.

Exit criteria: navigation and shell screenshot baselines match; every visible AMS99 nav action resolves.

### Phase 5 — Master data, inventory, and purchasing vertical slice

Implement and parity-test:

- materials/categories, activation, merge, rename, unit updates;
- clients, suppliers, delivery persons, opening balances, active state;
- GRN wizard, receiving, edits, payments, voids;
- stock, inventory log, daily transactions;
- FIFO costing and allocations;
- material and supplier ledgers;
- print/export actions.

Exit criteria: inventory and GRN reference tests pass and stock/FIFO results match row-for-row.

### Phase 6 — Sales, bookings, returns, bills, and payments vertical slice

Implement and parity-test:

- direct sale create/edit/void and exact categories;
- hold/resume drafts;
- bookings and allocation integrity;
- bill collision and namespace behavior;
- booking cancellation/revert;
- material returns/refunds;
- payments, pending bills, mixed transactions;
- invoice/view-bill/receipt downloads;
- all resulting account, stock, client, supplier, and audit postings.

Exit criteria: sales round-trip, booked-sale edit, refund, allocation, return, and consistency scenarios match AMS99 database state.

### Phase 7 — Delivery, dispatch, tracking, and driver accounting

Implement and parity-test:

- dispatch board CRUD/import;
- delivery and tracking workflows;
- delivery rents;
- driver ledgers, payments, edits, void/restore;
- account/cash allocations;
- ledger downloads.

Exit criteria: unified driver-payment accounting and dispatch/tracking scenarios match.

### Phase 8 — Accounts, cash flow, and reconciliation

Implement and parity-test:

- account/category CRUD and lifecycle guards;
- receipts, expenditures, client/supplier payments, transfers;
- transaction edit/void/delete;
- account ledgers and KPIs;
- complete cash-flow category/subcategory/party/entry engine;
- source links, destination accounts, idempotency, revisions, void metadata;
- cash-flow entry audit;
- difference adjustments and reconciliation history/detail;
- accounting and financial integrity audits.

Exit criteria: cash-flow, reconciliation, FBM transfer, accounts-integrity, and unified-ledger suites match exact totals and postings.

### Phase 9 — Reports, documents, notifications, and settings

Implement and parity-test:

- profit reports/entries;
- financial details and decision ledger;
- current payables/unpaid transactions;
- all ledger, clearance, receipt, invoice, and PDF documents;
- notification due engine, staff emails, reminders, contacts, severity, acknowledge/close;
- complete settings, activity log, sessions, void audit, and restore behavior.

Exit criteria: all report totals match golden fixtures; PDF/print content contains the same fields and totals; notification lifecycle passes.

### Phase 10 — Import/export, maintenance, backup, and tenancy

Implement and parity-test:

- complete master workbook contract;
- safe full-raw and transfer import/export;
- staged uploads, preview, validation, jobs, progress, history, artifacts, and cancel;
- pre-import backups and dependency-ordered writes;
- app upgrade/rollback;
- backup retention, health snapshots, locks, root recovery;
- tenant create/update/backup/restore/delete;
- wipe preview/selective wipe/reconcile/system report;
- data-lab workflows if they remain part of the target deployment.

Exit criteria: import round trips are idempotent, failed imports leave no partial state, backups restore successfully, and maintenance tests pass.

### Phase 11 — Final parity certification and cleanup

1. Run all ported reference scenarios on both implementations with equivalent fixtures.
2. Diff financial totals, stock, allocations, ledgers, source links, void/audit records, and exports.
3. Run route smoke tests for every GET and permitted mutation.
4. Run browser screenshot and interaction suites.
5. Run performance tests on realistic data; verify indexes with query plans.
6. Run security checks for auth bypass, CSRF, upload abuse, unsafe redirects, and secret handling.
7. Remove confirmed dead legacy EJS/server code and duplicated assets.
8. Update operator documentation, migration instructions, backup/restore runbook, and parity matrix.

Exit criteria: no open critical/high parity defects; every capability in the Phase 0 inventory is marked matched or explicitly excluded by written decision.

## 8. Recommended implementation order

Do **not** implement by copying pages first. Use this order:

1. foundation and tests;
2. schema/migrations;
3. authentication/permissions/audit;
4. shared shell;
5. one complete transaction vertical slice at a time;
6. reports and documents only after posting logic is stable;
7. import/maintenance after the core model is trustworthy;
8. visual polish and cleanup last.

For every mutation, use this parity loop:

1. prepare identical database fixtures;
2. execute the action in AMS99 and TypeScript;
3. normalize timestamps/IDs where necessary;
4. compare all affected rows and calculated reports;
5. encode the comparison as an automated regression test;
6. only then mark the action complete.

## 9. Definition of done for “identical”

The rewrite is complete only when all of the following are true:

- schema manifest has no unexplained differences;
- existing AMS99 databases upgrade without data loss;
- every reference page/action has a working equivalent and compatible URL;
- permissions are enforced server-side, not only hidden in the UI;
- transaction/accounting/stock side effects match golden database diffs;
- all reference business scenarios have TypeScript regression coverage;
- report/export/PDF totals match;
- import round trips and backup restores are proven;
- desktop/mobile UI screenshot baselines are approved;
- client and server type checks, integration tests, browser tests, migration tests, and security checks pass in CI;
- no legacy runtime path can accidentally start a different application.

## 10. Immediate first implementation milestone

The first coding milestone should contain only Phases 0–3 foundations:

1. add parity manifests and a test harness;
2. make server type checking clean;
3. add versioned schema parity migrations and indexes;
4. add authentication, session, CSRF, permissions, and audit middleware;
5. prove the upgraded app can open a copied AMS99 database and pass schema/security smoke tests.

This milestone creates the safety boundary needed before changing sales, inventory, or accounting behavior.
