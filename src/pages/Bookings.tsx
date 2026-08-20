import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "../components/ui";
import { api } from "../api";
import { money } from "../format";
import { useApi } from "../useApi";

type BookingItem = {
  id?: number;
  booking_id?: number;
  material_name: string;
  qty: number;
  price_at_time: number;
};

type Booking = {
  id: number;
  client_name: string;
  client_code?: string;
  auto_bill_no: string;
  manual_bill_no: string;
  date_posted: string;
  amount: number;
  paid_amount: number;
  discount: number;
  discount_reason?: string;
  is_void: number;
  note: string;
  photo_path?: string;
  photo_url?: string;
  receive_in_account_id?: number;
  items: BookingItem[];
};

type Client = { id: number; code: string; name: string };
type Material = { id: number; name: string; unit_price: number; unit?: string };
type Account = { id: number; name: string; bank_name?: string; category?: string };

type Pagination = {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
  prev_num: number;
  next_num: number;
};

type ItemLine = {
  id?: number;
  material_name: string;
  qty: string;
  unit_rate: string;
};

function formatPrecision(val: number | string): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export default function Bookings() {
  const [showMode, setShowMode] = useState<string>("active");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterBill, setFilterBill] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [perPage, setPerPage] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  // Active query string for useApi
  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (showMode) params.set("show", showMode);
    if (filterClient) params.set("client", filterClient);
    if (filterBill) params.set("bill_no", filterBill);
    if (filterDateFrom) params.set("date_from", filterDateFrom);
    if (filterDateTo) params.set("date_to", filterDateTo);
    params.set("per_page", String(perPage));
    params.set("page", String(page));
    return `/bookings?${params.toString()}`;
  }, [showMode, filterClient, filterBill, filterDateFrom, filterDateTo, perPage, page]);

  const { data, reload, error: fetchError } = useApi<{
    bookings: Booking[];
    clients: Client[];
    materials: Material[];
    accounts: Account[];
    next_auto: string;
    show_mode: string;
    pagination: Pagination;
  }>(queryUrl);

  const clients = data?.clients || [];
  const materials = data?.materials || [];
  const accounts = data?.accounts || [];
  const bookings = data?.bookings || [];
  const pagination = data?.pagination;
  const nextAuto = data?.next_auto || "BK-000001";

  // Material price lookup map
  const materialPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of materials) {
      if (m.name) map.set(m.name.trim().toLowerCase(), Number(m.unit_price || 0));
    }
    return map;
  }, [materials]);

  // Form & Modal States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Add form fields
  const [addClientCode, setAddClientCode] = useState<string>("");
  const [addClientDisplay, setAddClientDisplay] = useState<string>("");
  const [addClientComboOpen, setAddClientComboOpen] = useState<boolean>(false);
  const [addItems, setAddItems] = useState<ItemLine[]>([
    { material_name: "", qty: "1", unit_rate: "" }
  ]);
  const [addPaidAmount, setAddPaidAmount] = useState<string>("0");
  const [addPaymentMethod, setAddPaymentMethod] = useState<string>("Cash");
  const [addPaymentAccountId, setAddPaymentAccountId] = useState<string>("");
  const [addDate, setAddDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [addDiscount, setAddDiscount] = useState<string>("0");
  const [addDiscountReason, setAddDiscountReason] = useState<string>("");
  const [addManualBill, setAddManualBill] = useState<string>("");
  const [addPhotoUrl, setAddPhotoUrl] = useState<string>("");
  const [addNote, setAddNote] = useState<string>("");

  // Edit form fields
  const [editClientCode, setEditClientCode] = useState<string>("");
  const [editClientDisplay, setEditClientDisplay] = useState<string>("");
  const [editClientComboOpen, setEditClientComboOpen] = useState<boolean>(false);
  const [editItems, setEditItems] = useState<ItemLine[]>([]);
  const [editPaidAmount, setEditPaidAmount] = useState<string>("0");
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("Cash");
  const [editPaymentAccountId, setEditPaymentAccountId] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editDiscount, setEditDiscount] = useState<string>("0");
  const [editDiscountReason, setEditDiscountReason] = useState<string>("");
  const [editManualBill, setEditManualBill] = useState<string>("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");

  // Filter Combobox State
  const [filterComboOpen, setFilterComboOpen] = useState<boolean>(false);

  // Filter accounts based on payment method
  const filteredAccountsAdd = useMemo(() => {
    const want = addPaymentMethod.toLowerCase() === "bank" ? "bank" : "cash";
    return accounts.filter((a) => !a.category || a.category.toLowerCase() === want);
  }, [accounts, addPaymentMethod]);

  const filteredAccountsEdit = useMemo(() => {
    const want = editPaymentMethod.toLowerCase() === "bank" ? "bank" : "cash";
    return accounts.filter((a) => !a.category || a.category.toLowerCase() === want);
  }, [accounts, editPaymentMethod]);

  // Total calculations
  const addTotalAmount = useMemo(() => {
    return addItems.reduce((sum, item) => {
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.unit_rate) || 0;
      return sum + q * r;
    }, 0);
  }, [addItems]);

  const editTotalAmount = useMemo(() => {
    return editItems.reduce((sum, item) => {
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.unit_rate) || 0;
      return sum + q * r;
    }, 0);
  }, [editItems]);

  // Combobox filter for clients in filter bar
  const matchingClientsFilter = useMemo(() => {
    const q = filterClient.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [clients, filterClient]);

  // Combobox filter for add modal
  const matchingClientsAdd = useMemo(() => {
    const q = addClientCode.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [clients, addClientCode]);

  // Combobox filter for edit modal
  const matchingClientsEdit = useMemo(() => {
    const q = editClientCode.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [clients, editClientCode]);

  function resetAddForm() {
    setAddClientCode("");
    setAddClientDisplay("");
    setAddItems([{ material_name: "", qty: "1", unit_rate: "" }]);
    setAddPaidAmount("0");
    setAddPaymentMethod("Cash");
    setAddPaymentAccountId("");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setAddDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setAddDiscount("0");
    setAddDiscountReason("");
    setAddManualBill("");
    setAddPhotoUrl("");
    setAddNote("");
    setErrorMessage("");
  }

  function openEditModal(booking: Booking) {
    setEditingBooking(booking);
    setEditClientCode(booking.client_code || booking.client_name);
    setEditClientDisplay(booking.client_name);
    setEditItems(
      (booking.items || []).map((i) => ({
        id: i.id,
        material_name: i.material_name,
        qty: String(i.qty),
        unit_rate: String(i.price_at_time)
      }))
    );
    setEditPaidAmount(String(booking.paid_amount || 0));
    setEditPaymentMethod("Cash");
    setEditPaymentAccountId(booking.receive_in_account_id ? String(booking.receive_in_account_id) : "");
    if (booking.date_posted) {
      const d = new Date(booking.date_posted);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setEditDate(booking.date_posted.slice(0, 16));
      }
    } else {
      setEditDate("");
    }
    setEditDiscount(String(booking.discount || 0));
    setEditDiscountReason(booking.discount_reason || "");
    setEditManualBill(booking.manual_bill_no || "");
    setEditPhotoUrl(booking.photo_url || "");
    setEditNote(booking.note || "");
    setErrorMessage("");
  }

  // Row operations for Add
  function handleAddMaterialChange(idx: number, name: string) {
    const updated = [...addItems];
    updated[idx].material_name = name;
    const price = materialPriceMap.get(name.trim().toLowerCase());
    if (price !== undefined) {
      updated[idx].unit_rate = formatPrecision(price);
    }
    setAddItems(updated);
  }

  function handleAddQtyChange(idx: number, delta: number) {
    const updated = [...addItems];
    const cur = parseFloat(updated[idx].qty) || 0;
    const nextVal = Math.max(0, cur + delta);
    updated[idx].qty = formatPrecision(nextVal);
    setAddItems(updated);
  }

  function removeAddItemRow(idx: number) {
    if (addItems.length <= 1) {
      setAddItems([{ material_name: "", qty: "1", unit_rate: "" }]);
    } else {
      setAddItems(addItems.filter((_, i) => i !== idx));
    }
  }

  // Row operations for Edit
  function handleEditMaterialChange(idx: number, name: string) {
    const updated = [...editItems];
    updated[idx].material_name = name;
    const price = materialPriceMap.get(name.trim().toLowerCase());
    if (price !== undefined) {
      updated[idx].unit_rate = formatPrecision(price);
    }
    setEditItems(updated);
  }

  function handleEditQtyChange(idx: number, delta: number) {
    const updated = [...editItems];
    const cur = parseFloat(updated[idx].qty) || 0;
    const nextVal = Math.max(0, cur + delta);
    updated[idx].qty = formatPrecision(nextVal);
    setEditItems(updated);
  }

  function removeEditItemRow(idx: number) {
    if (editItems.length <= 1) {
      setEditItems([{ material_name: "", qty: "1", unit_rate: "" }]);
    } else {
      setEditItems(editItems.filter((_, i) => i !== idx));
    }
  }

  // Submission handlers
  async function handleSaveNewBooking(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    const paidVal = parseFloat(addPaidAmount) || 0;
    if (paidVal > 0 && !addPaymentAccountId) {
      setErrorMessage("Receive Into Account is required when Paid Now is greater than 0.");
      return;
    }

    try {
      const payload = {
        client_code: addClientCode,
        amount: addTotalAmount,
        paid_amount: paidVal,
        payment_method: addPaymentMethod,
        payment_account_id: addPaymentAccountId ? Number(addPaymentAccountId) : null,
        date: addDate,
        discount: parseFloat(addDiscount) || 0,
        discount_reason: addDiscountReason,
        manual_bill_no: addManualBill,
        photo_url: addPhotoUrl,
        note: addNote,
        items: addItems.map((it) => ({
          material_name: it.material_name,
          qty: parseFloat(it.qty) || 0,
          unit_rate: parseFloat(it.unit_rate) || 0
        }))
      };

      await api("/add_booking", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      resetAddForm();
      setSuccessMessage("Booking added successfully.");
      setTimeout(() => setSuccessMessage(""), 4000);
      reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleUpdateBooking(e: FormEvent) {
    e.preventDefault();
    if (!editingBooking) return;
    setErrorMessage("");

    try {
      const payload = {
        client_code: editClientCode,
        amount: editTotalAmount,
        paid_amount: parseFloat(editPaidAmount) || 0,
        payment_method: editPaymentMethod,
        payment_account_id: editPaymentAccountId ? Number(editPaymentAccountId) : null,
        date: editDate,
        discount: parseFloat(editDiscount) || 0,
        discount_reason: editDiscountReason,
        manual_bill_no: editManualBill,
        photo_url: editPhotoUrl,
        note: editNote,
        items: editItems.map((it) => ({
          id: it.id,
          booking_item_id: it.id,
          material_name: it.material_name,
          qty: parseFloat(it.qty) || 0,
          unit_rate: parseFloat(it.unit_rate) || 0
        }))
      };

      await api(`/edit_bill/Booking/${editingBooking.id}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setEditingBooking(null);
      setSuccessMessage("Booking updated successfully.");
      setTimeout(() => setSuccessMessage(""), 4000);
      reload();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteBooking(booking: Booking) {
    if (!confirm("Permanently delete this booking and reverse related accounts?")) return;
    try {
      await api(`/delete_transaction/Booking/${booking.id}`, { method: "POST" });
      setSuccessMessage(`Booking ${booking.auto_bill_no || booking.id} deleted.`);
      setTimeout(() => setSuccessMessage(""), 4000);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToggleVoid(booking: Booking) {
    const action = booking.is_void ? "unvoid" : "void";
    const conf = booking.is_void
      ? `Unvoid booking ${booking.auto_bill_no || booking.id}?`
      : `Void booking ${booking.auto_bill_no || booking.id}? This will reverse pending bill records.`;
    if (!confirm(conf)) return;
    try {
      await api(`/bookings/${booking.id}/${action}`, { method: "POST" });
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <h2 className="fw-bold text-warning mb-0">
          <i className="bi bi-calendar-check me-2"></i>Bookings
        </h2>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/" className="btn btn-outline-light btn-sm fw-bold">
            <i className="bi bi-arrow-left me-1"></i> Back
          </Link>
          <button
            className="btn btn-warning btn-sm text-dark fw-bold"
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
          >
            <i className="bi bi-plus-lg"></i> Add Booking
          </button>
        </div>
      </div>

      {/* Mode Switches */}
      <div className="d-flex gap-2 flex-wrap mb-3">
        <button
          className={`btn btn-sm ${showMode === "active" ? "btn-warning text-dark" : "btn-outline-warning"} fw-bold`}
          onClick={() => {
            setShowMode("active");
            setPage(1);
          }}
        >
          All Bookings
        </button>
        <button
          className={`btn btn-sm ${showMode === "void" ? "btn-warning text-dark" : "btn-outline-warning"} fw-bold`}
          onClick={() => {
            setShowMode("void");
            setPage(1);
          }}
        >
          Voided Bookings
        </button>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          <i className="bi bi-check-circle me-2"></i>
          {successMessage}
        </div>
      )}
      {fetchError && (
        <div className="alert alert-danger mb-3" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {fetchError}
        </div>
      )}

      {/* Filter Form Card */}
      <div
        className="card border-0 shadow-sm p-3 mb-3 ui-helper-form bookings-filter-form"
        style={{ background: "#1e293b", border: "2px solid #475569 !important", borderRadius: "12px" }}
      >
        <div className="row g-2 form-grid-top">
          {/* Client Filter */}
          <div className="col-12 col-lg-4 position-relative">
            <label className="text-white-50 small fw-bold mb-1">Client Name</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder="Search by name or code..."
                autoComplete="off"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                onFocus={() => setFilterComboOpen(true)}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setFilterComboOpen(!filterComboOpen)}
              >
                <i className="bi bi-chevron-down text-warning"></i>
              </button>
            </div>
            {filterComboOpen && (
              <div
                className="combobox-list shadow-lg position-absolute w-100 mt-1"
                style={{
                  zIndex: 1050,
                  maxHeight: "220px",
                  overflowY: "auto",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px"
                }}
              >
                <div
                  className="p-2 border-bottom border-secondary text-white-50 small cursor-pointer hover:bg-slate-800"
                  onClick={() => {
                    setFilterClient("");
                    setFilterComboOpen(false);
                  }}
                >
                  <span className="text-warning fw-bold">Clear client filter</span>
                </div>
                {matchingClientsFilter.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 border-bottom border-secondary cursor-pointer hover:bg-slate-800 d-flex justify-content-between"
                    onClick={() => {
                      setFilterClient(c.code);
                      setFilterComboOpen(false);
                    }}
                  >
                    <span className="fw-bold text-warning">{c.code}</span>
                    <span className="text-white-50 small">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bill No Filter */}
          <div className="col-12 col-lg-3">
            <label className="text-white-50 small fw-bold mb-1">Bill No</label>
            <input
              type="text"
              className="form-control bg-dark text-white border-secondary"
              placeholder="Manual / Auto bill no..."
              value={filterBill}
              onChange={(e) => setFilterBill(e.target.value)}
            />
          </div>

          {/* Date From */}
          <div className="col-6 col-lg-2">
            <label className="text-white-50 small fw-bold mb-1">Date From</label>
            <input
              type="date"
              className="form-control bg-dark text-white border-secondary"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="col-6 col-lg-2">
            <label className="text-white-50 small fw-bold mb-1">Date To</label>
            <input
              type="date"
              className="form-control bg-dark text-white border-secondary"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          {/* Rows / Per page */}
          <div className="col-6 col-lg-1">
            <label className="text-white-50 small fw-bold mb-1">Rows</label>
            <select
              className="form-select bg-dark text-white border-secondary"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-2 gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-light fw-bold"
            onClick={() => {
              setFilterClient("");
              setFilterBill("");
              setFilterDateFrom("");
              setFilterDateTo("");
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Bookings Table Card */}
      <div
        className="card border-0 shadow-sm"
        style={{ background: "#1e293b", border: "2px solid #475569 !important", borderRadius: "15px", overflow: "hidden" }}
      >
        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle mb-0">
            <thead style={{ background: "#0f172a" }}>
              <tr>
                <th className="fw-bold py-3 ps-4 border-bottom border-secondary text-white-50">Manual Bill</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Auto Bill</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Client</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Material</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Qty</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Total Amount</th>
                <th className="fw-bold py-3 border-bottom border-secondary text-white-50">Actually Paid</th>
                <th className="fw-bold py-3 text-end pe-4 border-bottom border-secondary text-white-50">Actions</th>
              </tr>
            </thead>
            <tbody style={{ background: "#1e293b" }}>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-white-50">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const billRef = booking.manual_bill_no || booking.auto_bill_no || `BK-${booking.id}`;
                  return (
                    <tr
                      key={booking.id}
                      style={{
                        borderBottom: "1px solid #334155",
                        opacity: booking.is_void ? 0.5 : 1,
                        textDecoration: booking.is_void ? "line-through" : "none"
                      }}
                    >
                      <td className="ps-4">
                        {booking.manual_bill_no ? (
                          <Link
                            to={`/view_bill?bill_no=${encodeURIComponent(booking.manual_bill_no)}&src=booking&src_id=${booking.id}&client_name=${encodeURIComponent(booking.client_name)}`}
                            className="badge bg-dark border border-secondary text-warning text-decoration-none"
                          >
                            {booking.manual_bill_no}
                          </Link>
                        ) : (
                          <span className="text-white-50 small">No Bill</span>
                        )}
                      </td>
                      <td>
                        {booking.auto_bill_no ? (
                          <Link
                            to={`/view_bill?bill_no=${encodeURIComponent(booking.auto_bill_no)}&src=booking&src_id=${booking.id}&client_name=${encodeURIComponent(booking.client_name)}`}
                            className="badge bg-dark border border-secondary text-info text-decoration-none"
                          >
                            {booking.auto_bill_no}
                          </Link>
                        ) : (
                          <span className="text-white-50 small">-</span>
                        )}
                      </td>
                      <td className="text-white">{booking.client_name}</td>
                      <td className="text-white">
                        {booking.items && booking.items.length > 0 ? booking.items[0].material_name : "-"}
                      </td>
                      <td className="text-info fw-bold">
                        {booking.items && booking.items.length > 0 ? booking.items[0].qty : 0}
                      </td>
                      <td className="text-danger fw-bold">{money(booking.amount)}</td>
                      <td className="text-success fw-bold">{money(booking.paid_amount)}</td>
                      <td className="text-end pe-4">
                        <Link
                          to={`/view_bill?bill_no=${encodeURIComponent(billRef)}&src=booking&src_id=${booking.id}&client_name=${encodeURIComponent(booking.client_name)}`}
                          className="btn btn-outline-info btn-sm border-2 rounded-pill shadow-sm me-1"
                          title="View"
                        >
                          <i className="bi bi-eye"></i>
                        </Link>
                        <a
                          href={`/api/download_invoice?bill_no=${encodeURIComponent(billRef)}&src=booking&src_id=${booking.id}&client_name=${encodeURIComponent(booking.client_name)}`}
                          className="btn btn-outline-warning btn-sm border-2 rounded-pill shadow-sm me-1"
                          title="Download PDF"
                        >
                          <i className="bi bi-download"></i>
                        </a>
                        <a
                          href={`/api/download_invoice?bill_no=${encodeURIComponent(billRef)}&action=print&src=booking&src_id=${booking.id}&client_name=${encodeURIComponent(booking.client_name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline-success btn-sm border-2 rounded-pill shadow-sm me-1"
                          title="Print PDF"
                        >
                          <i className="bi bi-printer"></i>
                        </a>
                        {booking.photo_path && (
                          <a
                            href={`/api/uploads/${booking.photo_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline-light btn-sm border-2 rounded-pill shadow-sm me-1"
                            title="View Photo"
                          >
                            <i className="bi bi-image"></i>
                          </a>
                        )}
                        {booking.photo_url && (
                          <a
                            href={booking.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline-light btn-sm border-2 rounded-pill shadow-sm me-1"
                            title="View URL"
                          >
                            <i className="bi bi-link-45deg"></i>
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-warning btn-sm border-2 rounded-pill shadow-sm me-1"
                          onClick={() => openEditModal(booking)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm border-2 rounded-pill shadow-sm me-1"
                          onClick={() => handleToggleVoid(booking)}
                          title={booking.is_void ? "Unvoid" : "Void"}
                        >
                          <i className={`bi bi-${booking.is_void ? "arrow-counterclockwise" : "slash-circle"}`}></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm border-2 rounded-pill shadow-sm"
                          onClick={() => handleDeleteBooking(booking)}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <nav aria-label="Bookings pagination" className="d-flex justify-content-center mt-3">
          <ul className="pagination pagination-sm mb-0">
            {pagination.has_prev && (
              <li className="page-item">
                <button
                  className="page-link bg-dark border-secondary text-warning"
                  onClick={() => setPage(pagination.prev_num)}
                >
                  Previous
                </button>
              </li>
            )}
            <li className="page-item active">
              <span className="page-link bg-warning border-warning text-dark fw-bold">
                {pagination.page} / {pagination.pages}
              </span>
            </li>
            {pagination.has_next && (
              <li className="page-item">
                <button
                  className="page-link bg-dark border-secondary text-warning"
                  onClick={() => setPage(pagination.next_num)}
                >
                  Next
                </button>
              </li>
            )}
          </ul>
        </nav>
      )}

      {/* ========================================================================= */}
      {/* ADD BOOKING MODAL */}
      {/* ========================================================================= */}
      <Modal
        open={showAddModal}
        title="New Booking"
        onClose={() => setShowAddModal(false)}
        size="lg"
        footer={
          <div className="d-flex gap-2 w-100">
            <button
              type="button"
              className="btn btn-outline-secondary flex-grow-1 py-2 rounded-pill fw-bold"
              onClick={resetAddForm}
            >
              Reset
            </button>
            <button
              type="submit"
              form="addBookingForm"
              className="btn btn-warning text-dark fw-bold flex-grow-1 py-2 rounded-pill"
            >
              Save Booking
            </button>
          </div>
        }
      >
        <form id="addBookingForm" onSubmit={handleSaveNewBooking} className="ui-helper-form">
          {errorMessage && (
            <div className="alert alert-danger mb-3" role="alert">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {errorMessage}
            </div>
          )}

          {/* Client Selection */}
          <div className="mb-3 position-relative">
            <label className="text-white-50 small fw-bold mb-1">CLIENT (NAME OR CODE)</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder="Search by name or code..."
                autoComplete="off"
                required
                value={addClientCode}
                onChange={(e) => {
                  setAddClientCode(e.target.value);
                  const found = clients.find(
                    (c) => c.code.toLowerCase() === e.target.value.toLowerCase() || c.name.toLowerCase() === e.target.value.toLowerCase()
                  );
                  setAddClientDisplay(found ? found.name : "");
                }}
                onFocus={() => setAddClientComboOpen(true)}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setAddClientComboOpen(!addClientComboOpen)}
              >
                <i className="bi bi-chevron-down text-warning"></i>
              </button>
            </div>
            {addClientComboOpen && (
              <div
                className="combobox-list shadow-lg position-absolute w-100 mt-1"
                style={{
                  zIndex: 1050,
                  maxHeight: "200px",
                  overflowY: "auto",
                  background: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px"
                }}
              >
                {matchingClientsAdd.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 border-bottom border-secondary cursor-pointer hover:bg-slate-800 d-flex justify-content-between"
                    onClick={() => {
                      setAddClientCode(c.code);
                      setAddClientDisplay(c.name);
                      setAddClientComboOpen(false);
                    }}
                  >
                    <span className="fw-bold text-warning">{c.code}</span>
                    <span className="text-white-50 small">{c.name}</span>
                  </div>
                ))}
              </div>
            )}
            {addClientDisplay && (
              <div className="text-info small mt-1 fw-bold">Name: {addClientDisplay}</div>
            )}
          </div>

          {/* Items Header */}
          <div
            className="d-none d-md-grid mb-2 px-2 text-white-50 small fw-bold"
            style={{ gridTemplateColumns: "3.4fr 2.2fr 2.2fr 2.2fr auto", columnGap: "0.5rem" }}
          >
            <div className="text-center">MATERIAL</div>
            <div className="text-center">QTY</div>
            <div className="text-center">UNIT PRICE</div>
            <div className="text-center">ITEM TOTAL</div>
            <div className="text-center">REMOVE</div>
          </div>

          {/* Items Container */}
          <div className="mb-3">
            {addItems.map((item, idx) => {
              const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_rate) || 0);
              return (
                <div key={idx} className="mb-3 p-2 rounded border border-secondary bg-dark">
                  <div
                    className="d-grid align-items-center"
                    style={{ gridTemplateColumns: "3.4fr 2.2fr 2.2fr 2.2fr auto", columnGap: "0.5rem" }}
                  >
                    {/* Material Input / Select */}
                    <div>
                      <select
                        className="form-select form-select-sm bg-dark text-white border-secondary"
                        value={item.material_name}
                        onChange={(e) => handleAddMaterialChange(idx, e.target.value)}
                        required
                      >
                        <option value="">Select Material...</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Qty Input with +/- buttons */}
                    <div>
                      <div className="input-group input-group-sm">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          type="button"
                          onClick={() => handleAddQtyChange(idx, -1)}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={item.qty}
                          onChange={(e) => {
                            const copy = [...addItems];
                            copy[idx].qty = e.target.value;
                            setAddItems(copy);
                          }}
                          className="form-control bg-dark text-white border-secondary text-center"
                          required
                        />
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          type="button"
                          onClick={() => handleAddQtyChange(idx, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Rate Input */}
                    <div>
                      <input
                        type="number"
                        step="any"
                        value={item.unit_rate}
                        onChange={(e) => {
                          const copy = [...addItems];
                          copy[idx].unit_rate = e.target.value;
                          setAddItems(copy);
                        }}
                        className="form-control form-control-sm bg-dark text-white border-secondary"
                        placeholder="Rate"
                        required
                      />
                    </div>

                    {/* Line Total */}
                    <div>
                      <input
                        type="text"
                        value={formatPrecision(lineTotal)}
                        className="form-control form-control-sm bg-dark text-info border-secondary text-center"
                        placeholder="Item Total"
                        readOnly
                        tabIndex={-1}
                      />
                    </div>

                    {/* Remove button */}
                    <div className="text-center">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeAddItemRow(idx)}
                        title="Remove item"
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-warning mb-3 w-100"
            onClick={() => setAddItems([...addItems, { material_name: "", qty: "1", unit_rate: "" }])}
          >
            + Add More Items
          </button>

          {/* Amount and Paid Now */}
          <div className="row">
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">TOTAL AMOUNT</label>
              <input
                type="number"
                step="any"
                className="form-control bg-dark text-white border-secondary"
                value={formatPrecision(addTotalAmount)}
                readOnly
              />
            </div>
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">PAID NOW</label>
              <input
                type="number"
                step="0.01"
                className="form-control bg-dark text-white border-secondary"
                value={addPaidAmount}
                onChange={(e) => setAddPaidAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Receive Method & Account */}
          <div className="row">
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">RECEIVE METHOD</label>
              <select
                className="form-select bg-dark text-white border-secondary"
                value={addPaymentMethod}
                onChange={(e) => {
                  setAddPaymentMethod(e.target.value);
                  setAddPaymentAccountId("");
                }}
              >
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">RECEIVE INTO ACCOUNT</label>
              <select
                className="form-select bg-dark text-white border-secondary"
                value={addPaymentAccountId}
                onChange={(e) => setAddPaymentAccountId(e.target.value)}
              >
                <option value="">Select account...</option>
                {filteredAccountsAdd.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.bank_name ? ` (${acc.bank_name})` : ""}
                  </option>
                ))}
              </select>
              <small className="text-white-50">Required when Paid Now is greater than 0.</small>
            </div>
          </div>

          {/* Booking Date */}
          <div className="mb-3">
            <label className="text-white-50 small fw-bold mb-1">BOOKING DATE & TIME</label>
            <input
              type="datetime-local"
              className="form-control bg-dark text-white border-secondary"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
            />
          </div>

          {/* Discount & Reason */}
          <div className="row">
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">DISCOUNT (LOSS)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="form-control bg-dark text-white border-secondary"
                value={addDiscount}
                onChange={(e) => setAddDiscount(e.target.value)}
              />
            </div>
            <div className="col-6 mb-3">
              <label className="text-white-50 small fw-bold mb-1">DISCOUNT REASON</label>
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder="Optional reason"
                value={addDiscountReason}
                onChange={(e) => setAddDiscountReason(e.target.value)}
              />
            </div>
          </div>

          {/* Bill Numbers */}
          <div className="mb-3">
            <label className="text-white-50 small fw-bold mb-1">AUTO BILL NO</label>
            <input
              type="text"
              className="form-control bg-dark text-white border-secondary"
              value={nextAuto}
              readOnly
            />
          </div>
          <div className="mb-3">
            <label className="text-white-50 small fw-bold mb-1">MANUAL BILL NO</label>
            <input
              type="text"
              className="form-control bg-dark text-white border-secondary"
              placeholder="e.g. 1004"
              value={addManualBill}
              onChange={(e) => setAddManualBill(e.target.value)}
            />
          </div>

          {/* Photo URL */}
          <div className="mb-3">
            <label className="text-white-50 small fw-bold mb-1">PHOTO URL (Optional)</label>
            <input
              type="url"
              className="form-control bg-dark text-white border-secondary"
              placeholder="https://..."
              value={addPhotoUrl}
              onChange={(e) => setAddPhotoUrl(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="text-white-50 small fw-bold mb-1">NOTES</label>
            <textarea
              className="form-control bg-dark text-white border-secondary"
              rows={2}
              placeholder="Add booking notes..."
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT BOOKING MODAL */}
      {/* ========================================================================= */}
      <Modal
        open={!!editingBooking}
        title={`Edit Booking: ${editingBooking?.manual_bill_no || editingBooking?.auto_bill_no || "No Bill"}`}
        onClose={() => setEditingBooking(null)}
        size="lg"
        footer={
          <button
            type="submit"
            form="editBookingForm"
            className="btn btn-warning text-dark fw-bold w-100 py-2 rounded-pill"
          >
            Save Changes
          </button>
        }
      >
        {editingBooking && (
          <form id="editBookingForm" onSubmit={handleUpdateBooking} className="ui-helper-form">
            {errorMessage && (
              <div className="alert alert-danger mb-3" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {errorMessage}
              </div>
            )}

            {/* Client Selection */}
            <div className="mb-3 position-relative">
              <label className="text-white-50 small fw-bold mb-1">CLIENT (NAME OR CODE)</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control bg-dark text-white border-secondary"
                  placeholder="Search by name or code..."
                  autoComplete="off"
                  required
                  value={editClientCode}
                  onChange={(e) => {
                    setEditClientCode(e.target.value);
                    const found = clients.find(
                      (c) => c.code.toLowerCase() === e.target.value.toLowerCase() || c.name.toLowerCase() === e.target.value.toLowerCase()
                    );
                    setEditClientDisplay(found ? found.name : "");
                  }}
                  onFocus={() => setEditClientComboOpen(true)}
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setEditClientComboOpen(!editClientComboOpen)}
                >
                  <i className="bi bi-chevron-down text-warning"></i>
                </button>
              </div>
              {editClientComboOpen && (
                <div
                  className="combobox-list shadow-lg position-absolute w-100 mt-1"
                  style={{
                    zIndex: 1050,
                    maxHeight: "200px",
                    overflowY: "auto",
                    background: "#0f172a",
                    border: "1px solid #475569",
                    borderRadius: "6px"
                  }}
                >
                  {matchingClientsEdit.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 border-bottom border-secondary cursor-pointer hover:bg-slate-800 d-flex justify-content-between"
                      onClick={() => {
                        setEditClientCode(c.code);
                        setEditClientDisplay(c.name);
                        setEditClientComboOpen(false);
                      }}
                    >
                      <span className="fw-bold text-warning">{c.code}</span>
                      <span className="text-white-50 small">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {editClientDisplay && (
                <div className="text-info small mt-1 fw-bold">Name: {editClientDisplay}</div>
              )}
            </div>

            {/* Items Header */}
            <div
              className="d-none d-md-grid mb-2 px-2 text-white-50 small fw-bold"
              style={{ gridTemplateColumns: "3.4fr 2.2fr 2.2fr 2.2fr auto", columnGap: "0.5rem" }}
            >
              <div className="text-center">MATERIAL</div>
              <div className="text-center">QTY</div>
              <div className="text-center">UNIT PRICE</div>
              <div className="text-center">ITEM TOTAL</div>
              <div className="text-center">REMOVE</div>
            </div>

            {/* Items Container */}
            <div className="mb-3">
              {editItems.map((item, idx) => {
                const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_rate) || 0);
                return (
                  <div key={idx} className="mb-3 p-2 rounded border border-secondary bg-dark">
                    <div
                      className="d-grid align-items-center"
                      style={{ gridTemplateColumns: "3.4fr 2.2fr 2.2fr 2.2fr auto", columnGap: "0.5rem" }}
                    >
                      {/* Material Select */}
                      <div>
                        <select
                          className="form-select form-select-sm bg-dark text-white border-secondary"
                          value={item.material_name}
                          onChange={(e) => handleEditMaterialChange(idx, e.target.value)}
                          required
                        >
                          <option value="">Select Material...</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Qty Input with +/- */}
                      <div>
                        <div className="input-group input-group-sm">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => handleEditQtyChange(idx, -1)}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="any"
                            value={item.qty}
                            onChange={(e) => {
                              const copy = [...editItems];
                              copy[idx].qty = e.target.value;
                              setEditItems(copy);
                            }}
                            className="form-control bg-dark text-white border-secondary text-center"
                            required
                          />
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => handleEditQtyChange(idx, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Rate */}
                      <div>
                        <input
                          type="number"
                          step="any"
                          value={item.unit_rate}
                          onChange={(e) => {
                            const copy = [...editItems];
                            copy[idx].unit_rate = e.target.value;
                            setEditItems(copy);
                          }}
                          className="form-control form-control-sm bg-dark text-white border-secondary"
                          placeholder="Rate"
                          required
                        />
                      </div>

                      {/* Line Total */}
                      <div>
                        <input
                          type="text"
                          value={formatPrecision(lineTotal)}
                          className="form-control form-control-sm bg-dark text-info border-secondary text-center"
                          placeholder="Item Total"
                          readOnly
                          tabIndex={-1}
                        />
                      </div>

                      {/* Remove */}
                      <div className="text-center">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => removeEditItemRow(idx)}
                          title="Remove item"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-warning mb-3 w-100"
              onClick={() => setEditItems([...editItems, { material_name: "", qty: "1", unit_rate: "" }])}
            >
              + Add More Items
            </button>

            {/* Total Amount & Paid Amount */}
            <div className="row">
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">TOTAL AMOUNT</label>
                <input
                  type="number"
                  step="any"
                  className="form-control bg-dark text-white border-secondary"
                  value={formatPrecision(editTotalAmount)}
                  readOnly
                />
              </div>
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">PAID AMOUNT</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control bg-dark text-white border-secondary"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Receive Method & Account */}
            <div className="row">
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">RECEIVE METHOD</label>
                <select
                  className="form-select bg-dark text-white border-secondary"
                  value={editPaymentMethod}
                  onChange={(e) => {
                    setEditPaymentMethod(e.target.value);
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">RECEIVE INTO ACCOUNT</label>
                <select
                  className="form-select bg-dark text-white border-secondary"
                  value={editPaymentAccountId}
                  onChange={(e) => setEditPaymentAccountId(e.target.value)}
                >
                  <option value="">Keep existing / none</option>
                  {filteredAccountsEdit.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                      {acc.bank_name ? ` (${acc.bank_name})` : ""}
                    </option>
                  ))}
                </select>
                <small className="text-white-50">Needed only when increasing Paid Amount.</small>
              </div>
            </div>

            {/* Booking Date */}
            <div className="mb-3">
              <label className="text-white-50 small fw-bold mb-1">BOOKING DATE & TIME</label>
              <input
                type="datetime-local"
                className="form-control bg-dark text-white border-secondary"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            {/* Discount & Reason */}
            <div className="row">
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">DISCOUNT (LOSS)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-control bg-dark text-white border-secondary"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                />
              </div>
              <div className="col-6 mb-3">
                <label className="text-white-50 small fw-bold mb-1">DISCOUNT REASON</label>
                <input
                  type="text"
                  className="form-control bg-dark text-white border-secondary"
                  placeholder="Optional reason"
                  value={editDiscountReason}
                  onChange={(e) => setEditDiscountReason(e.target.value)}
                />
              </div>
            </div>

            {/* Auto & Manual Bill No */}
            <div className="mb-3">
              <label className="text-white-50 small fw-bold mb-1">AUTO BILL NO</label>
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                value={editingBooking.auto_bill_no || ""}
                readOnly
              />
            </div>
            <div className="mb-3">
              <label className="text-white-50 small fw-bold mb-1">MANUAL BILL NO</label>
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                value={editManualBill}
                onChange={(e) => setEditManualBill(e.target.value)}
              />
            </div>

            {/* Photo URL */}
            <div className="mb-3">
              <label className="text-white-50 small fw-bold mb-1">UPDATE URL</label>
              <input
                type="url"
                className="form-control bg-dark text-white border-secondary"
                placeholder="https://..."
                value={editPhotoUrl}
                onChange={(e) => setEditPhotoUrl(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="mb-3">
              <label className="text-white-50 small fw-bold mb-1">NOTES</label>
              <textarea
                className="form-control bg-dark text-white border-secondary"
                rows={2}
                placeholder="Add booking notes..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
