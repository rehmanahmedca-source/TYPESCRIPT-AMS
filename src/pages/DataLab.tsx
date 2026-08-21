import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card } from "../components/ui";
import { api } from "../api";

export default function DataLab() {
  const [msg, setMsg] = useState("");
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/data_lab", {
      method: "POST",
      body: JSON.stringify({
        index_name: (fd.get("index_file") as File)?.name,
        finance_name: (fd.get("finance_file") as File)?.name,
        dispatch_name: (fd.get("dispatch_file") as File)?.name
      })
    });
    setMsg("Processed into recon basket.");
  }
  return (
    <div>
      <PageHeader icon="bi-bezier2" title="Data Lab - Triangulation Engine" subtitle="Upload ledger index, finance and dispatch files. No progress overlay." />
      <Card>
        <form onSubmit={onSubmit}>
          <div className="mb-3"><label className="form-label">Ledger Index (Excel/CSV)</label><input className="form-control" type="file" name="index_file" /></div>
          <div className="mb-3"><label className="form-label">Finance / Pending Bills (Excel/CSV)</label><input className="form-control" type="file" name="finance_file" /></div>
          <div className="mb-3"><label className="form-label">Dispatch / Inventory (Excel/CSV)</label><input className="form-control" type="file" name="dispatch_file" /></div>
          <button className="btn btn-primary">Process</button>
          <Link className="btn btn-secondary ms-2" to="/data_lab/basket">View Basket</Link>
        </form>
        {msg && <div className="text-success mt-3">{msg}</div>}
      </Card>
    </div>
  );
}
