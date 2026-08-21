import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api, downloadUrl } from "../api";
import { money, ymd } from "../format";

type Acc = { id: number; name: string; category: string; live_balance?: number; balance?: number; note?: string; bank_name?: string; account_number?: string };
type Cat = { id: number; name: string; direction: string; notes?: string; is_active: number };
type Sub = { id: number; name: string; category_id: number; category_name?: string; notes?: string; is_active: number };
type Party = { id: number; name: string; party_type: string; note?: string; is_active: number };
type Row = {
  date: string; type: string; tx_type_label: string; cash_in: number; cash_out: number; transfer_amount: number;
  account_display: string; category: string; subcategory: string; party_name: string; party_type: string;
  description: string; note: string; reference: string; source: string; origin_label: string; created_by: string;
  status: string; entry_id?: number; running_balance: number; amount: number;
};
type AnyRow = Record<string, unknown>;

type Payload = {
  from_date: string; to_date: string; today_str: string; yesterday_str: string; this_week_str: string; this_month_str: string; last_30_days_str: string;
  generated_at: string; default_movement_datetime: string; rows: Row[];
  opening_balance: number; closing_balance: number; adjusted_closing_balance: number;
  physical_cash_available: number | null; reconciliation_reason: string; adjustment_date_input: string; show_delete_button: boolean;
  today_opening_override: number | null; is_fresh_start_view: boolean;
  cash_accounts: Acc[]; cash_accounts_list: Acc[]; bank_accounts_list: Acc[]; cash_total: number; bank_total: number;
  account_activity: Record<number, { in: number; out: number }>;
  cf_categories: Cat[]; cf_subcategories: Sub[]; cf_parties: Party[]; cf_parties_all: Party[];
  party_types: [string, string][]; used_category_ids: number[]; used_subcategory_ids: number[]; used_party_ids: number[];
  created_by_options: string[]; source_options: [string, string][];
  total_cash_in: number; total_cash_out: number; total_transfer_in: number;
  breakdown_cat: Record<string, { in: number; out: number }>; breakdown_party: Record<string, { in: number; out: number }>; breakdown_account: Record<string, { in: number; out: number }>;
};

const TABS = [
  ["financial", "bi-graph-up", "Financial Details", "Balances & totals"],
  ["transaction", "bi-plus-circle", "New Transaction", "Receive · Spend · Transfer"],
  ["transactions", "bi-table", "Transactions", "Filter & ledger"],
  ["reconcile", "bi-check2-circle", "Daily Reconciliations", "Physical cash count"],
  ["master", "bi-sliders2", "Master Data", "Categories & parties"]
] as const;

function qs(f: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default function CashFlow() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("financial");
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [filters, setFilters] = useState({ from_date: "", to_date: "", filter_type: "all", origin: "all", account_id: "", status: "active", category: "", subcategory: "", party_type: "", party: "", notes: "", description: "", reference: "", amount_min: "", amount_max: "", created_by: "", q: "" });
  const [dir, setDir] = useState<"in" | "out" | "transfer">("in");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [catId, setCatId] = useState("");
  const [catName, setCatName] = useState("");
  const [subId, setSubId] = useState("");
  const [subName, setSubName] = useState("");
  const [partyType, setPartyType] = useState("person");
  const [partyId, setPartyId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [posted, setPosted] = useState("");
  const [editId, setEditId] = useState("");
  const [editReason, setEditReason] = useState("");
  const [view, setView] = useState<AnyRow | null>(null);
  const [openCash, setOpenCash] = useState(false);
  const [openBank, setOpenBank] = useState(false);
  const [physical, setPhysical] = useState("");
  const [reconReason, setReconReason] = useState("");
  const [quickCat, setQuickCat] = useState(false);
  const [quickSub, setQuickSub] = useState(false);
  const [quickParty, setQuickParty] = useState(false);
  const [openingOverride, setOpeningOverride] = useState("");

  async function load(f = filters) {
    setErr("");
    try {
      const d = await api<Payload>(`/cash_flow${qs(f)}`);
      setData(d);
      if (!f.from_date) setFilters((p) => ({ ...p, from_date: d.from_date, to_date: d.to_date }));
      if (!posted) setPosted(d.default_movement_datetime);
      if (d.physical_cash_available != null) setPhysical(String(d.physical_cash_available));
      setReconReason(d.reconciliation_reason || "");
      setOpeningOverride(d.today_opening_override != null ? String(d.today_opening_override) : "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const accounts = data?.cash_accounts || [];
  const cats = (data?.cf_categories || []).filter((c) => c.is_active !== 0 && (c.direction === "both" || c.direction === dir || dir === "transfer"));
  const subs = (data?.cf_subcategories || []).filter((s) => s.is_active !== 0 && (!catId || Number(s.category_id) === Number(catId)));
  const parties = data?.cf_parties || [];
  const closing = Number(data?.closing_balance || 0);
  const physNum = physical === "" ? null : Number(physical);
  const diff = physNum == null || Number.isNaN(physNum) ? 0 : physNum - closing;

  async function postTx(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api("/cash_flow", {
        method: "POST",
        body: JSON.stringify({
          action: editId ? "edit_entry" : "record_movement",
          entry_id: editId || undefined,
          direction: dir,
          amount,
          cash_account_id: accountId,
          to_account_id: toAccountId,
          category_id: catId,
          category_name: catName,
          subcategory_id: subId,
          subcategory_name: subName,
          party_type: partyType,
          party_id: partyId,
          party_name: partyName,
          description,
          movement_note: note,
          reference,
          movement_date: posted,
          edit_reason: editReason,
          idempotency_key: editId ? undefined : `cf-${Date.now()}-${Math.random().toString(16).slice(2)}`
        })
      });
      resetForm();
      await load();
      setTab("transactions");
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  function resetForm() {
    setDir("in"); setAmount(""); setAccountId(""); setToAccountId(""); setCatId(""); setCatName(""); setSubId(""); setSubName("");
    setPartyId(""); setPartyName(""); setDescription(""); setNote(""); setReference(""); setEditId(""); setEditReason("");
  }

  async function startEdit(id: number) {
    const d = await api<AnyRow>(`/cash_flow/entry/${id}`);
    setEditId(String(id));
    setDir((d.direction as "in" | "out" | "transfer") || "in");
    setAmount(String(d.amount || ""));
    setAccountId(String(d.account_id || ""));
    setToAccountId(String(d.destination_account_id || ""));
    setCatId(String(d.category_id || ""));
    setCatName(String(d.category_name || ""));
    setSubId(String(d.subcategory_id || ""));
    setSubName(String(d.subcategory_name || ""));
    setPartyType(String(d.party_type || "other"));
    setPartyId(String(d.party_id || ""));
    setPartyName(String(d.party_name || ""));
    setDescription(String(d.description || ""));
    setNote(String(d.note || ""));
    setReference(String(d.reference || ""));
    setPosted(String(d.date_posted || "").slice(0, 16));
    setTab("transaction");
  }

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setErr("");
    try {
      await api("/cash_flow", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      await load();
    } catch (er) {
      setErr(er instanceof Error ? er.message : String(er));
    }
  }

  const saveCls = dir === "in" ? "cf-save-in" : dir === "out" ? "cf-save-out" : "cf-save-transfer";
  const saveLabel = editId ? (dir === "in" ? "Update Received" : dir === "out" ? "Update Spent" : "Update Transfer") : (dir === "in" ? "Post Received" : dir === "out" ? "Post Spent" : "Post Transfer");
  const fromAcc = accounts.find((a) => String(a.id) === accountId);
  const toAcc = accounts.find((a) => String(a.id) === toAccountId);

  const preset = (from: string, to: string) => {
    const next = { ...filters, from_date: from, to_date: to };
    setFilters(next);
    load(next);
  };

  const filterForm = useMemo(() => filters, [filters]);

  return (
    <div className="cf-page">
      <PageHeader icon="bi-water" title="Cash Flow" subtitle="A transaction engine. Categories and sub-categories are yours to create — nothing is hard-coded. Company accounts come from Accounts.">
        <Link to="/accounts" className="btn btn-outline-info btn-pill fw-bold"><i className="bi bi-bank2 me-1" /> Open Accounts</Link>
        <Link to="/accounts/accounts" className="btn btn-outline-secondary btn-pill fw-bold"><i className="bi bi-gear me-1" /> Manage Accounts</Link>
        <button className="btn btn-outline-secondary btn-pill fw-bold" onClick={() => downloadUrl(`/cash_flow/export.csv${qs(filters)}`)}><i className="bi bi-download me-1" /> CSV</button>
        <button className="btn btn-outline-secondary btn-pill fw-bold" onClick={() => window.print()}><i className="bi bi-file-earmark-pdf me-1" /> PDF</button>
        <Link to="/cash_flow_differences" className="btn btn-outline-secondary btn-pill fw-bold"><i className="bi bi-clock-history me-1" /> Differences</Link>
      </PageHeader>
      {err && <div className="alert alert-danger py-2">{err}</div>}

      <nav className="cf-tabs d-print-none" role="tablist">
        {TABS.map(([id, icon, title, sub]) => (
          <button key={id} type="button" className={`cf-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            <span className="cf-tab-ico"><i className={`bi ${icon}`} /></span>
            <span><span className="cf-tab-title">{title}</span><span className="cf-tab-sub">{sub}</span></span>
          </button>
        ))}
      </nav>

      {tab === "financial" && (
        <section>
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className={`cf-money-card ${openCash ? "open" : ""}`}>
                <button type="button" className="cf-money-head" onClick={() => setOpenCash(!openCash)}>
                  <span className="cf-money-ico" style={{ ["--mc" as string]: "#16a34a" }}><i className="bi bi-cash-stack" /></span>
                  <span className="cf-money-text"><span className="cf-money-label">Cash Amount (in hand)</span><span className="cf-money-value">{money(data?.cash_total)}</span></span>
                  <span className="cf-money-count">{data?.cash_accounts_list.length || 0} accounts</span>
                  <i className="bi bi-chevron-down cf-money-chev" />
                </button>
                <div className="cf-money-detail">
                  <table className="ui-table mb-0">
                    <thead><tr><th>Cash account</th><th className="text-end">Period in</th><th className="text-end">Period out</th><th className="text-end">Balance</th><th /></tr></thead>
                    <tbody>
                      {(data?.cash_accounts_list || []).map((a) => {
                        const act = data?.account_activity?.[a.id] || { in: 0, out: 0 };
                        return (
                          <tr key={a.id}>
                            <td className="fw-semibold">{a.name}</td>
                            <td className="text-end text-success">{act.in ? money(act.in) : "—"}</td>
                            <td className="text-end text-danger">{act.out ? money(act.out) : "—"}</td>
                            <td className="text-end fw-bold">{money(a.live_balance ?? a.balance)}</td>
                            <td className="text-end"><Link className="small" to={`/accounts/${a.id}/ledger`}>Ledger</Link></td>
                          </tr>
                        );
                      })}
                      {!data?.cash_accounts_list?.length && <tr><td colSpan={5} className="ui-empty">No cash (in-hand) accounts yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className={`cf-money-card ${openBank ? "open" : ""}`}>
                <button type="button" className="cf-money-head" onClick={() => setOpenBank(!openBank)}>
                  <span className="cf-money-ico" style={{ ["--mc" as string]: "#2563eb" }}><i className="bi bi-bank2" /></span>
                  <span className="cf-money-text"><span className="cf-money-label">Bank Amount</span><span className="cf-money-value">{money(data?.bank_total)}</span></span>
                  <span className="cf-money-count">{data?.bank_accounts_list.length || 0} accounts</span>
                  <i className="bi bi-chevron-down cf-money-chev" />
                </button>
                <div className="cf-money-detail">
                  <table className="ui-table mb-0">
                    <thead><tr><th>Bank account</th><th>Bank / details</th><th className="text-end">Period in</th><th className="text-end">Period out</th><th className="text-end">Balance</th></tr></thead>
                    <tbody>
                      {(data?.bank_accounts_list || []).map((a) => {
                        const act = data?.account_activity?.[a.id] || { in: 0, out: 0 };
                        return (
                          <tr key={a.id}>
                            <td className="fw-semibold">{a.name}</td>
                            <td className="small text-muted">{a.bank_name} {a.account_number}</td>
                            <td className="text-end text-success">{act.in ? money(act.in) : "—"}</td>
                            <td className="text-end text-danger">{act.out ? money(act.out) : "—"}</td>
                            <td className="text-end fw-bold">{money(a.live_balance ?? a.balance)}</td>
                          </tr>
                        );
                      })}
                      {!data?.bank_accounts_list?.length && <tr><td colSpan={5} className="ui-empty">No bank accounts yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="row g-3 mb-4">
            <div className="col-md-4"><div className="ui-card h-100" style={{ borderLeft: "4px solid #16a34a" }}><div className="ui-card-body"><div className="fw-bold text-success mb-1"><i className="bi bi-arrow-down-right me-1" /> Received [ IN ]</div><div className="small text-muted">Money into a company account. Client payments from Accounts also appear automatically as system rows.</div></div></div></div>
            <div className="col-md-4"><div className="ui-card h-100" style={{ borderLeft: "4px solid #dc2626" }}><div className="ui-card-body"><div className="fw-bold text-danger mb-1"><i className="bi bi-arrow-up-right me-1" /> Spent [ OUT ]</div><div className="small text-muted">Money out of a company account. Supplier payments from Accounts also appear automatically.</div></div></div></div>
            <div className="col-md-4"><div className="ui-card h-100" style={{ borderLeft: "4px solid #2563eb" }}><div className="ui-card-body"><div className="fw-bold text-primary mb-1"><i className="bi bi-arrow-left-right me-1" /> Transfer [ INTERNAL ]</div><div className="small text-muted">Account to account transfer. Not income and not expense. Company-wide totals ignore transfers.</div></div></div></div>
          </div>
          <div className="ui-kpi-grid mb-4">
            <div className="ui-tile" style={{ borderLeft: "4px solid #6366f1" }}><div className="ui-tile-label">Opening Balance</div><div className="ui-tile-value">{money(data?.opening_balance)}</div><div className="ui-tile-sub">Start of period</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #16a34a" }}><div className="ui-tile-label">Total Received [ IN ]</div><div className="ui-tile-value text-success">{money(data?.total_cash_in)}</div><div className="ui-tile-sub">{data?.from_date} — {data?.to_date}</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #dc2626" }}><div className="ui-tile-label">Total Spent [ OUT ]</div><div className="ui-tile-value text-danger">{money(data?.total_cash_out)}</div><div className="ui-tile-sub">{data?.from_date} — {data?.to_date}</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #0369a1" }}><div className="ui-tile-label">Closing Balance</div><div className="ui-tile-value">{money(data?.closing_balance)}</div><div className="ui-tile-sub">Opening + received − spent</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #0ea5e9" }}><div className="ui-tile-label">Transfers</div><div className="ui-tile-value">{money(data?.total_transfer_in)}</div><div className="ui-tile-sub">Not income or expense</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #f97316" }}><div className="ui-tile-label">Physical Cash</div><div className="ui-tile-value">{data?.physical_cash_available != null ? money(data.physical_cash_available) : "—"}</div><div className="ui-tile-sub">Reconciliation for {data?.adjustment_date_input}</div></div>
            <div className="ui-tile" style={{ borderLeft: "4px solid #0f766e" }}><div className="ui-tile-label">Next Day Opening</div><div className="ui-tile-value">{money(data?.adjusted_closing_balance)}</div><div className="ui-tile-sub">Carry-forward to next period</div></div>
          </div>
          {data?.is_fresh_start_view && (
            <Card title="Today opening override (display only — source accounts are not changed)">
              <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); doAction("set_opening_override", { today_opening_override: openingOverride }); }}>
                <div className="col-md-3"><label className="ui-label">Today opening override</label><input type="number" step="0.01" className="form-control" value={openingOverride} onChange={(e) => setOpeningOverride(e.target.value)} /></div>
                <div className="col-auto"><button className="btn btn-outline-warning fw-bold" type="submit">Set override</button></div>
                <div className="col-auto"><button type="button" className="btn btn-outline-secondary" onClick={() => doAction("clear_opening_override")}>Clear</button></div>
                <div className="col-auto"><button type="button" className="btn btn-outline-danger" onClick={() => doAction("reset_fresh_start")}>Reset fresh start</button></div>
              </form>
            </Card>
          )}
          <div className="row g-3">
            {([
              ["Breakdown by category", data?.breakdown_cat],
              ["Breakdown by party", data?.breakdown_party],
              ["Breakdown by account", data?.breakdown_account]
            ] as const).map(([title, map]) => (
              <div className="col-md-4" key={title}>
                <Card title={title} flush>
                  <table className="ui-table mb-0">
                    <thead><tr><th>Name</th><th className="text-end">In</th><th className="text-end">Out</th></tr></thead>
                    <tbody>
                      {Object.entries(map || {}).map(([name, tot]) => (
                        <tr key={name}><td>{name}</td><td className="text-end text-success">{money(tot.in)}</td><td className="text-end text-danger">{money(tot.out)}</td></tr>
                      ))}
                      {!Object.keys(map || {}).length && <tr><td colSpan={3} className="ui-empty">No records</td></tr>}
                    </tbody>
                  </table>
                </Card>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "transaction" && (
        <Card title="Post a cash-flow transaction">
          <div className="small text-muted mb-3">Date & time default to today. Do not re-enter client or supplier payments — those sync automatically from Accounts.</div>
          <form className="row g-3" onSubmit={postTx}>
            <div className="col-12">
              <div className="cf-dir-tabs">
                <button type="button" className={`cf-dir-tab ${dir === "in" ? "active-in" : ""}`} onClick={() => setDir("in")}><i className="bi bi-arrow-down-right fs-5" /> RECEIPT [ IN ]</button>
                <button type="button" className={`cf-dir-tab ${dir === "out" ? "active-out" : ""}`} onClick={() => setDir("out")}><i className="bi bi-arrow-up-right fs-5" /> PAYMENT [ OUT ]</button>
                <button type="button" className={`cf-dir-tab ${dir === "transfer" ? "active-transfer" : ""}`} onClick={() => setDir("transfer")}><i className="bi bi-arrow-left-right fs-5" /> TRANSFER [ INTERNAL ]</button>
              </div>
            </div>
            <div className="col-md-4">
              <label className="ui-label">Date & time</label>
              <input type="datetime-local" className="form-control" value={posted} onChange={(e) => setPosted(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="ui-label">Amount (Rs.) *</label>
              <input type="number" step="0.01" min="0.01" className="form-control cf-amount-box" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="ui-label">{dir === "in" ? "Received into account" : dir === "out" ? "Spent from account" : "Transfer from account"} *</label>
              <select className="form-select" required value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select from Accounts…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {String(a.category || "cash").toUpperCase()} · {money(a.live_balance ?? a.balance)}</option>)}
              </select>
            </div>
            {dir === "transfer" && (
              <>
                <div className="col-md-6">
                  <label className="ui-label">Transfer to account *</label>
                  <select className="form-select" required value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                    <option value="">Select destination account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <div className="cf-xfer-box d-flex justify-content-between align-items-center">
                    <div>
                      <div className="small text-uppercase fw-bold text-primary">Internal Fund Transfer Direction</div>
                      <div className="fw-semibold">{fromAcc?.name || "Source Account"} ➔ {toAcc?.name || "Destination Account"}</div>
                    </div>
                    <div className="fw-bold font-monospace fs-5 text-primary">{money(amount)}</div>
                  </div>
                </div>
              </>
            )}
            {dir !== "transfer" && (
              <>
                <div className="col-md-5">
                  <div className="d-flex justify-content-between"><label className="ui-label mb-0">Category *</label><button type="button" className="btn btn-link btn-sm py-0" onClick={() => setQuickCat(!quickCat)}>+ Add category</button></div>
                  <select className="form-select" value={catId} onChange={(e) => { setCatId(e.target.value); const c = cats.find((x) => String(x.id) === e.target.value); setCatName(c?.name || ""); setSubId(""); setSubName(""); }}>
                    <option value="">Search or select category…</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.direction})</option>)}
                  </select>
                  {!catId && <input className="form-control mt-1" placeholder="Or type a new category" value={catName} onChange={(e) => setCatName(e.target.value)} />}
                  {quickCat && (
                    <div className="cf-quick mt-2">
                      <QuickAdd label="Category" onSave={async (name, extra) => { const r = await api<{ category: Cat }>("/cash_flow/categories", { method: "POST", body: JSON.stringify({ name, direction: extra || dir }) }); setCatId(String(r.category.id)); setCatName(r.category.name); setQuickCat(false); load(); }} extraOptions={[["both", "Received & Spent"], ["in", "Received only"], ["out", "Spent only"]]} />
                    </div>
                  )}
                </div>
                <div className="col-md-3">
                  <div className="d-flex justify-content-between"><label className="ui-label mb-0">Sub-category</label><button type="button" className="btn btn-link btn-sm py-0" onClick={() => setQuickSub(!quickSub)}>+ Add sub</button></div>
                  <select className="form-select" value={subId} onChange={(e) => { setSubId(e.target.value); setSubName(subs.find((s) => String(s.id) === e.target.value)?.name || ""); }}>
                    <option value="">Select sub-category…</option>
                    {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {quickSub && (
                    <div className="cf-quick mt-2">
                      <QuickAdd label="Sub-category" onSave={async (name) => { const r = await api<{ subcategory: Sub }>("/cash_flow/subcategories", { method: "POST", body: JSON.stringify({ category_id: catId, category_name: catName, name }) }); setSubId(String(r.subcategory.id)); setSubName(r.subcategory.name); setQuickSub(false); load(); }} />
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="ui-label">Who / Party Type</label>
                  <select className="form-select" value={partyType} onChange={(e) => setPartyType(e.target.value)}>
                    {(data?.party_types || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="col-md-8">
                  <div className="d-flex justify-content-between"><label className="ui-label mb-0">{dir === "in" ? "Who / Source Name" : "Who / Recipient Name"}</label><button type="button" className="btn btn-link btn-sm py-0" onClick={() => setQuickParty(!quickParty)}>+ Add party</button></div>
                  <input className="form-control" list="cfParties" value={partyName} onChange={(e) => { setPartyName(e.target.value); const p = parties.find((x) => x.name === e.target.value); setPartyId(p ? String(p.id) : ""); }} placeholder="Person, workshop, driver, lender…" />
                  <datalist id="cfParties">{parties.map((p) => <option key={p.id} value={p.name} />)}</datalist>
                  {quickParty && (
                    <div className="cf-quick mt-2">
                      <QuickAdd label="Party" onSave={async (name, extra) => { const r = await api<{ party: Party }>("/cash_flow/parties", { method: "POST", body: JSON.stringify({ name, party_type: extra || partyType }) }); setPartyId(String(r.party.id)); setPartyName(r.party.name); setQuickParty(false); load(); }} extraOptions={data?.party_types || []} />
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="col-md-4"><label className="ui-label">Detail / description</label><input className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="col-md-4"><label className="ui-label">Notes</label><input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="col-md-2"><label className="ui-label">Reference</label><input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            {editId && <div className="col-md-2"><label className="ui-label text-warning">Edit reason</label><input className="form-control border-warning" value={editReason} onChange={(e) => setEditReason(e.target.value)} /></div>}
            <div className="col-12 d-flex gap-2">
              <button className={`btn fw-bold px-4 py-2 ${saveCls}`} type="submit"><i className="bi bi-check-circle-fill me-1" /> {saveLabel}</button>
              {editId && <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Cancel edit</button>}
            </div>
          </form>
        </Card>
      )}

      {tab === "transactions" && (
        <>
          <Card title="Filters">
            <div className="d-flex flex-wrap gap-1 mb-3 align-items-center pb-2 border-bottom">
              <span className="small text-muted fw-bold me-2">Date Presets:</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => preset(data?.today_str || "", data?.today_str || "")}>Today</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => preset(data?.yesterday_str || "", data?.yesterday_str || "")}>Yesterday</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => preset(data?.this_week_str || "", data?.today_str || "")}>This Week</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => preset(data?.this_month_str || "", data?.today_str || "")}>This Month</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => preset(data?.last_30_days_str || "", data?.today_str || "")}>Last 30 Days</button>
              <button className="btn btn-sm btn-link ms-auto" onClick={() => { const n = { ...filterForm, from_date: data?.today_str || "", to_date: data?.today_str || "", filter_type: "all", origin: "all", account_id: "", status: "active", category: "", subcategory: "", party_type: "", party: "", notes: "", description: "", reference: "", amount_min: "", amount_max: "", created_by: "", q: "" }; setFilters(n); load(n); }}>Reset all filters</button>
            </div>
            <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); load(filters); }}>
              {([
                ["from_date", "From", "date"], ["to_date", "To", "date"]
              ] as const).map(([k, lab, t]) => (
                <div className="col-md-2" key={k}><label className="ui-label">{lab}</label><input type={t} className="form-control form-control-sm" value={(filters as Record<string, string>)[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></div>
              ))}
              <div className="col-md-2"><label className="ui-label">Type</label><select className="form-select form-select-sm" value={filters.filter_type} onChange={(e) => setFilters({ ...filters, filter_type: e.target.value })}><option value="all">All Directions</option><option value="cash_in">Received [ IN ]</option><option value="cash_out">Spent [ OUT ]</option><option value="transfer">Transfer [ INTERNAL ]</option></select></div>
              <div className="col-md-2"><label className="ui-label">Source</label><select className="form-select form-select-sm" value={filters.origin} onChange={(e) => setFilters({ ...filters, origin: e.target.value })}>{(data?.source_options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="col-md-2"><label className="ui-label">Account</label><select className="form-select form-select-sm" value={filters.account_id} onChange={(e) => setFilters({ ...filters, account_id: e.target.value })}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div className="col-md-2"><label className="ui-label">Status</label><select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="active">Active</option><option value="voided">Voided</option><option value="all">All</option></select></div>
              {(["category", "subcategory", "party", "notes", "description", "reference", "amount_min", "amount_max", "q"] as const).map((k) => (
                <div className="col-md-2" key={k}><label className="ui-label">{k.replace("_", " ")}</label><input className="form-control form-control-sm" value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></div>
              ))}
              <div className="col-md-4 d-flex gap-2"><button className="btn btn-warning btn-sm fw-bold flex-grow-1" type="submit">Apply Filters</button></div>
            </form>
          </Card>
          <Card title={`Cash Flow Transactions — ${data?.rows.length || 0} records`} flush>
            <div className="table-responsive">
              <table className="ui-table mb-0">
                <thead><tr><th>Date</th><th>Type</th><th>Source</th><th>Account</th><th>Category</th><th>Sub</th><th>Party</th><th>Description</th><th>Notes</th><th>Reference</th><th className="text-end">Received</th><th className="text-end">Spent</th><th className="text-end">Transfer</th><th className="text-end">Running</th><th>Actions</th></tr></thead>
                <tbody>
                  {(data?.rows || []).map((r, i) => (
                    <tr key={`${r.entry_id || r.reference}-${i}`} className={r.status === "voided" ? "text-muted" : ""}>
                      <td className="small">{ymd(r.date)}</td>
                      <td>{r.type === "in" ? <span className="badge bg-success">Received</span> : r.type === "out" ? <span className="badge bg-danger">Spent</span> : <span className="badge bg-primary">Transfer</span>}</td>
                      <td>{r.source === "MANUAL" ? <span className="badge bg-warning text-dark">Manual</span> : <span className="badge bg-secondary">System</span>}<div className="small text-muted">{r.origin_label}</div></td>
                      <td className="fw-semibold">{r.account_display}</td>
                      <td>{r.category || "—"}</td>
                      <td>{r.subcategory || "—"}</td>
                      <td>{r.party_name || "—"}</td>
                      <td>{r.description}</td>
                      <td>{r.note || "—"}</td>
                      <td><code>{r.reference}</code></td>
                      <td className="text-end text-success">{r.cash_in ? money(r.cash_in) : ""}</td>
                      <td className="text-end text-danger">{r.cash_out ? money(r.cash_out) : ""}</td>
                      <td className="text-end text-primary">{r.transfer_amount ? money(r.transfer_amount) : ""}</td>
                      <td className="text-end fw-bold">{money(r.running_balance)}</td>
                      <td className="text-nowrap">
                        {r.entry_id ? <button className="btn btn-xs btn-outline-secondary me-1" onClick={async () => setView(await api(`/cash_flow/entry/${r.entry_id}`))}>View</button> : null}
                        {r.entry_id && r.source === "MANUAL" && r.status !== "voided" && (
                          <>
                            <button className="btn btn-xs btn-outline-primary me-1" onClick={() => startEdit(r.entry_id!)}>Edit</button>
                            <button className="btn btn-xs btn-outline-danger" onClick={() => { const reason = prompt("Void reason?"); if (reason == null) return; doAction("void_entry", { entry_id: r.entry_id, void_reason: reason }); }}>Delete</button>
                          </>
                        )}
                        {r.entry_id && r.source === "MANUAL" && r.status === "voided" && (
                          <button className="btn btn-xs btn-outline-success" onClick={() => doAction("restore_entry", { entry_id: r.entry_id })}>Restore</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!data?.rows?.length && <tr><td colSpan={15} className="ui-empty py-4">No money movements match these filters.</td></tr>}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={10}>Totals</td>
                    <td className="text-end text-success">{money(data?.total_cash_in)}</td>
                    <td className="text-end text-danger">{money(data?.total_cash_out)}</td>
                    <td className="text-end text-primary">{money(data?.total_transfer_in)}</td>
                    <td className="text-end">{money(data?.closing_balance)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "reconcile" && (
        <Card title="End-of-day physical cash count & reconciliation">
          <div className="small text-muted mb-3">Optional physical cash check. Difference = Counted − System Closing.</div>
          <form className="row g-3 align-items-end" onSubmit={(e) => { e.preventDefault(); doAction("save_reconciliation", { physical_cash_available: physical, reconciliation_reason: reconReason, adjustment_date: data?.adjustment_date_input, from_date: data?.from_date, to_date: data?.to_date, calculated_closing: closing }); }}>
            <div className="col-auto"><label className="ui-label">Reconciliation Date</label><input type="date" className="form-control form-control-sm" readOnly value={data?.adjustment_date_input || ""} /></div>
            <div className="col-auto"><label className="ui-label">System Calculated Closing</label><div className="form-control form-control-sm fw-bold">{money(closing)}</div></div>
            <div className="col-auto"><label className="ui-label">Physical Cash Available *</label><input type="number" step="0.01" className="form-control form-control-sm" value={physical} onChange={(e) => setPhysical(e.target.value)} /></div>
            <div className="col-auto"><label className="ui-label">Difference (Counted − Expected)</label><div className="form-control form-control-sm fw-bold" style={{ color: diff < 0 ? "#dc2626" : diff > 0 ? "#16a34a" : undefined }}>{money(diff)}</div></div>
            <div className="col-12"><label className="ui-label">Reason / Explanation Note</label><input className="form-control form-control-sm" value={reconReason} onChange={(e) => setReconReason(e.target.value)} /></div>
            <div className="col-auto">
              <button className="btn btn-success btn-sm fw-bold" type="submit"><i className="bi bi-save me-1" /> Save Reconciliation</button>
              {data?.show_delete_button && <button type="button" className="btn btn-danger btn-sm fw-bold ms-2" onClick={() => doAction("delete", { adjustment_date: data.adjustment_date_input })}>Remove Reconciliation</button>}
            </div>
          </form>
        </Card>
      )}

      {tab === "master" && (
        <Card title="Master Data Management">
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <h6 className="fw-bold">Add Category</h6>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction("add_category", { new_category_name: fd.get("name"), new_category_direction: fd.get("direction"), new_category_notes: fd.get("notes") }); e.currentTarget.reset(); }}>
                <div className="col-12"><input name="name" className="form-control form-control-sm" placeholder="Category Name *" required /></div>
                <div className="col-12"><select name="direction" className="form-select form-select-sm"><option value="both">Received & Spent</option><option value="in">Received only</option><option value="out">Spent only</option></select></div>
                <div className="col-12"><input name="notes" className="form-control form-control-sm" placeholder="Notes (optional)" /></div>
                <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Create Category</button></div>
              </form>
            </div>
            <div className="col-md-4">
              <h6 className="fw-bold">Add Sub-category</h6>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction("add_subcategory", { new_sub_category_id: fd.get("cat"), new_subcategory_name: fd.get("name"), new_subcategory_notes: fd.get("notes") }); e.currentTarget.reset(); }}>
                <div className="col-12"><select name="cat" className="form-select form-select-sm" required><option value="">Parent Category *</option>{(data?.cf_categories || []).filter((c) => c.is_active !== 0).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="col-12"><input name="name" className="form-control form-control-sm" placeholder="Sub-category Name *" required /></div>
                <div className="col-12"><input name="notes" className="form-control form-control-sm" placeholder="Notes" /></div>
                <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Create Sub-category</button></div>
              </form>
            </div>
            <div className="col-md-4">
              <h6 className="fw-bold">Add Party</h6>
              <form className="row g-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction("add_party", { new_party_name: fd.get("name"), new_party_type: fd.get("type"), new_party_note: fd.get("note") }); e.currentTarget.reset(); }}>
                <div className="col-12"><input name="name" className="form-control form-control-sm" placeholder="Party Name *" required /></div>
                <div className="col-12"><select name="type" className="form-select form-select-sm">{(data?.party_types || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="col-12"><input name="note" className="form-control form-control-sm" placeholder="Notes" /></div>
                <div className="col-12"><button className="btn btn-sm btn-outline-primary w-100">Create Party</button></div>
              </form>
            </div>
          </div>
          <h6 className="fw-bold">Categories</h6>
          <table className="ui-table mb-4">
            <thead><tr><th>ID</th><th>Name</th><th>Direction</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.cf_categories || []).map((c) => (
                <tr key={c.id}>
                  <td className="text-muted">{c.id}</td>
                  <td colSpan={5}>
                    <form className="row g-1 align-items-center" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction("rename_category", { category_id: c.id, category_name: fd.get("name"), category_direction: fd.get("direction"), category_notes: fd.get("notes") }); }}>
                      <div className="col-md-3"><input name="name" className="form-control form-control-sm" defaultValue={c.name} /></div>
                      <div className="col-md-2"><select name="direction" className="form-select form-select-sm" defaultValue={c.direction}><option value="both">Both</option><option value="in">Received</option><option value="out">Spent</option></select></div>
                      <div className="col-md-3"><input name="notes" className="form-control form-control-sm" defaultValue={c.notes || ""} /></div>
                      <div className="col-md-1">{c.is_active !== 0 ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Disabled</span>}</div>
                      <div className="col-md-3 d-flex gap-1">
                        <button className="btn btn-sm btn-outline-secondary" type="submit">Save</button>
                        <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => doAction(c.is_active !== 0 ? "disable_category" : "enable_category", { category_id: c.id })}>{c.is_active !== 0 ? "Disable" : "Restore"}</button>
                        {(data?.used_category_ids || []).includes(c.id)
                          ? <button type="button" className="btn btn-sm btn-outline-secondary" disabled>Delete</button>
                          : <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => doAction("delete_category", { category_id: c.id })}>Delete</button>}
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h6 className="fw-bold">Parties</h6>
          <table className="ui-table">
            <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.cf_parties_all || []).map((p) => (
                <tr key={p.id}>
                  <td className="text-muted">{p.id}</td>
                  <td colSpan={5}>
                    <form className="row g-1 align-items-center" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); doAction("update_party", { party_id: p.id, party_name: fd.get("name"), party_type: fd.get("type"), party_note: fd.get("note") }); }}>
                      <div className="col-md-3"><input name="name" className="form-control form-control-sm" defaultValue={p.name} /></div>
                      <div className="col-md-2"><select name="type" className="form-select form-select-sm" defaultValue={p.party_type}>{(data?.party_types || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                      <div className="col-md-3"><input name="note" className="form-control form-control-sm" defaultValue={p.note || ""} /></div>
                      <div className="col-md-1">{p.is_active !== 0 ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Disabled</span>}</div>
                      <div className="col-md-3 d-flex gap-1">
                        <button className="btn btn-sm btn-outline-secondary" type="submit">Save</button>
                        <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => doAction(p.is_active !== 0 ? "disable_party" : "enable_party", { party_id: p.id })}>{p.is_active !== 0 ? "Disable" : "Restore"}</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!view} title={`Cash Flow Transaction #${view?.id || ""}`} onClose={() => setView(null)}>
        {view && (
          <div>
            <div className="d-flex justify-content-between mb-3">
              <div><div className="fw-bold">Posted: {String(view.date_posted || "")}</div></div>
              <div>{String(view.direction) === "in" ? <span className="badge bg-success">Received [ IN ]</span> : String(view.direction) === "out" ? <span className="badge bg-danger">Spent [ OUT ]</span> : <span className="badge bg-primary">Transfer</span>}</div>
            </div>
            <table className="table table-sm"><tbody>
              <tr><th>Amount</th><td>{money(view.amount)}</td></tr>
              <tr><th>Account</th><td>{String(view.account_name || "")}</td></tr>
              <tr><th>Category</th><td>{String(view.category_name || "—")}</td></tr>
              <tr><th>Party</th><td>{String(view.party_name || "—")}</td></tr>
              <tr><th>Description</th><td>{String(view.description || "—")}</td></tr>
              <tr><th>Notes</th><td>{String(view.note || "—")}</td></tr>
              <tr><th>Reference</th><td>{String(view.reference || "—")}</td></tr>
            </tbody></table>
          </div>
        )}
      </Modal>
    </div>
  );
}

function QuickAdd({ label, onSave, extraOptions }: { label: string; onSave: (name: string, extra?: string) => Promise<void>; extraOptions?: [string, string][] | readonly (readonly [string, string])[] }) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState(extraOptions?.[0]?.[0] || "");
  const [err, setErr] = useState("");
  return (
    <div>
      <div className="fw-bold small text-primary mb-1">Quick Add {label}</div>
      <div className="input-group input-group-sm">
        <input className="form-control" placeholder={`${label} name *`} value={name} onChange={(e) => setName(e.target.value)} />
        {extraOptions && (
          <select className="form-select" value={extra} onChange={(e) => setExtra(e.target.value)}>
            {extraOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-primary" onClick={async () => { setErr(""); try { await onSave(name, extra); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } }}>Save</button>
      </div>
      {err && <div className="small text-danger mt-1">{err}</div>}
    </div>
  );
}
