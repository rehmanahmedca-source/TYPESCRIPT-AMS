import { useState } from "react";
import { api } from "../../api";

type ScanResult = {
  ok: boolean;
  scanned: number;
  discrepanciesCount: number;
  details: {
    unlinkedEntries: number;
    pendingBillsDiscrepancies: number;
    totalEntries: number;
    totalSales: number;
    totalBookings: number;
    totalPayments: number;
    totalGrns: number;
    totalPendingBills: number;
    totalDeliveryRents: number;
  };
  message: string;
};

export function ReconciliationTab() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunScan() {
    setScanning(true);
    setError(null);
    setFixMessage(null);
    try {
      const res = await api<ScanResult>("/settings/reconciliation/scan", { method: "POST" });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to complete data integrity scan.");
    } finally {
      setScanning(false);
    }
  }

  async function handleRunFix() {
    setFixing(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; fixedCount: number; message: string }>("/settings/reconciliation/fix", {
        method: "POST"
      });
      if (res.ok) {
        setFixMessage(res.message);
        handleRunScan(); // Re-scan to confirm 0 discrepancies
      }
    } catch (err: any) {
      setError(err?.message || "Failed to execute auto-repair routine.");
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-patch-check-fill text-warning" /> Double-Entry & Relational Integrity Auditor
            </h5>
          </div>
          <div className="ui-card-body">
            <p className="text-secondary small mb-4">
              Scans all financial entries, stock movements, pending bills, bookings, and GRN receipts to verify relational parity and identify unlinked or desynchronized transaction records.
            </p>

            {error && (
              <div className="alert alert-danger py-2 px-3 mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" />
                <span>{error}</span>
              </div>
            )}

            {fixMessage && (
              <div className="alert alert-success py-2 px-3 mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill" />
                <span>{fixMessage}</span>
              </div>
            )}

            <div className="d-flex align-items-center gap-3 mb-4">
              <button
                type="button"
                className="btn btn-warning fw-bold px-4"
                disabled={scanning || fixing}
                onClick={handleRunScan}
              >
                {scanning ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" /> Scanning Records...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-2" /> Start Integrity Scan
                  </>
                )}
              </button>

              {result && result.discrepanciesCount > 0 && (
                <button
                  type="button"
                  className="btn btn-success fw-bold px-4"
                  disabled={fixing}
                  onClick={handleRunFix}
                >
                  {fixing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" /> Repairing Data...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-wrench-adjustable me-2" /> Auto-Fix Discrepancies
                    </>
                  )}
                </button>
              )}
            </div>

            {result && (
              <div className="border border-secondary border-opacity-25 rounded-3 p-3 bg-body-tertiary">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2 border-secondary border-opacity-25">
                  <span className="fw-bold text-light">Scan Status Overview</span>
                  <span
                    className={`badge ${
                      result.discrepanciesCount === 0
                        ? "bg-success-subtle text-success border border-success-subtle"
                        : "bg-danger-subtle text-danger border border-danger-subtle"
                    } px-2 py-1`}
                  >
                    {result.discrepanciesCount === 0 ? "All Records Consistent" : `${result.discrepanciesCount} Discrepancies`}
                  </span>
                </div>

                <div className="row g-3 small">
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">Total Scanned</div>
                      <div className="fs-5 fw-bold text-light">{result.scanned.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">Stock Entries</div>
                      <div className="fs-5 fw-bold text-light">{result.details.totalEntries.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">Direct Sales</div>
                      <div className="fs-5 fw-bold text-light">{result.details.totalSales.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">Bookings</div>
                      <div className="fs-5 fw-bold text-light">{result.details.totalBookings.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">Payments & Waives</div>
                      <div className="fs-5 fw-bold text-light">{result.details.totalPayments.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary border-opacity-25">
                      <div className="text-secondary">GRN Inwards</div>
                      <div className="fs-5 fw-bold text-light">{result.details.totalGrns.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-top border-secondary border-opacity-25 text-secondary small">
                  {result.message}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <div className="ui-card">
          <div className="ui-card-header">
            <h5>
              <i className="bi bi-shield-lock text-warning" /> Automatic Parity Guarantees
            </h5>
          </div>
          <div className="ui-card-body small text-secondary">
            <ul className="ps-3 mb-0 d-flex flex-column gap-2">
              <li>
                <strong>Stock Dispatches & Inward Receipts:</strong> Every movement has a corresponding entry in the physical inventory table.
              </li>
              <li>
                <strong>Void Parity:</strong> When a sale or booking is marked void, all linked entries and pending bills are atomically synchronized.
              </li>
              <li>
                <strong>Zero-Drift Ledgers:</strong> Running balances are computed deterministically from immutable transaction histories.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
