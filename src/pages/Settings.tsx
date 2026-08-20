import { FormEvent, useEffect, useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";

type SettingsRow = {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  currency?: string;
  tax_rate?: number;
  ui_theme?: string;
  allow_global_negative_stock?: number;
};

export default function Settings() {
  const [s, setS] = useState<SettingsRow>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<{ settings: SettingsRow }>("/bootstrap").then((d) => setS(d.settings || {}));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const out = await api<{ settings: SettingsRow }>("/settings", { method: "POST", body: JSON.stringify(s) });
    setS(out.settings || s);
    setMsg("Settings saved");
  }

  return (
    <div>
      <PageHeader icon="bi-gear" title="Settings" subtitle="Company identity and stock policy" />
      <Card title="Company">
        <form className="row g-3" onSubmit={onSubmit}>
          <div className="col-md-6"><label className="ui-label">Company name</label><input className="form-control" value={s.company_name || ""} onChange={(e) => setS({ ...s, company_name: e.target.value })} /></div>
          <div className="col-md-6"><label className="ui-label">Phone</label><input className="form-control" value={s.company_phone || ""} onChange={(e) => setS({ ...s, company_phone: e.target.value })} /></div>
          <div className="col-md-8"><label className="ui-label">Address</label><input className="form-control" value={s.company_address || ""} onChange={(e) => setS({ ...s, company_address: e.target.value })} /></div>
          <div className="col-md-4"><label className="ui-label">Email</label><input className="form-control" value={s.company_email || ""} onChange={(e) => setS({ ...s, company_email: e.target.value })} /></div>
          <div className="col-md-3"><label className="ui-label">Currency</label><input className="form-control" value={s.currency || "PKR"} onChange={(e) => setS({ ...s, currency: e.target.value })} /></div>
          <div className="col-md-3"><label className="ui-label">Tax %</label><input type="number" className="form-control" value={s.tax_rate || 0} onChange={(e) => setS({ ...s, tax_rate: Number(e.target.value) })} /></div>
          <div className="col-md-6 d-flex align-items-end">
            <label className="d-flex align-items-center gap-2">
              <input type="checkbox" checked={!!s.allow_global_negative_stock} onChange={(e) => setS({ ...s, allow_global_negative_stock: e.target.checked ? 1 : 0 })} />
              Allow negative stock
            </label>
          </div>
          <div className="col-12"><button className="btn btn-warning">Save settings</button>{msg && <span className="text-success ms-3">{msg}</span>}</div>
        </form>
      </Card>
      <Card title="Runtime">
        <ul className="mb-0 text-muted">
          <li>Stack: TypeScript + React + Express + SQLite</li>
          <li>Database file: <code>instance/ahmed_cement.db</code> — same table names as ams99</li>
          <li>XLSX: master + full raw import/export</li>
          <li>No global loading overlay, no spinner lock, no task-progress modal</li>
        </ul>
      </Card>
    </div>
  );
}
