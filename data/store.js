// In-Memory Data Store for AMS ERP (Ahmed Material System)

export const store = {
  materials: [
    { id: 1, name: "Fauji Cement", category: "Cement", unit: "Bags", in: 4500, out: 3200, stock: 1300, rate: 1250, purchaseRate: 1180, active: true },
    { id: 2, name: "Bestway Cement", category: "Cement", unit: "Bags", in: 3800, out: 2900, stock: 900, rate: 1240, purchaseRate: 1170, active: true },
    { id: 3, name: "Lucky Cement", category: "Cement", unit: "Bags", in: 2500, out: 1950, stock: 550, rate: 1260, purchaseRate: 1190, active: true },
    { id: 4, name: "DG Cement", category: "Cement", unit: "Bags", in: 1800, out: 1400, stock: 400, rate: 1230, purchaseRate: 1160, active: true },
    { id: 5, name: "Maple Leaf Cement", category: "Cement", unit: "Bags", in: 2100, out: 1650, stock: 450, rate: 1270, purchaseRate: 1200, active: true },
    { id: 6, name: "Cherat Cement", category: "Cement", unit: "Bags", in: 1200, out: 950, stock: 250, rate: 1240, purchaseRate: 1175, active: true },
    { id: 7, name: "Steel Rebar Grade 60", category: "Steel", unit: "Tons", in: 85, out: 62, stock: 23, rate: 265000, purchaseRate: 255000, active: true },
    { id: 8, name: "Crush / Aggregate", category: "Aggregates", unit: "Cu.Ft", in: 12000, out: 9500, stock: 2500, rate: 85, purchaseRate: 70, active: true },
    { id: 9, name: "Ravi Sand", category: "Aggregates", unit: "Cu.Ft", in: 15000, out: 11200, stock: 3800, rate: 45, purchaseRate: 35, active: true }
  ],

  clients: [
    { id: 1, name: "Al-Rehman Builders", phone: "0300-1234567", address: "Plot 42, Commercial Zone, Lahore", balance: 450000, type: "Contractor", active: true },
    { id: 2, name: "Malik & Sons Construction", phone: "0321-7654321", address: "Sector H, DHA Phase 6, Lahore", balance: 185000, type: "Builder", active: true },
    { id: 3, name: "Green City Developers", phone: "0333-9876543", address: "Main Raiwind Road, Lahore", balance: 320000, type: "Corporate", active: true },
    { id: 4, name: "Ahmed Bilal", phone: "0312-5554433", address: "Block B, Model Town, Lahore", balance: 0, type: "Retail", active: true },
    { id: 5, name: "Royal Heights Project", phone: "0345-8889900", address: "Main Boulevard, Gulberg III, Lahore", balance: 610000, type: "Commercial", active: true }
  ],

  suppliers: [
    { id: 1, name: "Fauji Cement Company Ltd", phone: "051-5551122", address: "Rawalpindi Industrial Zone", balance: 1250000, terms: "Net 30", active: true },
    { id: 2, name: "Bestway Cement Mills", phone: "051-4443322", address: "Hattar Industrial Estate", balance: 820000, terms: "Net 15", active: true },
    { id: 3, name: "Mughal Steel Industries", phone: "042-3665544", address: "Badami Bagh, Lahore", balance: 2100000, terms: "Advance/Credit", active: true },
    { id: 4, name: "Allied Logistics & Transport", phone: "0300-9988776", address: "Kot Lakhpat Terminal, Lahore", balance: 950000, terms: "Per Trip", active: true }
  ],

  drivers: [
    { id: 1, name: "Tariq Mehmood", phone: "0301-4455667", vehicle: "Truck LEA-9821", deliveriesCount: 42, status: "On Trip", active: true },
    { id: 2, name: "Asif Khan", phone: "0322-9988112", vehicle: "Mazda LHR-4512", deliveriesCount: 56, status: "Available", active: true },
    { id: 3, name: "Imran Ali", phone: "0334-1122334", vehicle: "Bedford LES-7711", deliveriesCount: 38, status: "Available", active: true },
    { id: 4, name: "Bilal Shah", phone: "0315-7766554", vehicle: "Hino Truck LZ-3400", deliveriesCount: 29, status: "On Trip", active: true }
  ],

  sales: [
    {
      id: "INV-2026-001",
      date: "2026-08-18",
      clientId: 1,
      clientName: "Al-Rehman Builders",
      materialId: 1,
      materialName: "Fauji Cement",
      quantity: 200,
      unit: "Bags",
      rate: 1250,
      subtotal: 250000,
      discount: 2000,
      total: 248000,
      paid: 100000,
      due: 148000,
      paymentMethod: "Cash",
      driverId: 1,
      driverName: "Tariq Mehmood",
      destination: "Plot 42, Commercial Zone",
      status: "Delivered"
    },
    {
      id: "INV-2026-002",
      date: "2026-08-18",
      clientId: 2,
      clientName: "Malik & Sons Construction",
      materialId: 2,
      materialName: "Bestway Cement",
      quantity: 150,
      unit: "Bags",
      rate: 1240,
      subtotal: 186000,
      discount: 1000,
      total: 185000,
      paid: 185000,
      due: 0,
      paymentMethod: "Bank (Meezan)",
      driverId: 2,
      driverName: "Asif Khan",
      destination: "DHA Phase 6, Sector H",
      status: "Delivered"
    },
    {
      id: "INV-2026-003",
      date: "2026-08-17",
      clientId: 3,
      clientName: "Green City Developers",
      materialId: 7,
      materialName: "Steel Rebar Grade 60",
      quantity: 2,
      unit: "Tons",
      rate: 265000,
      subtotal: 530000,
      discount: 5000,
      total: 525000,
      paid: 205000,
      due: 320000,
      paymentMethod: "Bank (HBL)",
      driverId: 4,
      driverName: "Bilal Shah",
      destination: "Raiwind Road site",
      status: "Delivered"
    },
    {
      id: "INV-2026-004",
      date: "2026-08-18",
      clientId: 4,
      clientName: "Ahmed Bilal",
      materialId: 3,
      materialName: "Lucky Cement",
      quantity: 50,
      unit: "Bags",
      rate: 1260,
      subtotal: 63000,
      discount: 0,
      total: 63000,
      paid: 63000,
      due: 0,
      paymentMethod: "Cash",
      driverId: 3,
      driverName: "Imran Ali",
      destination: "Model Town Block B",
      status: "Delivered"
    }
  ],

  bookings: [
    {
      id: "BK-2026-101",
      date: "2026-08-15",
      clientId: 5,
      clientName: "Royal Heights Project",
      materialId: 1,
      materialName: "Fauji Cement",
      quantity: 1000,
      unit: "Bags",
      rate: 1240,
      totalAmount: 1240000,
      advancePaid: 630000,
      remainingAmount: 610000,
      dispatchedQuantity: 400,
      status: "Partially Dispatched",
      expectedDate: "2026-08-25"
    },
    {
      id: "BK-2026-102",
      date: "2026-08-17",
      clientId: 1,
      clientName: "Al-Rehman Builders",
      materialId: 2,
      materialName: "Bestway Cement",
      quantity: 500,
      unit: "Bags",
      rate: 1235,
      totalAmount: 617500,
      advancePaid: 300000,
      remainingAmount: 317500,
      dispatchedQuantity: 0,
      status: "Booked",
      expectedDate: "2026-08-22"
    }
  ],

  grns: [
    {
      id: "GRN-2026-051",
      date: "2026-08-16",
      supplierId: 1,
      supplierName: "Fauji Cement Company Ltd",
      materialId: 1,
      materialName: "Fauji Cement",
      quantity: 1000,
      unit: "Bags",
      purchaseRate: 1180,
      totalCost: 1180000,
      vehicleNo: "TK-5521",
      driver: "Nawazish Ali",
      status: "Received"
    },
    {
      id: "GRN-2026-052",
      date: "2026-08-17",
      supplierId: 2,
      supplierName: "Bestway Cement Mills",
      materialId: 2,
      materialName: "Bestway Cement",
      quantity: 800,
      unit: "Bags",
      purchaseRate: 1170,
      totalCost: 936000,
      vehicleNo: "MZ-8802",
      driver: "Shahid Rafique",
      status: "Received"
    }
  ],

  ledgerEntries: [
    { id: 1, date: "2026-08-10", type: "Client", partyId: 1, partyName: "Al-Rehman Builders", description: "Opening Balance", debit: 302000, credit: 0, balance: 302000, ref: "OB" },
    { id: 2, date: "2026-08-18", type: "Client", partyId: 1, partyName: "Al-Rehman Builders", description: "Sale Invoice INV-2026-001 (200 Bags Fauji)", debit: 248000, credit: 0, balance: 550000, ref: "INV-2026-001" },
    { id: 3, date: "2026-08-18", type: "Client", partyId: 1, partyName: "Al-Rehman Builders", description: "Cash Payment Received", debit: 0, credit: 100000, balance: 450000, ref: "REC-441" },

    { id: 4, date: "2026-08-12", type: "Client", partyId: 2, partyName: "Malik & Sons Construction", description: "Opening Balance", debit: 0, credit: 0, balance: 0, ref: "OB" },
    { id: 5, date: "2026-08-18", type: "Client", partyId: 2, partyName: "Malik & Sons Construction", description: "Sale Invoice INV-2026-002", debit: 185000, credit: 0, balance: 185000, ref: "INV-2026-002" },
    { id: 6, date: "2026-08-18", type: "Client", partyId: 2, partyName: "Malik & Sons Construction", description: "Meezan Bank Transfer Received", debit: 0, credit: 185000, balance: 0, ref: "TR-902" },

    { id: 7, date: "2026-08-01", type: "Supplier", partyId: 1, partyName: "Fauji Cement Company Ltd", description: "Opening Balance", debit: 0, credit: 570000, balance: 570000, ref: "OB" },
    { id: 8, date: "2026-08-16", type: "Supplier", partyId: 1, partyName: "Fauji Cement Company Ltd", description: "GRN-2026-051 (1000 Bags)", debit: 0, credit: 1180000, balance: 1750000, ref: "GRN-051" },
    { id: 9, date: "2026-08-17", type: "Supplier", partyId: 1, partyName: "Fauji Cement Company Ltd", description: "Bank Transfer Paid", debit: 500000, credit: 0, balance: 1250000, ref: "PAY-112" }
  ],

  accounts: [
    { id: 1, name: "Physical Cash Drawer", code: "CASH-01", type: "Cash", balance: 385000, currency: "PKR" },
    { id: 2, name: "Meezan Bank - Main Business A/c", code: "BNK-MEEZAN-01", type: "Bank", balance: 1420000, currency: "PKR" },
    { id: 3, name: "HBL - Corporate Collection A/c", code: "BNK-HBL-01", type: "Bank", balance: 850000, currency: "PKR" },
    { id: 4, name: "Petty Cash Yard", code: "CASH-YARD", type: "Cash", balance: 45000, currency: "PKR" }
  ],

  cashFlows: [
    { id: 1, date: "2026-08-18", type: "Receipt", account: "Physical Cash Drawer", category: "Client Cash Sale", description: "Sale INV-2026-004 Ahmed Bilal", amount: 63000, ref: "INV-2026-004" },
    { id: 2, date: "2026-08-18", type: "Receipt", account: "Physical Cash Drawer", category: "Client Payment", description: "Al-Rehman Builders Partial Payment", amount: 100000, ref: "REC-441" },
    { id: 3, date: "2026-08-18", type: "Receipt", account: "Meezan Bank", category: "Bank Deposit", description: "Malik & Sons INV-2026-002 Settlement", amount: 185000, ref: "TR-902" },
    { id: 4, date: "2026-08-18", type: "Payment", account: "Physical Cash Drawer", category: "Expense", description: "Yard Unloading Labour & Tea", amount: 8500, ref: "EXP-89" },
    { id: 5, date: "2026-08-17", type: "Payment", account: "Meezan Bank", category: "Supplier Payment", description: "Fauji Cement Partial Payment", amount: 500000, ref: "PAY-112" },
    { id: 6, date: "2026-08-17", type: "Payment", account: "Physical Cash Drawer", category: "Vehicle Diesel", description: "Fuel for Truck LEA-9821 (Tariq Mehmood)", amount: 22000, ref: "EXP-88" }
  ],

  reconciliations: [
    {
      id: "REC-2026-08-17",
      date: "2026-08-17",
      accountName: "Physical Cash Drawer",
      systemBalance: 320500,
      physicalCash: 320500,
      difference: 0,
      status: "Balanced",
      auditor: "Rehman Ahmed",
      notes: "Evening cash audit verified with denominations."
    },
    {
      id: "REC-2026-08-16",
      date: "2026-08-16",
      accountName: "Physical Cash Drawer",
      systemBalance: 295000,
      physicalCash: 294800,
      difference: -200,
      status: "Discrepancy (Minor)",
      auditor: "Rehman Ahmed",
      notes: "Rs. 200 petty difference adjusted under minor cash discrepancies."
    }
  ]
};
