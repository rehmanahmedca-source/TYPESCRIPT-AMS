# AMS Go

A new Go migration boundary for the TypeScript AMS ERP. It is deliberately isolated in `ams go/`; no existing application files are modified.

## What was reverse-engineered from this checkout

The source app is a React/Vite client with an Express/SQLite service. Its authoritative artifacts are `server/schema.sql`, `server/routes.ts`, `server/auth.ts`, `server/*Core.ts`, `src/pages/`, `AMS99_PARITY_AUDIT_AND_PLAN.md`, and `FORMS_SUMMARY.md`. The domain includes inventory/materials, GRN purchasing, direct sales, bookings/allocations, returns, clients and suppliers, payments, accounts, cash flow, reconciliation, dispatch/drivers, pending bills, reports, imports/exports, settings, sessions, and audit logs.

Important observed rules: money is increasingly represented in integer minor units; sales decrease stock and increase client/account ledgers; GRNs increase stock and supplier payables; payments post to an account and reduce the related party balance; voids are reversible lifecycle states; booking allocations must not exceed booked quantity; idempotency/source links and audit history are required for financial writes.

The repository's parity audit reports 64 legacy tables, 289 reference route decorators, missing auth/permissions in the older baseline, and a need for versioned migrations and indexes. The Go code here is a clean foundation, not a claim that an unverified remote crawl was completed. Do not put credentials in source control.

## Run

Requires Go 1.23+ and PostgreSQL 14+.

```bash
cd "ams go"
export DATABASE_URL='postgres://user:password@localhost:5432/ams?sslmode=disable'
export DEFAULT_ADMIN_PASSWORD='replace-this-before-production'
go mod tidy
go run ./cmd
```

Open `http://localhost:8080`. The first login using username `Admin` bootstraps an admin account from `DEFAULT_ADMIN_PASSWORD` (default retained only for compatibility; override it). Production should provision the user out-of-band and use TLS, a secret manager, and restricted DB credentials.

## Design notes

- PostgreSQL connection pooling is configured through `DB_MAX_OPEN_CONNS` and `DB_MAX_IDLE_CONNS`.
- All new financial amounts use `*_minor BIGINT`; avoid floating point arithmetic.
- `WriteQueue` provides bounded asynchronous audit persistence; business transactions must still be synchronous and transactional.
- `idempotency_key`, `revision`, `source_type`, `source_id`, void metadata, and audit rows are the foundations for safe retries and reversals.
- The schema uses `app_user` rather than the reserved legacy table name `user`; an explicit compatibility migration is required before importing a production AMS99 database.

## Next implementation slices

1. Add a schema manifest/import adapter for all 64 legacy tables and versioned migrations.
2. Port auth permissions and CSRF/session invalidation tests.
3. Implement one complete transaction slice: GRN → stock/FIFO → sale → payment → ledger/audit.
4. Add transactional repositories, request validation, metrics, export contracts, and parity fixtures.
5. Port the remaining routes and templates only after database-state comparisons pass.
