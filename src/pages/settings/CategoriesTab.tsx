import { useState, useEffect, FormEvent } from "react";
import { api } from "../../api";
import { MaterialCategoryRow } from "./types";
import { Modal } from "../../components/ui";

export function CategoriesTab() {
  const [categories, setCategories] = useState<MaterialCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategoryRow | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadCategories() {
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; categories: MaterialCategoryRow[] }>("/settings/categories");
      if (res.ok && res.categories) {
        setCategories(res.categories);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to load categories." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSubmittingAdd(true);
    try {
      const res = await api<{ ok: boolean; id: number; name: string; error?: string }>("/settings/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCatName.trim() })
      });
      if (res.ok) {
        setNewCatName("");
        setAddModalOpen(false);
        setFeedback({ type: "success", text: `Category "${res.name}" added successfully.` });
        loadCategories();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to add category." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to add category." });
    } finally {
      setSubmittingAdd(false);
    }
  }

  async function handleEditCategory(e: FormEvent) {
    e.preventDefault();
    if (!editingCategory || !editCatName.trim()) return;
    setSubmittingEdit(true);
    try {
      const res = await api<{ ok: boolean; name: string; error?: string }>(`/settings/categories/${editingCategory.id}`, {
        method: "POST",
        body: JSON.stringify({ name: editCatName.trim() })
      });
      if (res.ok) {
        setEditModalOpen(false);
        setEditingCategory(null);
        setFeedback({ type: "success", text: `Category renamed to "${res.name}".` });
        loadCategories();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: "error", text: res.error || "Failed to update category." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update category." });
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleToggleStatus(cat: MaterialCategoryRow) {
    try {
      const res = await api<{ ok: boolean; is_active: number }>(`/settings/categories/${cat.id}/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, is_active: res.is_active } : c))
        );
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to toggle category status." });
    }
  }

  const filtered = categories.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ? true : filterStatus === "active" ? c.is_active === 1 : c.is_active === 0;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="ui-card">
        <div className="ui-card-header">
          <div className="d-flex align-items-center gap-2">
            <h5>
              <i className="bi bi-tags-fill text-warning" /> Material Categories Directory
            </h5>
            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
              {categories.length} total
            </span>
          </div>
          <button
            type="button"
            className="btn btn-warning btn-sm fw-bold d-flex align-items-center gap-2"
            onClick={() => setAddModalOpen(true)}
          >
            <i className="bi bi-plus-circle-fill" /> Add New Category
          </button>
        </div>

        <div className="ui-card-body">
          {feedback && (
            <div
              className={`alert ${
                feedback.type === "success" ? "alert-success" : "alert-danger"
              } py-2 px-3 mb-3 d-flex align-items-center justify-content-between`}
            >
              <div className="d-flex align-items-center gap-2">
                <i className={`bi ${feedback.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white small"
                onClick={() => setFeedback(null)}
              />
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="row g-2 mb-3">
            <div className="col-md-7">
              <div className="input-group">
                <span className="input-group-text bg-body-tertiary border-secondary border-opacity-25 text-secondary">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search categories by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearch("")}>
                    <i className="bi bi-x-lg" />
                  </button>
                )}
              </div>
            </div>
            <div className="col-md-5 d-flex gap-2 justify-content-md-end">
              <select
                className="form-select w-auto"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <button className="btn btn-outline-secondary" title="Reload list" onClick={loadCategories}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          </div>

          {/* Categories Table */}
          <div className="table-responsive border border-secondary border-opacity-25 rounded-3">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-dark text-secondary small text-uppercase">
                <tr>
                  <th style={{ width: "80px" }}>ID</th>
                  <th>Category Name</th>
                  <th style={{ width: "180px" }}>Linked Materials</th>
                  <th style={{ width: "140px" }}>Status</th>
                  <th style={{ width: "160px" }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-secondary">
                      <span className="spinner-border spinner-border-sm me-2 text-warning" /> Loading categories...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-secondary">
                      {search ? "No categories matched your search criteria." : "No categories found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((cat) => (
                    <tr key={cat.id}>
                      <td className="text-secondary fw-bold">#{cat.id}</td>
                      <td>
                        <span className="fw-bold text-light">{cat.name}</span>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                          <i className="bi bi-box-seam me-1" /> {cat.materials_count || 0} items
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            cat.is_active
                              ? "bg-success-subtle text-success border border-success-subtle"
                              : "bg-secondary-subtle text-secondary border border-secondary-subtle"
                          } px-2 py-1`}
                        >
                          {cat.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            title="Edit Category Name"
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditCatName(cat.name);
                              setEditModalOpen(true);
                            }}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className={`btn ${cat.is_active ? "btn-outline-warning" : "btn-outline-success"}`}
                            title={cat.is_active ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleStatus(cat)}
                          >
                            <i className={`bi ${cat.is_active ? "bi-toggle-on" : "bi-toggle-off"}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Add Category */}
      <Modal open={addModalOpen} title="Create New Material Category" onClose={() => setAddModalOpen(false)}>
        <form onSubmit={handleAddCategory}>
          <div className="mb-3">
            <label className="form-label fw-bold small text-secondary">Category Name</label>
            <input
              type="text"
              required
              autoFocus
              className="form-control"
              placeholder="e.g. Special Cement, Chemical Additives, Steel Bars"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <div className="form-text text-muted">A clear classification name for material items.</div>
          </div>
          <div className="d-flex justify-content-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setAddModalOpen(false)}
              disabled={submittingAdd}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-warning fw-bold" disabled={submittingAdd || !newCatName.trim()}>
              {submittingAdd ? "Creating..." : "Create Category"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Category */}
      <Modal open={editModalOpen} title="Edit Category Name" onClose={() => setEditModalOpen(false)}>
        <form onSubmit={handleEditCategory}>
          <div className="mb-3">
            <label className="form-label fw-bold small text-secondary">Category Name</label>
            <input
              type="text"
              required
              autoFocus
              className="form-control"
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
            />
          </div>
          <div className="d-flex justify-content-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={submittingEdit}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-warning fw-bold" disabled={submittingEdit || !editCatName.trim()}>
              {submittingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
