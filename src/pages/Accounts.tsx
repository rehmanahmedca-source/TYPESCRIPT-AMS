import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../components/ui";
import { api } from "../api";
import { rs } from "../format";
import { useApi } from "../useApi";

type Account = {
  id: number;
  name: string;
  category: string;
  account_type: string;
  source_category?: string;
  live_balance?: number;
  balance?: number;
  is_active?: number;
};

type Dash = {
  accounts: Account[];
  client_payments_today: number;
  supplier_payments_today: number;
  expenditures_today: number;
  receipts_today: number;
  totalCash: number;
  totalBank: number;
  totalCompanyMoney: number;
  clients: { id: number; code: string; name: string }[];
  suppliers: { id: number; name: string }[];
  drivers: { id: number; name: string }[];
  categories: { id: number; name: string }[];
};

const QA = [
  ["/accounts/payments/clients", "bi-people-fill", "qa-1", "Client Payments", "Money received from clients"],
  ["/accounts/payments/suppliers", "bi-truck", "qa-2", "Supplier Payments", "Money paid to suppliers"],
  ["/accounts/expenditures", "bi-wallet2", "qa-3", "Expenditures", "Personal & operating expenses"],
  ["/accounts/receipts", "bi-receipt", "qa-4", "Today's Receipts", "All cash inflow today"],
  ["/accounts/accounts", "bi-gear-fill", "qa-5", "Manage Accounts", "Edit accounts & groups"],
  ["/accounts/transfers", "bi-arrow-left-right", "qa-6", "View Transfers", "Inter-account transfers"],
  ["/accounts/transfers/add", "bi-shuffle", "qa-7", "New Transfer", "Move money between accounts"],
  ["/accounts/audit", "bi-shield-check", "qa-5", "Audit Trail", "Every penny across accounts"],
  ["/cash_flow", "bi-water", "qa-7", "Cash Flow", "Record spend/receive; client & supplier money shows as derived"],
  ["/accounts/accounts/add", "bi-plus-circle-fill", "qa-8", "Add Account", "Create a new cash/bank account"]
] as const;

export default function Accounts() {
  const { data, reload, error } = useApi<Dash>("/accounts");
  const [txOpen, setTxOpen] = useState(false);
  const [mode, setMode] = useState<"receive" | "pay">("receive");
  const [saveErr, setSaveErr] = useState("");
  const accounts = data?.accounts || [];
  const clients = data?.clients || [];
  const suppliers = data?.suppliers || [];
  const drivers = data?.drivers || [];

  const nowLocal = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  async function submitTx(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveErr("");
    const fd = new FormData(e.currentTarget);
    try {
      await api("/accounts/transactions", {
        method: "POST",
        body: JSON.stringify({
          tx_mode: mode,
          date_posted: fd.get("date_posted"),
          amount: fd.get("amount"),
          method: fd.get("method"),
          receive_from_category: fd.get("receive_from_category"),
          receive_account_id: fd.get("receive_account_id"),
          client_input: fd.get("client_input"),
          receive_from_account_id: fd.get("receive_from_account_id"),
          receive_source_label: fd.get("receive_source_label"),
          discount: fd.get("discount"),
          pay_from_account_id: fd.get("pay_from_account_id"),
          pay_target: fd.get("pay_target"),
          pay_to_account_id: fd.get("pay_to_account_id"),
          supplier_id: fd.get("supplier_id"),
          supplier_input: fd.get("supplier_input"),
          target_label: fd.get("target_label"),
          client_input_refund: fd.get("client_input_refund"),
          delivery_person_id: fd.get("delivery_person_id"),
          driver_input: fd.get("driver_input"),
          reference: fd.get("reference"),
          note: fd.get("note")
        })
      });
      setTxOpen(false);
      reload();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="acc-page">
      <div className="acc-page-header">
        <div>
          <h2><i className="bi bi-bank2 me-2" />Accounts Dashboard</h2>
          <div className="subtitle">Today's money movement, account balances, and quick actions.</div>
        </div>
        <div className="acc-toolbar">
          <Link to="/cash_flow" className="btn btn-warning text-dark fw-bold"><i className="bi bi-water me-1" /> Cash Flow</Link>
          <Link to="/accounts/accounts" className="btn btn-outline-secondary"><i className="bi bi-gear me-1" /> Manage Accounts</Link>
          <button className="btn btn-primary" type="button" onClick={() => setTxOpen(true)}>
            <i className="bi bi-plus-lg me-1" /> New Transaction
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row mb-4 g-3">
        <div className="col-md-6 col-xl-3">
          <Link to="/accounts/kpi/client_payments" className="card kpi-card kpi-green text-decoration-none">
            <div className="card-body">
              <div className="kpi-label"><i className="bi bi-arrow-down-circle me-1" /> Client Payments Today</div>
              <div className="kpi-value"><small>Rs.</small> {Number(data?.client_payments_today || 0).toFixed(2)}</div>
              <span className="kpi-cta">View details <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-people-fill kpi-icon" />
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/accounts/kpi/supplier_payments" className="card kpi-card kpi-red text-decoration-none">
            <div className="card-body">
              <div className="kpi-label"><i className="bi bi-arrow-up-circle me-1" /> Supplier Payments Today</div>
              <div className="kpi-value"><small>Rs.</small> {Number(data?.supplier_payments_today || 0).toFixed(2)}</div>
              <span className="kpi-cta">View details <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-truck kpi-icon" />
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/accounts/kpi/expenditures" className="card kpi-card kpi-amber text-decoration-none">
            <div className="card-body">
              <div className="kpi-label"><i className="bi bi-cash-stack me-1" /> Expenditures Today</div>
              <div className="kpi-value"><small>Rs.</small> {Number(data?.expenditures_today || 0).toFixed(2)}</div>
              <span className="kpi-cta">View details <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-wallet2 kpi-icon" />
          </Link>
        </div>
        <div className="col-md-6 col-xl-3">
          <Link to="/accounts/kpi/receipts" className="card kpi-card kpi-cyan text-decoration-none">
            <div className="card-body">
              <div className="kpi-label"><i className="bi bi-receipt me-1" /> Receipts Today</div>
              <div className="kpi-value"><small>Rs.</small> {Number(data?.receipts_today || 0).toFixed(2)}</div>
              <span className="kpi-cta">View details <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-file-earmark-text kpi-icon" />
          </Link>
        </div>
        <div className="col-12">
          <Link to="/accounts/kpi/cash_money" className="card kpi-card kpi-violet text-decoration-none">
            <div className="card-body d-md-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="kpi-label"><i className="bi bi-cash me-1" /> Total Cash Available</div>
                <div className="kpi-value"><small>Rs.</small> {Number(data?.totalCash || 0).toFixed(2)}</div>
                <div className="small mt-1" style={{ opacity: 0.85 }}>Sum of all active cash account balances.</div>
              </div>
              <span className="kpi-cta">View cash & bank <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-cash-coin kpi-icon" />
          </Link>
        </div>
        <div className="col-12">
          <Link to="/accounts/kpi/company_money" className="card kpi-card kpi-violet text-decoration-none">
            <div className="card-body d-md-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="kpi-label"><i className="bi bi-bank me-1" /> Total Money Available in Company</div>
                <div className="kpi-value"><small>Rs.</small> {Number(data?.totalCompanyMoney || 0).toFixed(2)}</div>
                <div className="small mt-1" style={{ opacity: 0.85 }}>Sum of all active company account balances.</div>
              </div>
              <span className="kpi-cta">View company accounts <i className="bi bi-arrow-right" /></span>
            </div>
            <i className="bi bi-piggy-bank kpi-icon" />
          </Link>
        </div>
      </div>

      <div className="card acc-section-card">
        <div className="card-header">
          <h5><i className="bi bi-list-columns-reverse me-2 text-info" />Account Balances</h5>
          <Link to="/accounts/accounts" className="btn btn-sm btn-outline-secondary">Manage</Link>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover align-middle acc-table mb-0">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th className="text-end">Balance</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const bal = Number(a.live_balance ?? a.balance ?? 0);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="fw-semibold">{a.name}</div>
                        {a.source_category ? <div className="small text-muted">{a.source_category}</div> : null}
                      </td>
                      <td><span className="badge badge-soft-violet">{a.account_type || "company"}</span></td>
                      <td>
                        {String(a.category).toLowerCase() === "bank" ? (
                          <span className="badge badge-soft-info"><i className="bi bi-bank me-1" />Bank</span>
                        ) : (
                          <span className="badge badge-soft-amber"><i className="bi bi-cash-coin me-1" />Cash</span>
                        )}
                      </td>
                      <td className="text-end">
                        <span className={`acc-balance ${bal < 0 ? "neg" : ""}`}>{rs(bal)}</span>
                      </td>
                      <td className="text-end">
                        <Link className="btn btn-sm btn-outline-primary me-1" to={`/accounts/${a.id}/ledger`}>
                          <i className="bi bi-journal-text me-1" />Ledger
                        </Link>
                        <Link className="btn btn-sm btn-outline-success" to={`/accounts/${a.id}/reconcile`}>
                          Reconcile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!accounts.length && (
                  <tr><td colSpan={5} className="text-center text-muted py-4">No accounts yet. <Link to="/accounts/accounts/add">Add your first account</Link>.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card acc-section-card mt-4">
        <div className="card-header">
          <h5><i className="bi bi-lightning-charge-fill me-2 text-warning" />Quick Actions</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {QA.map(([to, icon, qa, title, sub]) => (
              <div className="col-md-6 col-xl-3" key={title}>
                <Link to={to} className="quick-action">
                  <div className={`qa-icon ${qa}`}><i className={`bi ${icon}`} /></div>
                  <div>
                    <div className="qa-title">{title}</div>
                    <div className="qa-sub">{sub}</div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={txOpen} title="Make New Transaction" onClose={() => setTxOpen(false)} size="lg" footer={
        <button type="submit" form="newTxForm" className="btn btn-primary">Submit Transaction</button>
      }>
        <form id="newTxForm" onSubmit={submitTx}>
          {saveErr && <div className="alert alert-danger py-2">{saveErr}</div>}
          <div className="mb-3">
            <label className="form-label fw-semibold d-block mb-2">Transaction Type</label>
            <div className="row g-2">
              <div className="col-md-6">
                <label className={`card h-100 ${mode === "receive" ? "border-primary" : "border-secondary"}`} style={{ cursor: "pointer" }}>
                  <div className="card-body">
                    <div className="form-check m-0">
                      <input className="form-check-input" type="radio" checked={mode === "receive"} onChange={() => setMode("receive")} />
                      <span className="form-check-label fw-bold">Receive Money</span>
                    </div>
                    <div className="small text-muted mt-2">Record money coming from a client into a company account.</div>
                  </div>
                </label>
              </div>
              <div className="col-md-6">
                <label className={`card h-100 ${mode === "pay" ? "border-primary" : "border-secondary"}`} style={{ cursor: "pointer" }}>
                  <div className="card-body">
                    <div className="form-check m-0">
                      <input className="form-check-input" type="radio" checked={mode === "pay"} onChange={() => setMode("pay")} />
                      <span className="form-check-label fw-bold">Pay Money</span>
                    </div>
                    <div className="small text-muted mt-2">Record company transfers, supplier payments, and expenses.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Posted Date</label>
              <input type="datetime-local" className="form-control" name="date_posted" defaultValue={nowLocal} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Amount</label>
              <input type="number" step="0.01" min="0" className="form-control" name="amount" required />
            </div>
            <div className="col-md-6">
              <label className="form-label">Method</label>
              <select className="form-select" name="method">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Check">Check</option>
                <option value="Online">Online</option>
              </select>
            </div>
          </div>

          {mode === "receive" ? (
            <div className="mt-4">
              <h6 className="fw-bold">Receive Money Details</h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Receive From Transaction Group</label>
                  <select className="form-select" name="receive_from_category" defaultValue="client_ledger">
                    <option value="client_ledger">Client Ledger</option>
                    {(data?.categories || []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="other_source">Other Source</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Receive To Account</label>
                  <select className="form-select" name="receive_account_id">
                    <option value="">Select company account receiving this payment</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rs(a.live_balance ?? a.balance)})</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Receive From Client</label>
                  <input className="form-control" name="client_input" list="txClients" placeholder="Search by client name or code" />
                  <datalist id="txClients">
                    {clients.map((c) => <option key={c.id} value={`${c.code} ${c.name}`} />)}
                  </datalist>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Discount / Waive-Off</label>
                  <input type="number" step="0.01" min="0" className="form-control" name="discount" defaultValue={0} />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <h6 className="fw-bold">Pay Money Details</h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Pay From Account</label>
                  <select className="form-select" name="pay_from_account_id">
                    <option value="">Select source account</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({rs(a.live_balance ?? a.balance)})</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Pay Target</label>
                  <select className="form-select" name="pay_target" defaultValue="company_transfer">
                    <option value="company_transfer">Company Account Transfer</option>
                    <option value="supplier">Supplier Payment</option>
                    <option value="driver">Driver Service Payment</option>
                    <option value="client_refund">Client Refund</option>
                    <option value="loan">Loan Payment</option>
                    <option value="personal_expense">Personal Expense</option>
                    <option value="other_expense">Other Expense</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Pay To Account</label>
                  <select className="form-select" name="pay_to_account_id">
                    <option value="">Select destination account</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Supplier</label>
                  <input type="hidden" name="supplier_id" />
                  <input className="form-control" name="supplier_input" list="txSuppliers" placeholder="Search supplier" />
                  <datalist id="txSuppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Purpose / Target Label</label>
                  <input className="form-control" name="target_label" placeholder="e.g. Office rent, Loan installment" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Driver / Delivery Person</label>
                  <input className="form-control" name="driver_input" list="txDrivers" placeholder="Search driver" />
                  <datalist id="txDrivers">{drivers.map((d) => <option key={d.id} value={d.name} />)}</datalist>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Reference</label>
                  <input className="form-control" name="reference" placeholder="Voucher / slip no." />
                </div>
              </div>
            </div>
          )}
          <div className="mt-3">
            <label className="form-label">Note</label>
            <textarea className="form-control" name="note" rows={2} placeholder="Optional note" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
