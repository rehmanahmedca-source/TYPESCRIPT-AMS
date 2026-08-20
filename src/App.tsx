import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { api } from "./api";
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

type Boot = {
  today?: string;
  user?: { username?: string; role?: string };
};

export default function App() {
  const [authUser, setAuthUser] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [boot, setBoot] = useState<Boot>({ today: "", user: {} });

  async function loadApplication(user?: Record<string, unknown>) {
    const me = user || (await api<{ user: Record<string, unknown> }>("/auth/me")).user;
    setAuthUser(me);
    setBoot(await api<Boot>("/bootstrap"));
  }

  useEffect(() => {
    loadApplication().catch(() => setAuthUser(null));
    const unauthorized = () => setAuthUser(null);
    window.addEventListener("ams:unauthorized", unauthorized);
    return () => window.removeEventListener("ams:unauthorized", unauthorized);
  }, []);

  if (authUser === undefined) {
    return <div className="min-vh-100 d-flex align-items-center justify-content-center text-muted">Opening AMS…</div>;
  }
  if (!authUser) {
    return <Login onLogin={(user) => loadApplication(user).catch(() => setAuthUser(null))} />;
  }

  return (
    <Routes>
      <Route element={<AppShell today={boot.today || ""} user={boot.user || {}} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/materials/:id/ledger" element={<MaterialLedger />} />
        <Route path="/grn" element={<Grn />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/financial-details" element={<FinancialDetails />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientLedger />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<SupplierLedger />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/dispatch" element={<Dispatch />} />
        <Route path="/delivery-rents" element={<DeliveryRents />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id/ledger" element={<AccountLedger />} />
        <Route path="/cash-flow" element={<CashFlow />} />
        <Route path="/cash-flow-differences" element={<CashFlowDifferences />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/profit-reports" element={<ProfitReports />} />
        <Route path="/import-export" element={<ImportExport />} />
        <Route path="/void-audit" element={<VoidAudit />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
