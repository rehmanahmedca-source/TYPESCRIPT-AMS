# AMS ERP (TypeScript)

Ahmed Material System rebuilt from [ams99](https://github.com/rehmanahmedca-source/ams99) in **TypeScript + React**.

## What changed

- Flask / Jinja replaced with Express + React (TypeScript)
- **Same SQLite schema** (`instance/ahmed_cement.db`) — table names and columns match ams99
- **Same XLSX contract** — master workbook sheets plus full-raw one-sheet-per-table
- **No loading overlays, spinners, or blocking progress modals** — navigation is instant SPA, imports report inline

## Run

```bash
npm install
npm run dev
```

App binds `0.0.0.0:3000`.

Default admin (seeded on empty DB): `Admin` / `Admin@fbm12345`

## Database

SQLite file: `instance/ahmed_cement.db`

Schema is copied from the Flask models (`client`, `material`, `direct_sale`, `booking`, `grn`, `payment`, `account`, `entry`, …).

You can also drop a full-raw XLSX from ams99 onto **Import & Export**.

## Modules

Dashboard, stock, materials, GRN, daily breakdown, sales, bookings, returns, dispatch, drivers, clients/ledgers, suppliers/ledgers, payments, pending bills, accounts, cash flow, reconciliation, reports, XLSX import/export, settings.
