import { FormEvent, useState } from "react";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";
import { money, num } from "../format";
import { useApi } from "../useApi";

export default function Stock() {
  const { data, reload } = useApi<{
    materials: { name: string; category: string; inn: number; out: number; stock: number; unit: string; rate: number }[];
    suppliers: { id: number; name: string }[];
    catalog: { id: number; name: string }[];
    totalStock: number;
    totalIn: number;
    totalOut: number;
    stockValuation: number;
  }>("/stock");
  const [msg, setMsg] = useState("");

  async function onGrn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/grn", {
      method: "POST",
      body: JSON.stringify({
        supplier_id: fd.get("supplier_id"),
        material_name: fd.get("material_name"),
        qty: fd.get("qty"),
        rate: fd.get("rate"),
        note: fd.get("note")
      })
    });
    setMsg("GRN posted");
    e.currentTarget.reset();
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-graph-up" title="Stock Summary" subtitle="Live inventory from GRN in / sale out movements">
        <span className="badge bg-warning text-dark">{num(data?.totalStock)} units</span>
      </PageHeader>
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-green"><div className="ui-tile-label">Total In</div><div className="ui-tile-value">{num(data?.totalIn)}</div></div>
        <div className="ui-tile border-rose"><div className="ui-tile-label">Total Out</div><div className="ui-tile-value">{num(data?.totalOut)}</div></div>
        <div className="ui-tile border-amber"><div className="ui-tile-label">Valuation</div><div className="ui-tile-value">{money(data?.stockValuation)}</div></div>
      </div>
      <Card title="Quick GRN (Stock In)" icon="bi-box-arrow-in-down">
        <form className="row g-3" onSubmit={onGrn}>
          <div className="col-md-3">
            <label className="ui-label">Supplier</label>
            <select name="supplier_id" className="form-select" required>
              <option value="">Select</option>
              {(data?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="ui-label">Material</label>
            <select name="material_name" className="form-select" required>
              <option value="">Select</option>
              {(data?.catalog || []).map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
          <div className="col-md-2"><label className="ui-label">Qty</label><input name="qty" type="number" step="any" className="form-control" required /></div>
          <div className="col-md-2"><label className="ui-label">Rate</label><input name="rate" type="number" step="any" className="form-control" required /></div>
          <div className="col-md-2 d-flex align-items-end"><button className="btn btn-warning w-100">Receive</button></div>
        </form>
        {msg && <div className="text-success small mt-2">{msg}</div>}
      </Card>
      <Card title="Brand stock" icon="bi-boxes" flush>
        <div className="table-responsive">
          <table className="ui-table mb-0">
            <thead><tr><th>Brand</th><th>Category</th><th className="text-center">In</th><th className="text-center">Out</th><th className="text-end">Stock</th><th className="text-end">Rate</th></tr></thead>
            <tbody>
              {(data?.materials || []).map((m) => (
                <tr key={m.name}>
                  <td className="fw-bold">{m.name}</td>
                  <td>{m.category}</td>
                  <td className="text-center text-success">{num(m.inn)}</td>
                  <td className="text-center text-danger">{num(m.out)}</td>
                  <td className="text-end text-warning fw-bold">{num(m.stock)} {m.unit}</td>
                  <td className="text-end">{money(m.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
