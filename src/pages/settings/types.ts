export type SettingsRow = {
  id?: number;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  currency?: string;
  tax_rate?: number;
  ui_theme?: string;
  allow_global_negative_stock?: number;
};

export type MaterialCategoryRow = {
  id: number;
  name: string;
  is_active: number;
  created_at?: string;
  materials_count?: number;
};

export type UserRow = {
  id: number;
  username: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  created_at?: string;
  can_view_stock?: number;
  can_view_daily?: number;
  can_view_history?: number;
  can_import_export?: number;
  can_manage_directory?: number;
  can_view_dashboard?: number;
  can_manage_grn?: number;
  can_manage_bookings?: number;
  can_manage_payments?: number;
  can_manage_sales?: number;
  can_view_delivery_rent?: number;
  can_manage_pending_bills?: number;
  can_view_reports?: number;
  can_manage_notifications?: number;
  can_view_client_ledger?: number;
  can_view_supplier_ledger?: number;
  can_view_decision_ledger?: number;
  can_manage_clients?: number;
  can_manage_suppliers?: number;
  can_manage_materials?: number;
  can_manage_delivery_persons?: number;
  can_access_settings?: number;
  restrict_backdated_edit?: number;
  can_manage_accounts?: number;
  can_view_cash_flow?: number;
};

export type AuditLogRow = {
  id: string;
  username: string;
  action: string;
  details?: string;
  timestamp: string;
};

export type LoginSessionRow = {
  id: number;
  user_id: number;
  username: string;
  role: string;
  token: string;
  ip_address?: string;
  user_agent?: string;
  last_seen_at: string;
  created_at: string;
};
