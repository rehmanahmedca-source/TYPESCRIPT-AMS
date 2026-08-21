# Reverse-engineering notes

## Evidence inspected

- `README.md`: React/Vite + Express + SQLite deployment, default Admin compatibility login, modules and import/export contract.
- `server/schema.sql`: legacy accounting/inventory schema, including accounts, account transactions, cash flow, GRNs, sales, bookings, allocations, payments, ledgers, imports, reminders, users, sessions, and audit records.
- `server/routes.ts`: active HTTP API registration.
- `server/auth.ts`: session cookie `ams_session`, CSRF cookie/token, 14-day sessions, role/permission prefixes, login/logout, password migration.
- `server/*Core.ts` and `server/services.ts`: transaction domain services and posting rules.
- `src/pages/`: visible workflows and forms.
- `AMS99_PARITY_AUDIT_AND_PLAN.md` and `FORMS_SUMMARY.md`: known parity gaps and acceptance checklist.

## Domain map

| Area | Main records | Key state changes |
|---|---|---|
| Master data | `material`, `client`, `supplier`, `delivery_person`, `account` | create/edit/activate/deactivate, opening balances |
| Receiving | `grn`, `grn_item` | stock in, supplier payable, payment/account posting, void/reversal |
| Sales | `direct_sale`, `direct_sale_item`, `entry` | stock out, client debit, receipt, delivery/rent, void/reversal |
| Bookings | `booking`, `booking_item`, `booking_allocation` | reserved quantity, advance payment, partial dispatch, cancellation |
| Payments | `payment`, `supplier_payment`, `delivery_person_payment` | party balance reduction, account out/in, idempotent retry, void |
| Accounting | `account_transaction`, `cash_flow_entry`, `account_reconciliation` | cash/bank movement, transfers, reconciliation adjustment |
| Operations | `delivery`, `sale_delivery_persons`, `delivery_rent`, `material_return` | dispatch, driver settlement, returns and stock in |
| Controls | `user`, `user_login_session`, `audit_log`, `accounting_audit_log` | auth, permissions, sessions, actor-attributed audit |

## Invariants to preserve

1. Never calculate new monetary values with floating point; use minor units.
2. A booking allocation cannot exceed remaining booked quantity.
3. A void changes lifecycle state and creates a traceable reversal/audit event; it must not silently delete financial history.
4. Every cash/bank posting is tied to an account and a source/idempotency key.
5. Related party balances, stock, account balances, and ledger entries change atomically.
6. Mutations require an authenticated active user, permission, and CSRF protection for cookie sessions.
7. Import must be dependency ordered, validated, backed up, and safe to retry.

## Scope boundary

The supplied target URL was not treated as a source of truth in this offline repository task. This document records code-and-artifact findings only; credentials from the prompt are not copied into the Go source. The new application is an isolated foundation and must be completed through parity fixtures before production cutover.
