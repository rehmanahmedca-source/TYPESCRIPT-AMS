import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Modal } from "../components/ui";
import { money, num } from "../format";
import { useApi } from "../useApi";

type Filters = {
  from: string;
  to: string;
  client_category: string;
  transaction_category: string;
  material_category: string;
  material: string;
  client: string;
  bill: string;
  show: string;
  page: number;
};

type DailyRow = {
  id: number;
  row_key: string;
  kind: "entry" | "payment";
  date: string;
  time: string;
  type: string;
  material: string;
  material_category: string;
  client: string;
  client_code: string;
  client_category: string;
  qty: number | null;
  amount: number | null;
  bill_no: string;
  auto_bill_no: string;
  nimbus_no: string;
  transaction_category: string;
  transaction_type: string;
  created_by: string;
  source_table: string;
  source_id: number;
  note?: string;
  is_void: number;
};

type DailyData = {
  from: string;
  to: string;
  rows: DailyRow[];
  summary: { stockIn: number; stockOut: number; payments: number; netQty: number };
  pagination: { page: number; pageSize: number; total: number; pages: number };
  options: {
    clients: { id: number; code: string; name: string; category: string }[];
    materials: { id: number; code: string; name: string }[];
    clientCategories: string[];
    transactionCategories: string[];
    materialCategories: string[];
  };
};

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function initialFilters(): Filters {
  const date = today();
  return { from: date, to: date, client_category: "", transaction_category: "", material_category: "", material: "", client: "", bill: "", show: "active", page: 1 };
}

function queryString(filters: Filters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "" && value != null) query.set(key, String(value));
  });
  query.set("page_size", "25");
  return query.toString();
}

function Kpi({ tone, label, value, sub, action, icon, to }: { tone: string; label: string; value: string; sub: string; action: string; icon: string; to?: string }) {
  const content = <>
    <div className="daily-kpi-label">{label}</div>
    <div className="daily-kpi-value">{value}</div>
    <div className="daily-kpi-sub">{sub}</div>
    <span className="daily-kpi-action"><i className="bi bi-arrow-right-circle" /> {action}</span>
    <i className={`bi ${icon} daily-kpi-icon`} />
  </>;
  return to ? <Link to={to} className={`daily-kpi ${tone}`}>{content}</Link> : <div className={`daily-kpi ${tone}`}>{content}</div>;
}

export default function Daily() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [selected, setSelected] = useState<DailyRow | null>(null);
  const [message, setMessage] = useState("");
  const path = useMemo(() => `/daily?${queryString(applied)}`, [applied]);
  const { data, loading, error, reload } = useApi<DailyData>(path);
  const summary = data?.summary || { stockIn: 0, stockOut: 0, payments: 0, netQty: 0 };
  const options = data?.options;

  function change<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    setApplied({ ...draft, page: 1 });
  }

  function reset() {
    const fresh = initialFilters();
    setDraft(fresh);
    setApplied(fresh);
    setMessage("");
  }

  function pageTo(page: number) {
    setApplied((current) => ({ ...current, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function voidRow(row: DailyRow) {
    if (!window.confirm(`Delete this ${row.type.toLowerCase()} transaction? This action marks the source record as void.`)) return;
    setMessage("");
    try {
      await api(`/daily/transactions/${row.kind}/${row.id}/void`, { method: "POST" });
      setMessage("Transaction deleted successfully.");
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to delete transaction");
    }
  }

  return (
    <div className="daily-page">
      <section className="daily-heading">
        <div>
          <h1><i className="bi bi-list-task" /> Daily Breakdown</h1>
          <p>{applied.from} → {applied.to}</p>
        </div>
        <div className="daily-heading-actions">
          <Link to="/stock" className="btn btn-warning"><i className="bi bi-graph-up" /> Stock Summary</Link>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}><i className="bi bi-arrow-left" /> Back</button>
        </div>
      </section>

      <form className="daily-filters" onSubmit={apply}>
        <div className="daily-filter-grid">
          <label><span>From</span><input type="date" value={draft.from} onChange={(e) => change("from", e.target.value)} required /></label>
          <label><span>To</span><input type="date" value={draft.to} min={draft.from} onChange={(e) => change("to", e.target.value)} required /></label>
          <label><span>Client Cat</span><select value={draft.client_category} onChange={(e) => change("client_category", e.target.value)}><option value="">All</option>{(options?.clientCategories || []).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Trans Cat</span><select value={draft.transaction_category} onChange={(e) => change("transaction_category", e.target.value)}><option value="">All</option>{(options?.transactionCategories || []).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Material Cat</span><select value={draft.material_category} onChange={(e) => change("material_category", e.target.value)}><option value="">All</option>{(options?.materialCategories || []).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Material</span><select value={draft.material} onChange={(e) => change("material", e.target.value)}><option value="">All</option>{(options?.materials || []).map((value) => <option key={value.id} value={value.name}>{value.name}</option>)}</select></label>
          <label><span>Client</span><input list="daily-clients" value={draft.client} onChange={(e) => change("client", e.target.value)} placeholder="Search name or code..." /><datalist id="daily-clients">{(options?.clients || []).map((value) => <option key={value.id} value={value.name}>{value.code}</option>)}</datalist></label>
          <label><span>Bill #</span><input value={draft.bill} onChange={(e) => change("bill", e.target.value)} placeholder="Manual/auto bill..." /></label>
          <label><span>Show</span><select value={draft.show} onChange={(e) => change("show", e.target.value)}><option value="active">Active</option><option value="void">Deleted</option><option value="all">All</option></select></label>
          <div className="daily-filter-apply"><button className="btn btn-warning"><i className="bi bi-funnel" /> Apply</button></div>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm daily-reset" onClick={reset}><i className="bi bi-arrow-counterclockwise" /> Reset</button>
      </form>

      <section className="daily-kpi-grid">
        <Kpi tone="green" label="Stock In Qty" value={num(summary.stockIn)} sub="Filtered range (entries only)" action="Same filters" icon="bi-arrow-down" />
        <Kpi tone="cyan" label="Stock Out Qty" value={num(summary.stockOut)} sub="Filtered range (entries only)" action="Same filters" icon="bi-box-arrow-up-right" />
        <Kpi tone="violet" label="Payments" value={money(summary.payments)} sub="Included" action="Same filters" icon="bi-cash-stack" />
        <Kpi tone="red" label="Net Qty" value={num(summary.netQty)} sub="In − Out" action="Open stock summary" icon="bi-graph-up-arrow" to="/stock" />
      </section>

      {(error || message) && <div className={`daily-message ${error ? "error" : ""}`}>{error || message}</div>}

      <section className="daily-transactions">
        <div className="daily-table-heading"><h2><i className="bi bi-table" /> Transactions</h2><span>{data?.pagination.total || 0} records</span></div>
        <div className="table-responsive">
          <table>
            <thead><tr><th>Time</th><th>Type</th><th>Client</th><th>Material</th><th>Category</th><th className="text-end">Qty</th><th>Bill No</th><th>Nimbus No</th><th>By</th><th className="text-end">Action</th></tr></thead>
            <tbody>
              {(data?.rows || []).map((row) => (
                <tr key={row.row_key} className={row.is_void ? "void-row" : ""}>
                  <td>{row.time || "—"}</td>
                  <td><span className={`daily-type type-${row.type.toLowerCase()}`}>{row.type}</span></td>
                  <td><strong>{row.client || "—"}</strong>{row.client_code && <small>{row.client_code}</small>}</td>
                  <td><strong>{row.material || "—"}</strong></td>
                  <td>{row.kind === "payment" ? "Payment" : row.material_category || row.transaction_category || "—"}</td>
                  <td className="text-end fw-bold">{row.kind === "payment" ? money(row.amount) : `${row.type === "OUT" || row.type === "CANCEL" ? "−" : "+"}${num(row.qty)}`}</td>
                  <td className="daily-bill">{row.bill_no || row.auto_bill_no || "—"}</td>
                  <td>{row.nimbus_no || row.transaction_type || "—"}</td>
                  <td><strong>{row.created_by || "System"}</strong></td>
                  <td><div className="daily-row-actions">
                    {row.kind === "payment" && <Link to="/payments" className="btn btn-outline-info btn-sm">View Payment</Link>}
                    {!row.is_void && <Link to={row.kind === "payment" ? "/payments" : row.source_table === "grn" ? "/grn" : row.source_table === "material_return" ? "/returns" : "/sales"} className="btn btn-warning btn-sm">Edit</Link>}
                    {!row.is_void && <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => voidRow(row)}>Delete</button>}
                    <button type="button" className="btn btn-outline-secondary btn-sm daily-icon-btn" onClick={() => setSelected(row)} aria-label="View details"><i className="bi bi-receipt" /></button>
                  </div></td>
                </tr>
              ))}
              {!loading && !(data?.rows || []).length && <tr><td colSpan={10} className="text-center text-muted py-5">No transactions match these filters.</td></tr>}
              {loading && <tr><td colSpan={10} className="text-center text-muted py-5"><span className="spinner-border spinner-border-sm me-2" />Loading transactions…</td></tr>}
            </tbody>
          </table>
        </div>
        {(data?.pagination.pages || 1) > 1 && <nav className="daily-pagination" aria-label="Transactions pages">
          <button disabled={data!.pagination.page <= 1} onClick={() => pageTo(data!.pagination.page - 1)}><i className="bi bi-chevron-left" /></button>
          {Array.from({ length: data!.pagination.pages }, (_, index) => index + 1).map((page) => <button key={page} className={page === data!.pagination.page ? "active" : ""} onClick={() => pageTo(page)}>{page}</button>)}
          <button disabled={data!.pagination.page >= data!.pagination.pages} onClick={() => pageTo(data!.pagination.page + 1)}><i className="bi bi-chevron-right" /></button>
        </nav>}
      </section>

      <Modal open={Boolean(selected)} title="Transaction Details" onClose={() => setSelected(null)} footer={<button className="btn btn-outline-secondary" onClick={() => setSelected(null)}>Close</button>}>
        {selected && <dl className="row mb-0 daily-details">
          <dt className="col-5">Date & time</dt><dd className="col-7">{selected.date} {selected.time}</dd>
          <dt className="col-5">Type</dt><dd className="col-7">{selected.type}</dd>
          <dt className="col-5">Client</dt><dd className="col-7">{selected.client || "—"} {selected.client_code ? `(${selected.client_code})` : ""}</dd>
          <dt className="col-5">Material</dt><dd className="col-7">{selected.material || "—"}</dd>
          <dt className="col-5">Quantity / amount</dt><dd className="col-7">{selected.kind === "payment" ? money(selected.amount) : num(selected.qty)}</dd>
          <dt className="col-5">Bill number</dt><dd className="col-7">{selected.bill_no || selected.auto_bill_no || "—"}</dd>
          <dt className="col-5">Transaction source</dt><dd className="col-7">{selected.transaction_type || selected.source_table || "—"}</dd>
          <dt className="col-5">Created by</dt><dd className="col-7">{selected.created_by || "System"}</dd>
          <dt className="col-5">Status</dt><dd className="col-7">{selected.is_void ? "Deleted" : "Active"}</dd>
          {selected.note && <><dt className="col-5">Note</dt><dd className="col-7">{selected.note}</dd></>}
        </dl>}
      </Modal>
    </div>
  );
}
