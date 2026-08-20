import { useState } from "react";
import { api } from "../../api";
import { Modal } from "../../components/ui";

const DATASETS: { id: string; label: string; group: string; desc: string }[] = [
  // Sales & Outward Operations
  { id: "direct_sales", label: "Direct Sales & Invoices", group: "Sales & Outward", desc: "All direct customer counter sales and item lines" },
  { id: "bookings", label: "Client Bookings & Orders", group: "Sales & Outward", desc: "All future delivery bookings and booked items" },
  { id: "material_returns", label: "Customer Material Returns", group: "Sales & Outward", desc: "All returned cement and material adjustments" },
  { id: "dispatch", label: "Outward Dispatches (OUT)", group: "Sales & Outward", desc: "Physical inventory out records" },
  { id: "unsaved_sales_drafts", label: "POS Sales Drafts", group: "Sales & Outward", desc: "Unposted cart items" },

  // Inventory & Purchasing
  { id: "grn", label: "Goods Received Notes (GRN)", group: "Purchasing & Inventory", desc: "All inward supplier shipments and item lines" },
  { id: "receive", label: "Inward Receipts (IN)", group: "Purchasing & Inventory", desc: "Physical inventory stock in entries" },
  { id: "materials", label: "Materials Catalog", group: "Purchasing & Inventory", desc: "Cement and building materials definitions" },
  { id: "material_categories", label: "Material Categories", group: "Purchasing & Inventory", desc: "Category groups" },

  // Ledgers & Banking
  { id: "payments", label: "Client Payments & Waives", group: "Finance & Accounts", desc: "All customer payments, receipts, and write-offs" },
  { id: "supplier_payments", label: "Supplier Outgoing Payments", group: "Finance & Accounts", desc: "All payments issued to suppliers" },
  { id: "pending_bills", label: "Pending Bills Ledger", group: "Finance & Accounts", desc: "All open / unbilled and billed balances" },
  { id: "invoices", label: "Tax Invoices", group: "Finance & Accounts", desc: "Generated client tax invoice documents" },
  { id: "account_transactions", label: "Account Cash/Bank Vouchers", group: "Finance & Accounts", desc: "Double-entry debit/credit ledger entries" },
  { id: "financial_accounts", label: "Chart of Accounts", group: "Finance & Accounts", desc: "Bank accounts and cash books" },
  { id: "account_categories", label: "Account Categories", group: "Finance & Accounts", desc: "Income/Expense category structure" },
  { id: "cash_audit_trail", label: "Cash Flow Audit Trail", group: "Finance & Accounts", desc: "Cash log edit/delete history" },

  // Transport & Operations
  { id: "delivery_rents", label: "Delivery Rents & Trips", group: "Transport & Dispatch", desc: "Driver trip charges and freight bills" },
  { id: "driver_payments", label: "Driver Rent Payments", group: "Transport & Dispatch", desc: "Paid freight expenses to drivers" },
  { id: "delivery_persons", label: "Drivers / Transport List", group: "Transport & Dispatch", desc: "Driver profiles and vehicle records" },

  // Master Directories
  { id: "clients", label: "Clients Directory", group: "Master Data", desc: "Client profiles and phone/address records" },
  { id: "suppliers", label: "Suppliers Directory", group: "Master Data", desc: "Supplier profiles and factory contacts" },
  { id: "notifications_data", label: "System Notifications", group: "Master Data", desc: "Past stock alerts and notifications" }
];

export function WipeTab() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  function toggleAll(value: boolean) {
    const updated: Record<string, boolean> = {};
    DATASETS.forEach((d) => {
      updated[d.id] = value;
    });
    setSelected(updated);
  }

  async function handleExecuteWipe() {
    const datasetsToWipe = Object.keys(selected).filter((k) => selected[k]);
    if (datasetsToWipe.length === 0) return;

    setWiping(true);
    setFeedback(null);
    try {
      const res = await api<{ ok: boolean; wipedTables: string[]; message: string }>("/settings/wipe", {
        method: "POST",
        body: JSON.stringify({ datasets: datasetsToWipe })
      });
      if (res.ok) {
        setConfirmModalOpen(false);
        setSelected({});
        setFeedback({
          type: "success",
          text: res.message || `Successfully wiped ${res.wipedTables.length} datasets.`
        });
      } else {
        setFeedback({ type: "error", text: "Wipe operation failed." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to execute wipe." });
    } finally {
      setWiping(false);
    }
  }

  const groups = Array.from(new Set(DATASETS.map((d) => d.group)));

  return (
    <div>
      <div className="ui-card mb-4">
        <div className="ui-card-header">
          <div className="d-flex align-items-center gap-2">
            <h5>
              <i className="bi bi-trash3-fill text-danger" /> Granular Database Maintenance & Dataset Reset
            </h5>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => toggleAll(true)}>
              Select All
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => toggleAll(false)}>
              Deselect All
            </button>
          </div>
        </div>

        <div className="ui-card-body">
          <div className="alert alert-warning py-3 px-4 mb-4 border-warning border-opacity-50">
            <div className="d-flex gap-3">
              <i className="bi bi-exclamation-triangle-fill text-warning fs-3" />
              <div>
                <h6 className="alert-heading fw-bold mb-1">Administrative Warning</h6>
                <div className="small">
                  Wiping datasets permanently deletes historical records from the selected tables.{" "}
                  <strong>User accounts, passwords, and security audit logs will remain intact.</strong>
                </div>
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className={`alert ${
                feedback.type === "success" ? "alert-success" : "alert-danger"
              } py-2 px-3 mb-4 d-flex align-items-center gap-2`}
            >
              <i className={`bi ${feedback.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="row g-4">
            {groups.map((group) => {
              const items = DATASETS.filter((d) => d.group === group);
              return (
                <div key={group} className="col-md-6 col-lg-4">
                  <div className="p-3 rounded-3 bg-body-tertiary border border-secondary border-opacity-25 h-100">
                    <div className="fw-bold small text-warning mb-3 border-bottom pb-2 border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                      <span>{group}</span>
                      <span className="badge bg-secondary-subtle text-secondary small">
                        {items.filter((i) => selected[i.id]).length}/{items.length}
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-3">
                      {items.map((item) => (
                        <div key={item.id} className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`wipe_${item.id}`}
                            checked={!!selected[item.id]}
                            onChange={(e) => setSelected({ ...selected, [item.id]: e.target.checked })}
                          />
                          <label className="form-check-label text-light fw-bold small" htmlFor={`wipe_${item.id}`}>
                            {item.label}
                          </label>
                          <div className="text-secondary small" style={{ fontSize: "0.74rem" }}>
                            {item.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="d-flex align-items-center justify-content-between mt-4 pt-3 border-top border-secondary border-opacity-25">
            <span className="text-secondary small">
              {selectedCount === 0 ? "No datasets selected." : `${selectedCount} dataset(s) selected for deletion.`}
            </span>
            <button
              type="button"
              className="btn btn-danger fw-bold px-4"
              disabled={selectedCount === 0}
              onClick={() => setConfirmModalOpen(true)}
            >
              <i className="bi bi-trash3 me-2" /> Proceed to Wipe Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal open={confirmModalOpen} title="Confirm Dataset Deletion" onClose={() => setConfirmModalOpen(false)}>
        <div>
          <div className="text-center py-2 text-danger">
            <i className="bi bi-exclamation-octagon fs-1" />
          </div>
          <h6 className="text-center fw-bold text-light mb-3">
            Are you sure you want to permanently wipe {selectedCount} selected dataset(s)?
          </h6>
          <p className="text-secondary small mb-3">
            This operation will immediately remove all records associated with the chosen modules from SQLite storage. This operation is recorded in the permanent audit backup log.
          </p>

          <div className="d-flex justify-content-end gap-2 pt-3 border-top border-secondary border-opacity-25">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setConfirmModalOpen(false)}
              disabled={wiping}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger fw-bold px-4"
              onClick={handleExecuteWipe}
              disabled={wiping}
            >
              {wiping ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" /> Wiping Data...
                </>
              ) : (
                "Yes, Wipe Datasets"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
