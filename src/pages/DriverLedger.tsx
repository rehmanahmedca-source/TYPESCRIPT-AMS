import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader, Card, Modal } from "../components/ui";
import { api } from "../api";
import { money, ymd } from "../format";
import { useApi } from "../useApi";

export default function DriverLedger() {
  const { id } = useParams();
  const { data, reload } = useApi<{
    driver: { id: number; name: string; phone: string; opening_balance: number; balance: number };
    entries: { id: number; date: string; type: string; description: string; debit: number; credit: number; balance: number }[];
    rents: { id: number; bill_no: string; amount: number; date_posted: string; note: string }[];
  }>(id ? `/drivers/${id}/ledger` : null);
  const [payOpen, setPayOpen] = useState(false);
  const [obOpen, setObOpen] = useState(false);

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api(`/drivers/${id}/payment`, { method: "POST", body: JSON.stringify(Object.fromEntries(fd.entries())) });
    setPayOpen(false);
    reload();
  }

  async function setOb(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api(`/drivers/${id}`, { method: "POST", body: JSON.stringify({ opening_balance: fd.get("opening_balance"), name: data?.driver.name, phone: data?.driver.phone }) });
    setObOpen(false);
    reload();
  }

  return (
    <div>
      <PageHeader icon="bi-journal-check" title={`Delivery Person Ledger`} subtitle={data?.driver.name || ""}>
        <Link to="/delivery_persons" className="btn btn-outline-secondary btn-sm">Back</Link>
        <button className="btn btn-outline-info btn-sm" onClick={() => setObOpen(true)}>Set opening balance</button>
        <button className="btn btn-success btn-sm" onClick={() => setPayOpen(true)}>Pay driver</button>
      </PageHeader>
      <div className="ui-kpi-grid mb-4">
        <div className="ui-tile border-amber"><div className="ui-tile-label">Balance</div><div className="ui-tile-value">{money(data?.driver.balance)}</div></div>
        <div className="ui-tile border-indigo"><div className="ui-tile-label">Opening</div><div className="ui-tile-value">{money(data?.driver.opening_balance)}</div></div>
      </div>
      <Card title="Ledger" flush>
        <table className="ui-table mb-0">
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="text-end">Debit</th><th className="text-end">Credit</th><th className="text-end">Balance</th></tr></thead>
          <tbody>
            {(data?.entries || []).map((e) => (
              <tr key={e.id}>
                <td>{ymd(e.date)}</td>
                <td>{e.type}</td>
                <td>{e.description}</td>
                <td className="text-end">{money(e.debit)}</td>
                <td className="text-end">{money(e.credit)}</td>
                <td className="text-end fw-bold">{money(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Modal open={payOpen} title="Pay driver" onClose={() => setPayOpen(false)} footer={<button form="payDrv" className="btn btn-success" type="submit">Save</button>}>
        <form id="payDrv" onSubmit={pay}>
          <label className="form-label">Amount</label>
          <input name="amount" type="number" step="0.01" className="form-control mb-2" required />
          <label className="form-label">Waive off</label>
          <input name="waive_off" type="number" step="0.01" className="form-control mb-2" defaultValue={0} />
          <label className="form-label">Note</label>
          <textarea name="note" className="form-control" />
        </form>
      </Modal>
      <Modal open={obOpen} title="Set opening balance" onClose={() => setObOpen(false)} footer={<button form="obDrv" className="btn btn-warning" type="submit">Save</button>}>
        <form id="obDrv" onSubmit={setOb}>
          <label className="form-label">Opening Balance</label>
          <input name="opening_balance" type="number" step="0.01" className="form-control" defaultValue={data?.driver.opening_balance} />
        </form>
      </Modal>
    </div>
  );
}
