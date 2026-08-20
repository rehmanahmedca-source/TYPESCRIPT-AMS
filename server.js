import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import { store } from "./data/store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/static", express.static(path.join(__dirname, "static")));

// Global template helpers & locals
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.today_date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  res.locals.formatMoney = (val) => {
    const num = Number(val) || 0;
    return "Rs. " + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  res.locals.formatNumber = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString("en-US");
  };
  res.locals.current_user = {
    name: "Rehman Ahmed",
    role: "admin",
    can_manage_sales: true,
    can_manage_bookings: true,
    can_manage_payments: true,
    can_view_stock: true,
    can_view_daily: true,
    can_view_client_ledger: true
  };
  next();
});

// Helper calculation functions
function getDashboardStats() {
  const totalStock = store.materials.reduce((acc, m) => acc + (m.stock || 0), 0);
  const clientCount = store.clients.filter(c => c.active).length;
  
  // Inventory Valuation
  const totalInventoryValue = store.materials.reduce((acc, m) => acc + ((m.stock || 0) * (m.purchaseRate || 0)), 0);
  const totalInventoryRetailValue = store.materials.reduce((acc, m) => acc + ((m.stock || 0) * (m.rate || 0)), 0);

  // Pending Dispatches & Fleet Metrics
  const activeBookings = store.bookings.filter(b => b.status !== "Completed");
  const pendingBookingUnits = activeBookings.reduce((acc, b) => acc + Math.max(0, b.quantity - (b.dispatchedQuantity || 0)), 0);
  const pendingDispatchesCount = activeBookings.length;
  const activeDriversOnTrip = store.drivers.filter(d => d.status === "On Trip").length;
  const totalDrivers = store.drivers.length;

  // Sales Totals & Metrics
  const recentSalesTotal = store.sales.reduce((acc, s) => acc + (s.total || 0), 0);
  const recentSalesPaid = store.sales.reduce((acc, s) => acc + (s.paid || 0), 0);
  const recentSalesDue = store.sales.reduce((acc, s) => acc + (s.due || 0), 0);
  const recentSalesCount = store.sales.length;
  const avgOrderValue = recentSalesCount > 0 ? Math.round(recentSalesTotal / recentSalesCount) : 0;

  // Today's cash & credit from sales
  const todayStr = "2026-08-18";
  const todaySales = store.sales.filter(s => s.date === todayStr);
  const dailyCash = todaySales.reduce((acc, s) => acc + (s.paid || 0), 0);
  const dailyCredit = todaySales.reduce((acc, s) => acc + (s.due || 0), 0);

  // Total Outstanding across all clients
  const totalOutstanding = store.clients.reduce((acc, c) => acc + (c.balance || 0), 0);

  return {
    totalStock,
    clientCount,
    dailyCash,
    dailyCredit,
    totalOutstanding,
    totalInventoryValue,
    totalInventoryRetailValue,
    pendingDispatchesCount,
    pendingBookingUnits,
    activeDriversOnTrip,
    totalDrivers,
    recentSalesTotal,
    recentSalesPaid,
    recentSalesDue,
    recentSalesCount,
    avgOrderValue,
    stats: store.materials
  };
}

// 1. Dashboard
app.get("/", (req, res) => {
  const stats = getDashboardStats();
  res.render("index", {
    title: "System Dashboard",
    ...stats,
    recentSales: store.sales.slice(0, 5),
    recentBookings: store.bookings.slice(0, 5)
  });
});

// 2. Stock Summary
app.get("/stock_summary", (req, res) => {
  const totalStock = store.materials.reduce((acc, m) => acc + (m.stock || 0), 0);
  const totalIn = store.materials.reduce((acc, m) => acc + (m.in || 0), 0);
  const totalOut = store.materials.reduce((acc, m) => acc + (m.out || 0), 0);
  const stockValuation = store.materials.reduce((acc, m) => acc + ((m.stock || 0) * (m.purchaseRate || 0)), 0);

  res.render("stock_summary", {
    title: "Stock Summary",
    materials: store.materials,
    suppliers: store.suppliers,
    totalStock,
    totalIn,
    totalOut,
    stockValuation
  });
});

// 3. Materials / Brands Master
app.get("/materials", (req, res) => {
  res.render("materials", {
    title: "Materials Master",
    materials: store.materials
  });
});

app.post("/api/materials", (req, res) => {
  const { name, category, unit, rate, purchaseRate } = req.body;
  if (!name) return res.status(400).json({ error: "Material name is required" });

  const newMat = {
    id: store.materials.length + 1,
    name: name.trim(),
    category: category || "Cement",
    unit: unit || "Bags",
    in: 0,
    out: 0,
    stock: 0,
    rate: Number(rate) || 0,
    purchaseRate: Number(purchaseRate) || 0,
    active: true
  };
  store.materials.push(newMat);
  res.redirect("/materials");
});

// 4. Goods Receiving Note (GRN) / Stock In
app.post("/api/grn", (req, res) => {
  const { supplierId, materialId, quantity, purchaseRate, vehicleNo, driver } = req.body;
  const qty = Number(quantity) || 0;
  const rate = Number(purchaseRate) || 0;
  const mat = store.materials.find(m => m.id === Number(materialId));
  const sup = store.suppliers.find(s => s.id === Number(supplierId));

  if (!mat || !sup || qty <= 0) {
    return res.status(400).send("Invalid GRN information");
  }

  const cost = qty * rate;
  mat.in += qty;
  mat.stock += qty;
  mat.purchaseRate = rate;
  sup.balance += cost;

  const grnId = `GRN-2026-${String(store.grns.length + 51).padStart(3, "0")}`;
  store.grns.unshift({
    id: grnId,
    date: new Date().toISOString().split("T")[0],
    supplierId: sup.id,
    supplierName: sup.name,
    materialId: mat.id,
    materialName: mat.name,
    quantity: qty,
    unit: mat.unit,
    purchaseRate: rate,
    totalCost: cost,
    vehicleNo: vehicleNo || "Direct Plant",
    driver: driver || "Plant Dispatch",
    status: "Received"
  });

  store.ledgerEntries.push({
    id: store.ledgerEntries.length + 1,
    date: new Date().toISOString().split("T")[0],
    type: "Supplier",
    partyId: sup.id,
    partyName: sup.name,
    description: `GRN Intake: ${qty} ${mat.unit} of ${mat.name}`,
    debit: 0,
    credit: cost,
    balance: sup.balance,
    ref: grnId
  });

  res.redirect("/stock_summary");
});

// 5. Clients
app.get("/clients", (req, res) => {
  const totalReceivables = store.clients.reduce((acc, c) => acc + (c.balance || 0), 0);
  res.render("clients", {
    title: "Registered Clients",
    clients: store.clients,
    totalReceivables
  });
});

app.post("/api/clients", (req, res) => {
  const { name, phone, address, type, openingBalance } = req.body;
  if (!name) return res.status(400).send("Client name is required");

  const balance = Number(openingBalance) || 0;
  const newClient = {
    id: store.clients.length + 1,
    name: name.trim(),
    phone: phone || "-",
    address: address || "-",
    balance,
    type: type || "Contractor",
    active: true
  };
  store.clients.push(newClient);

  if (balance > 0) {
    store.ledgerEntries.push({
      id: store.ledgerEntries.length + 1,
      date: new Date().toISOString().split("T")[0],
      type: "Client",
      partyId: newClient.id,
      partyName: newClient.name,
      description: "Opening Balance",
      debit: balance,
      credit: 0,
      balance: balance,
      ref: "OB"
    });
  }

  res.redirect("/clients");
});

// 6. Client Ledger
app.get("/client_ledger/:id", (req, res) => {
  const client = store.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).send("Client not found");

  const entries = store.ledgerEntries.filter(e => e.type === "Client" && e.partyId === client.id);
  const totalDebit = entries.reduce((acc, e) => acc + (e.debit || 0), 0);
  const totalCredit = entries.reduce((acc, e) => acc + (e.credit || 0), 0);

  res.render("client_ledger", {
    title: `Ledger - ${client.name}`,
    client,
    entries,
    totalDebit,
    totalCredit
  });
});

// 7. Client Payment / Manual Entry
app.post("/api/client_ledger/payment", (req, res) => {
  const { clientId, amount, paymentMethod, description, ref } = req.body;
  const amt = Number(amount) || 0;
  const client = store.clients.find(c => c.id === Number(clientId));

  if (!client || amt <= 0) return res.status(400).send("Invalid payment details");

  client.balance = Math.max(0, client.balance - amt);

  store.ledgerEntries.push({
    id: store.ledgerEntries.length + 1,
    date: new Date().toISOString().split("T")[0],
    type: "Client",
    partyId: client.id,
    partyName: client.name,
    description: description || `Payment Received via ${paymentMethod || "Cash"}`,
    debit: 0,
    credit: amt,
    balance: client.balance,
    ref: ref || "REC-PMT"
  });

  store.cashFlows.unshift({
    id: store.cashFlows.length + 1,
    date: new Date().toISOString().split("T")[0],
    type: "Receipt",
    account: paymentMethod?.includes("Bank") ? "Meezan Bank" : "Physical Cash Drawer",
    category: "Client Payment",
    description: `${client.name}: ${description || "Ledger Recovery"}`,
    amount: amt,
    ref: ref || "REC-PMT"
  });

  res.redirect(`/client_ledger/${client.id}`);
});

// 8. Suppliers
app.get("/suppliers", (req, res) => {
  const totalPayables = store.suppliers.reduce((acc, s) => acc + (s.balance || 0), 0);
  res.render("suppliers", {
    title: "Material Suppliers",
    suppliers: store.suppliers,
    totalPayables
  });
});

app.post("/api/suppliers", (req, res) => {
  const { name, phone, address, terms, openingBalance } = req.body;
  if (!name) return res.status(400).send("Supplier name is required");

  const balance = Number(openingBalance) || 0;
  const newSupplier = {
    id: store.suppliers.length + 1,
    name: name.trim(),
    phone: phone || "-",
    address: address || "-",
    balance,
    terms: terms || "Net 30",
    active: true
  };
  store.suppliers.push(newSupplier);
  res.redirect("/suppliers");
});

// 9. Supplier Ledger
app.get("/supplier_ledger/:id", (req, res) => {
  const supplier = store.suppliers.find(s => s.id === Number(req.params.id));
  if (!supplier) return res.status(404).send("Supplier not found");

  const entries = store.ledgerEntries.filter(e => e.type === "Supplier" && e.partyId === supplier.id);
  const totalDebit = entries.reduce((acc, e) => acc + (e.debit || 0), 0);
  const totalCredit = entries.reduce((acc, e) => acc + (e.credit || 0), 0);

  res.render("supplier_ledger", {
    title: `Supplier Ledger - ${supplier.name}`,
    supplier,
    entries,
    totalDebit,
    totalCredit
  });
});

// 10. Direct Sales
app.get("/direct_sales", (req, res) => {
  res.render("direct_sales", {
    title: "Direct Sales & Invoicing",
    sales: store.sales,
    clients: store.clients,
    materials: store.materials,
    drivers: store.drivers
  });
});

app.post("/api/direct_sales", (req, res) => {
  const { clientId, materialId, quantity, rate, discount, paidAmount, paymentMethod, driverId, destination } = req.body;
  const client = store.clients.find(c => c.id === Number(clientId));
  const material = store.materials.find(m => m.id === Number(materialId));
  const driver = store.drivers.find(d => d.id === Number(driverId));

  const qty = Number(quantity) || 0;
  const r = Number(rate) || material?.rate || 0;
  const disc = Number(discount) || 0;
  const paid = Number(paidAmount) || 0;

  if (!client || !material || qty <= 0) {
    return res.status(400).send("Invalid sale parameters");
  }

  const subtotal = qty * r;
  const total = Math.max(0, subtotal - disc);
  const due = Math.max(0, total - paid);

  // Update material inventory
  material.out += qty;
  material.stock = Math.max(0, material.stock - qty);

  // Update client balance
  client.balance += due;

  const invId = `INV-2026-${String(store.sales.length + 1).padStart(3, "0")}`;
  const newSale = {
    id: invId,
    date: new Date().toISOString().split("T")[0],
    clientId: client.id,
    clientName: client.name,
    materialId: material.id,
    materialName: material.name,
    quantity: qty,
    unit: material.unit,
    rate: r,
    subtotal,
    discount: disc,
    total,
    paid,
    due,
    paymentMethod: paymentMethod || "Cash",
    driverId: driver ? driver.id : null,
    driverName: driver ? driver.name : "Self / Walk-in",
    destination: destination || client.address,
    status: "Delivered"
  };

  store.sales.unshift(newSale);

  // Client ledger updates
  store.ledgerEntries.push({
    id: store.ledgerEntries.length + 1,
    date: newSale.date,
    type: "Client",
    partyId: client.id,
    partyName: client.name,
    description: `Sale Invoice ${invId} (${qty} ${material.unit} ${material.name})`,
    debit: total,
    credit: 0,
    balance: client.balance + (paid > 0 ? paid : 0),
    ref: invId
  });

  if (paid > 0) {
    store.ledgerEntries.push({
      id: store.ledgerEntries.length + 1,
      date: newSale.date,
      type: "Client",
      partyId: client.id,
      partyName: client.name,
      description: `Payment Received on ${invId}`,
      debit: 0,
      credit: paid,
      balance: client.balance,
      ref: invId
    });

    store.cashFlows.unshift({
      id: store.cashFlows.length + 1,
      date: newSale.date,
      type: "Receipt",
      account: paymentMethod?.includes("Bank") ? "Meezan Bank" : "Physical Cash Drawer",
      category: "Client Cash Sale",
      description: `Sale ${invId} ${client.name}`,
      amount: paid,
      ref: invId
    });
  }

  res.redirect("/direct_sales");
});

// 11. Bookings
app.get("/bookings", (req, res) => {
  res.render("bookings", {
    title: "Advance Bookings",
    bookings: store.bookings,
    clients: store.clients,
    materials: store.materials
  });
});

app.post("/api/bookings", (req, res) => {
  const { clientId, materialId, quantity, rate, advancePaid, expectedDate } = req.body;
  const client = store.clients.find(c => c.id === Number(clientId));
  const material = store.materials.find(m => m.id === Number(materialId));

  const qty = Number(quantity) || 0;
  const r = Number(rate) || material?.rate || 0;
  const adv = Number(advancePaid) || 0;

  if (!client || !material || qty <= 0) {
    return res.status(400).send("Invalid booking details");
  }

  const totalAmount = qty * r;
  const remaining = Math.max(0, totalAmount - adv);
  const bkId = `BK-2026-${String(store.bookings.length + 101).padStart(3, "0")}`;

  store.bookings.unshift({
    id: bkId,
    date: new Date().toISOString().split("T")[0],
    clientId: client.id,
    clientName: client.name,
    materialId: material.id,
    materialName: material.name,
    quantity: qty,
    unit: material.unit,
    rate: r,
    totalAmount,
    advancePaid: adv,
    remainingAmount: remaining,
    dispatchedQuantity: 0,
    status: "Booked",
    expectedDate: expectedDate || "-"
  });

  if (adv > 0) {
    store.cashFlows.unshift({
      id: store.cashFlows.length + 1,
      date: new Date().toISOString().split("T")[0],
      type: "Receipt",
      account: "Physical Cash Drawer",
      category: "Booking Advance",
      description: `Advance for ${bkId} - ${client.name}`,
      amount: adv,
      ref: bkId
    });
  }

  res.redirect("/bookings");
});

// 12. Dispatching & Fleet Tracking
app.get("/dispatching", (req, res) => {
  res.render("dispatching", {
    title: "Dispatch Tracking & Fleet",
    sales: store.sales,
    drivers: store.drivers
  });
});

// 13. Delivery Persons
app.get("/delivery_persons", (req, res) => {
  res.render("delivery_persons", {
    title: "Delivery Staff & Vehicles",
    drivers: store.drivers
  });
});

app.post("/api/delivery_persons", (req, res) => {
  const { name, phone, vehicle } = req.body;
  if (!name) return res.status(400).send("Driver name is required");

  store.drivers.push({
    id: store.drivers.length + 1,
    name: name.trim(),
    phone: phone || "-",
    vehicle: vehicle || "Truck",
    deliveriesCount: 0,
    status: "Available",
    active: true
  });
  res.redirect("/delivery_persons");
});

// 14. Accounts Hub
app.get("/accounts", (req, res) => {
  const totalCash = store.accounts.filter(a => a.type === "Cash").reduce((acc, a) => acc + a.balance, 0);
  const totalBank = store.accounts.filter(a => a.type === "Bank").reduce((acc, a) => acc + a.balance, 0);
  const totalCompanyMoney = totalCash + totalBank;

  res.render("accounts_dashboard", {
    title: "Accounts Hub",
    accounts: store.accounts,
    cashFlows: store.cashFlows.slice(0, 10),
    totalCash,
    totalBank,
    totalCompanyMoney
  });
});

// 15. Financial Transfers
app.post("/api/accounts/transfer", (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.body;
  const fromAcc = store.accounts.find(a => a.id === Number(fromAccountId));
  const toAcc = store.accounts.find(a => a.id === Number(toAccountId));
  const amt = Number(amount) || 0;

  if (!fromAcc || !toAcc || fromAcc.id === toAcc.id || amt <= 0 || fromAcc.balance < amt) {
    return res.status(400).send("Invalid transfer parameters or insufficient balance");
  }

  fromAcc.balance -= amt;
  toAcc.balance += amt;

  store.cashFlows.unshift({
    id: store.cashFlows.length + 1,
    date: new Date().toISOString().split("T")[0],
    type: "Transfer",
    account: `${fromAcc.name} ➔ ${toAcc.name}`,
    category: "Internal Transfer",
    description: description || "Funds Transfer",
    amount: amt,
    ref: "TRF-INT"
  });

  res.redirect("/accounts");
});

// 16. Expense Logging
app.post("/api/accounts/expenditure", (req, res) => {
  const { accountId, category, amount, description } = req.body;
  const acc = store.accounts.find(a => a.id === Number(accountId));
  const amt = Number(amount) || 0;

  if (!acc || amt <= 0 || acc.balance < amt) {
    return res.status(400).send("Invalid expense or insufficient balance");
  }

  acc.balance -= amt;

  store.cashFlows.unshift({
    id: store.cashFlows.length + 1,
    date: new Date().toISOString().split("T")[0],
    type: "Payment",
    account: acc.name,
    category: category || "Yard Expense",
    description: description || "General Expense",
    amount: amt,
    ref: "EXP"
  });

  res.redirect("/accounts");
});

// 17. Cash Flow
app.get("/cash_flow", (req, res) => {
  const totalInflow = store.cashFlows.filter(c => c.type === "Receipt").reduce((acc, c) => acc + c.amount, 0);
  const totalOutflow = store.cashFlows.filter(c => c.type === "Payment").reduce((acc, c) => acc + c.amount, 0);
  const netFlow = totalInflow - totalOutflow;

  res.render("cash_flow", {
    title: "Cash Flow Statement",
    cashFlows: store.cashFlows,
    totalInflow,
    totalOutflow,
    netFlow
  });
});

// 18. Cash Flow Differences & Physical Reconciliation
app.get("/cash_flow_differences", (req, res) => {
  res.render("cash_flow_differences", {
    title: "Cash Flow Differences Audit",
    reconciliations: store.reconciliations,
    cashDrawerBalance: store.accounts.find(a => a.id === 1)?.balance || 0
  });
});

app.post("/api/reconciliation", (req, res) => {
  const { physicalCash, notes } = req.body;
  const drawer = store.accounts.find(a => a.id === 1);
  const sysBal = drawer ? drawer.balance : 0;
  const phys = Number(physicalCash) || 0;
  const diff = phys - sysBal;

  const rec = {
    id: `REC-${new Date().toISOString().split("T")[0]}-${Math.floor(Math.random()*1000)}`,
    date: new Date().toISOString().split("T")[0],
    accountName: "Physical Cash Drawer",
    systemBalance: sysBal,
    physicalCash: phys,
    difference: diff,
    status: diff === 0 ? "Balanced" : (Math.abs(diff) < 1000 ? "Minor Discrepancy" : "Discrepancy (Review Required)"),
    auditor: "Rehman Ahmed",
    notes: notes || "-"
  };

  store.reconciliations.unshift(rec);
  res.redirect("/cash_flow_differences");
});

// 19. Reports
app.get("/reports", (req, res) => {
  const totalSalesVolume = store.sales.reduce((acc, s) => acc + s.total, 0);
  const totalCashCollected = store.sales.reduce((acc, s) => acc + s.paid, 0);
  const totalCreditIssued = store.sales.reduce((acc, s) => acc + s.due, 0);
  const totalInventoryUnits = store.materials.reduce((acc, m) => acc + m.stock, 0);

  res.render("reports", {
    title: "Executive Reports & Audit",
    totalSalesVolume,
    totalCashCollected,
    totalCreditIssued,
    totalInventoryUnits,
    sales: store.sales,
    materials: store.materials
  });
});

// 20. Financial Details breakdown
app.get("/financial_details", (req, res) => {
  const type = req.query.type || "cash";
  const todayStr = "2026-08-18";
  const items = store.sales.filter(s => s.date === todayStr);

  res.render("financial_details", {
    title: type === "cash" ? "Daily Cash Received Breakdown" : "Daily Credit Dues Breakdown",
    type,
    items
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AMS ERP running at http://0.0.0.0:${PORT}`);
});
