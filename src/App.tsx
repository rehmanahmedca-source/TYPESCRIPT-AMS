import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, getAuthToken } from "./api";
import AppShell from "./layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Stock from "./pages/Stock";
import Materials from "./pages/Materials";
import MaterialLedger from "./pages/MaterialLedger";
import Grn from "./pages/Grn";
import Daily from "./pages/Daily";
import Clients from "./pages/Clients";
import ClientLedger from "./pages/ClientLedger";
import Suppliers from "./pages/Suppliers";
import SupplierLedger from "./pages/SupplierLedger";
import Sales from "./pages/Sales";
import Bookings from "./pages/Bookings";
import Returns from "./pages/Returns";
import Payments from "./pages/Payments";
import Pending from "./pages/Pending";
import Drivers from "./pages/Drivers";
import Dispatch from "./pages/Dispatch";
import DeliveryRents from "./pages/DeliveryRents";
import Accounts from "./pages/Accounts";
import AccountLedger from "./pages/AccountLedger";
import CashFlow from "./pages/CashFlow";
import CashFlowDifferences from "./pages/CashFlowDifferences";
import FinancialDetails from "./pages/FinancialDetails";
import Reconciliation from "./pages/Reconciliation";
import Reports from "./pages/Reports";
import ProfitReports from "./pages/ProfitReports";
import ImportExport from "./pages/ImportExport";
import Settings from "./pages/Settings";
import VoidAudit from "./pages/VoidAudit";
import Login from "./pages/Login";
import History from "./pages/History";
import DecisionLedger from "./pages/DecisionLedger";
import CurrentPayables from "./pages/CurrentPayables";
import Notifications from "./pages/Notifications";
import ClientPayments from "./pages/ClientPayments";
import SupplierPayments from "./pages/SupplierPayments";
import Expenditures from "./pages/Expenditures";
import Receipts from "./pages/Receipts";
import AuditTrail from "./pages/AuditTrail";
import ManageAccounts from "./pages/ManageAccounts";
import AddAccount from "./pages/AddAccount";
import AccountTransfers from "./pages/AccountTransfers";
import NewTransfer from "./pages/NewTransfer";
import DriverLedger from "./pages/DriverLedger";
import KpiDrilldown from "./pages/KpiDrilldown";
import UpcomingReminders from "./pages/UpcomingReminders";
import ActivityLog from "./pages/ActivityLog";
import LiveLogins from "./pages/LiveLogins";
import SystemReport from "./pages/SystemReport";
import AdminDashboard from "./pages/AdminDashboard";
import Reconciliations from "./pages/Reconciliations";
import ViewBill from "./pages/ViewBill";
import ReconcileAccount from "./pages/ReconcileAccount";
import DataLab from "./pages/DataLab";
import DataLabBasket from "./pages/DataLabBasket";
import HoldBills from "./pages/HoldBills";
import MixedReport from "./pages/MixedReport";
import ImportHistory from "./pages/ImportHistory";
import CashFlowDiffDetail from "./pages/CashFlowDiffDetail";

type Boot = {
  today?: string;
  user?: { username?: string; role?: string };
};

export default function App() {
  const [authUser, setAuthUser] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [boot, setBoot] = useState<Boot>({ today: "", user: {} });

  async function loadApplication(user?: Record<string, unknown>, signal?: AbortSignal) {
    let me = user;
    if (!me) {
      const authRes = await api<{ ok: boolean; authenticated?: boolean; user?: Record<string, unknown> }>("/auth/me", { signal });
      if (!authRes.authenticated || !authRes.user) {
        setAuthUser(null);
        return;
      }
      me = authRes.user;
    }
    const bootData = await api<Boot>("/bootstrap", { signal });
    setBoot(bootData);
    setAuthUser(me);
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const token = getAuthToken();
    if (!token && !document.cookie.includes("ams_session")) {
      setAuthUser(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      controller.abort();
      if (active) setAuthUser(null);
    }, 4_000);

    loadApplication(undefined, controller.signal)
      .catch(() => {
        if (active) setAuthUser(null);
      })
      .finally(() => window.clearTimeout(timeout));

    const unauthorized = () => setAuthUser(null);
    window.addEventListener("ams:unauthorized", unauthorized);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener("ams:unauthorized", unauthorized);
    };
  }, []);

  if (authUser === undefined) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Opening AMS…</div>;
  }
  if (!authUser) {
    return (
      <Login
        onLogin={async (user) => {
          try {
            await loadApplication(user);
          } catch (e) {
            console.error("Failed to load application after login:", e);
            setAuthUser(null);
          }
        }}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppShell today={boot.today || ""} user={boot.user || {}} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/stock" element={<Stock />} />
        <Route path="/inventory/stock_summary" element={<Stock />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/materials/:id/ledger" element={<MaterialLedger />} />
        <Route path="/grn" element={<Grn />} />
        <Route path="/edit_grn/:id" element={<Grn />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/inventory/daily_transactions" element={<Daily />} />
        <Route path="/financial-details" element={<FinancialDetails />} />
        <Route path="/financial_details" element={<FinancialDetails />} />

        <Route path="/clients" element={<Clients />} />
        <Route path="/ledger" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientLedger />} />
        <Route path="/ledger/:id" element={<ClientLedger />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<SupplierLedger />} />

        <Route path="/sales" element={<Sales />} />
        <Route path="/direct_sales" element={<Sales />} />
        <Route path="/direct_sales/hold" element={<HoldBills />} />
        <Route path="/mixed_transactions" element={<MixedReport />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/material_returns" element={<Returns />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/pending_bills" element={<Pending />} />

        <Route path="/drivers" element={<Drivers />} />
        <Route path="/delivery_persons" element={<Drivers />} />
        <Route path="/delivery_persons/:id" element={<DriverLedger />} />
        <Route path="/delivery_ledger/:id" element={<DriverLedger />} />
        <Route path="/dispatch" element={<Dispatch />} />
        <Route path="/dispatching" element={<Dispatch />} />
        <Route path="/delivery-rents" element={<DeliveryRents />} />
        <Route path="/delivery_rents" element={<DeliveryRents />} />

        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/" element={<Accounts />} />
        <Route path="/accounts/accounts" element={<ManageAccounts />} />
        <Route path="/accounts/accounts/add" element={<AddAccount />} />
        <Route path="/accounts/audit" element={<AuditTrail />} />
        <Route path="/accounts/expenditures" element={<Expenditures />} />
        <Route path="/accounts/receipts" element={<Receipts />} />
        <Route path="/accounts/payments/clients" element={<ClientPayments />} />
        <Route path="/accounts/payments/suppliers" element={<SupplierPayments />} />
        <Route path="/accounts/transfers" element={<AccountTransfers />} />
        <Route path="/accounts/transfers/add" element={<NewTransfer />} />
        <Route path="/accounts/reconciliations" element={<Reconciliations />} />
        <Route path="/accounts/:id/ledger" element={<AccountLedger />} />
        <Route path="/accounts/ledger/:id" element={<AccountLedger />} />
        <Route path="/accounts/:id/reconcile" element={<ReconcileAccount />} />
        <Route path="/accounts/kpi/:kind" element={<KpiDrilldown />} />

        <Route path="/cash-flow" element={<CashFlow />} />
        <Route path="/cash_flow" element={<CashFlow />} />
        <Route path="/cash-flow-differences" element={<CashFlowDifferences />} />
        <Route path="/cash_flow_differences" element={<CashFlowDifferences />} />
        <Route path="/cash_flow_differences/:id" element={<CashFlowDiffDetail />} />
        <Route path="/cash-flow-differences/:id" element={<CashFlowDiffDetail />} />
        <Route path="/view_bill/:billNo" element={<ViewBill />} />
        <Route path="/view_bill_detail/:type/:id" element={<ViewBill />} />
        <Route path="/data_lab" element={<DataLab />} />
        <Route path="/data_lab/" element={<DataLab />} />
        <Route path="/data_lab/basket" element={<DataLabBasket />} />
        <Route path="/reconciliation" element={<Reconciliation />} />

        <Route path="/tracking" element={<History />} />
        <Route path="/history" element={<History />} />
        <Route path="/decision_ledger" element={<DecisionLedger />} />
        <Route path="/current_payables" element={<CurrentPayables />} />
        <Route path="/unpaid_transactions" element={<CurrentPayables />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notifications/upcoming" element={<UpcomingReminders />} />

        <Route path="/reports" element={<Reports />} />
        <Route path="/profit-reports" element={<ProfitReports />} />
        <Route path="/profit_reports" element={<ProfitReports />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="/import_export" element={<ImportExport />} />
        <Route path="/import_export/full_raw_import_history" element={<ImportHistory />} />
        <Route path="/void-audit" element={<VoidAudit />} />
        <Route path="/void_audit" element={<VoidAudit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/activity_log" element={<ActivityLog />} />
        <Route path="/login_sessions" element={<LiveLogins />} />
        <Route path="/settings/activity" element={<ActivityLog />} />
        <Route path="/settings/sessions" element={<LiveLogins />} />
        <Route path="/system_report" element={<SystemReport />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/" element={<AdminDashboard />} />
        <Route path="/admin/modules" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
