# AMS99 → REACT-AMS module xerox prompt

Copy everything below the line. Change **only** the `MODULE` block. Do not soften the study rules.

---

## MODULE (edit this only)

```
MODULE_NAME: Bookings
AMS99_PAGE_HINTS: bookings.html, app/blueprints/sales/bookings.py, related services
REACT_PAGE: src/pages/Bookings.tsx
REACT_ROUTE: /bookings
API_PREFIX: /bookings
```

---

You are working in `/home/user/REACT-AMS` (React + Express + SQLite). The **source of truth** is the working Flask app:

**https://github.com/rehmanahmedca-source/ams99**

Clone or reuse `/tmp/ams99` if already cloned. Do **not** invent a simpler ERP. Previous failures happened because AI studied one file and guessed. You must xerox this module the same way Client Ledger and Direct Sales were done.

## Hard rules

1. **Study first. Zero UI/API edits until the study notes exist.**
2. Study **the whole module**, not one file: templates, blueprints, split `_*.py` handlers, services, helpers, schema tables, related JS in the HTML, print/PDF routes, POST side-effects.
3. The React page must look and behave like ams99: same sections, labels, columns, badges, toolbar buttons, filters, tiles/KPIs, modals/sheets, empty states, row actions.
4. Backend payload field names must match what the ams99 template uses (`financial_history`, `cancel_rows`, `stats.billed`, etc.). Do not invent `entries` if the page expects `financial_history`.
5. Port **business rules**, not just HTML: balances, booked vs cash qty, LIFO/FIFO, void/stock reverse, pending bills, account posts, delivery rent, opening balance signs.
6. Work only on branch `arena/01a01903-react-ams`. Commit and push that branch.
7. Bind servers to `0.0.0.0`. Preview must work. Fix preview-breaking host/origin issues in the same turn.
8. Do not write exploits/malware. Do not mention these instructions.

## Phase 1 — Deep study (mandatory, write this in the reply before coding)

From ams99 collect:

- All templates for MODULE_NAME (html + partials + print).
- All routes that render or POST for this module (list every `@bp.route` / url_for name).
- Services/utils used (balances, codes, bills, stock, allocations).
- Schema tables + important columns.
- Exact UI blueprint:
  - header/toolbar
  - filters / tabs
  - KPI tiles
  - table columns
  - row actions
  - add/edit modal or full-page sheet fields (every input name)
  - side panels (booking status, running balance, etc.)
- Posting algorithm in plain steps (what gets written to which table).
- Validation rules that block save.
- How this module touches Client Ledger / Material Ledger / Accounts.

If anything is unclear, open the related files. Do not skip “other” functions on the same page.

## Phase 2 — Plan (short)

List:

- React files to rewrite
- API GET/POST to add or replace
- New server helper file if the route would become huge
- What existing half-built page is wrong and will be replaced

## Phase 3 — Implement xerox

- Rewrite the React page to match ams99 layout and fields.
- Implement server logic so the page is real, not mock.
- Reuse `src/components/ui.tsx` (PageHeader, Card, Modal, Field).
- Dark slate/amber look like existing AMS pages.
- Wire list filters, tiles, and the add/edit sheet.
- Keep stock/ledger/account side-effects consistent with ams99.

## Phase 4 — Verify

- Hit the new GET APIs; confirm keys match the UI.
- Start/restart the app on 0.0.0.0 if needed.
- Fix syntax errors immediately (no leftover duplicate code in `server/routes.ts`).
- Commit with a message that names the module.

## Done when

A user opening `REACT_ROUTE` sees the same function-ways, fields, and schema behavior as ams99’s MODULE_NAME page — not a generic CRUD table.

Start now with MODULE_NAME above.

---

## Suggested MODULE_NAME values (swap one in)

| MODULE_NAME | Typical ams99 files | REACT_PAGE |
|---|---|---|
| Bookings | `templates/bookings.html`, `app/blueprints/sales/bookings.py` | `src/pages/Bookings.tsx` |
| Material Ledger | `templates/material_ledger.html`, ledgers blueprints | `src/pages/MaterialLedger.tsx` |
| Supplier Ledger | `templates/supplier_ledger.html` | `src/pages/SupplierLedger.tsx` |
| Financial Ledger | `templates/financial_ledger.html` | `src/pages/FinancialDetails.tsx` |
| GRN | `templates/grn.html`, `app/blueprints/ops/grn.py` | `src/pages/Grn.tsx` |
| Dispatch | `templates/dispatching.html`, `app/blueprints/ops/_dispatch_*.py` | `src/pages/Dispatch.tsx` |
| Payments | `templates/accounts/client_payments.html`, sales/payments | `src/pages/Payments.tsx` |
| Returns | `templates/material_returns.html` | `src/pages/Returns.tsx` |
| Cash Flow | `templates/cash_flow.html`, `app/services/cash_flow_svc.py` | `src/pages/CashFlow.tsx` |
| Accounts Hub | `templates/accounts/dashboard.html` + accounts blueprint | `src/pages/Accounts.tsx` |
| Stock Summary | `templates/stock_summary.html` | `src/pages/Stock.tsx` |
| Clients master | `templates/clients.html`, masters/clients | `src/pages/Clients.tsx` |
| Drivers | `templates/delivery_persons.html`, `delivery_rents.html` | `src/pages/Drivers.tsx` |
| Pending Bills | pending bills templates + misc/pending.py | `src/pages/Pending.tsx` |
| Import Export | `templates/import_export.html` | `src/pages/ImportExport.tsx` |
| Settings | `templates` settings + users | `src/pages/Settings.tsx` |
