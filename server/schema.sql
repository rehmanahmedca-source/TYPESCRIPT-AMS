PRAGMA foreign_keys = OFF;

CREATE TABLE account (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	type VARCHAR(50) NOT NULL, 
	category VARCHAR(20) NOT NULL, 
	source_category VARCHAR(100), 
	account_type VARCHAR(50) NOT NULL, 
	balance FLOAT, 
	balance_minor BIGINT, 
	opening_balance FLOAT, 
	opening_balance_minor BIGINT, 
	opening_balance_date DATETIME, 
	bank_name VARCHAR(100), 
	account_holder_name VARCHAR(100), 
	account_number VARCHAR(50), 
	branch_code VARCHAR(50), 
	is_active BOOLEAN, 
	revision INTEGER, 
	created_at DATETIME, 
	updated_at DATETIME, 
	updated_by VARCHAR(80), 
	note VARCHAR(500), 
	PRIMARY KEY (id)
);

CREATE TABLE account_category (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	note VARCHAR(300), 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE account_reconciliation (
	id INTEGER NOT NULL, 
	account_id INTEGER NOT NULL, 
	previous_reconciliation_id INTEGER, 
	adjustment_transaction_id INTEGER, 
	reconciliation_date DATE NOT NULL, 
	period_start_at DATETIME, 
	period_end_at DATETIME, 
	previous_balance FLOAT, 
	opening_balance FLOAT, 
	transaction_in FLOAT, 
	transaction_out FLOAT, 
	transaction_net FLOAT, 
	expected_balance FLOAT, 
	actual_balance FLOAT, 
	difference FLOAT, 
	adjustment_amount FLOAT, 
	final_reconciled_balance FLOAT, 
	previous_balance_minor BIGINT, 
	opening_balance_minor BIGINT, 
	transaction_in_minor BIGINT, 
	transaction_out_minor BIGINT, 
	transaction_net_minor BIGINT, 
	expected_balance_minor BIGINT, 
	actual_balance_minor BIGINT, 
	difference_minor BIGINT, 
	final_reconciled_balance_minor BIGINT, 
	difference_type VARCHAR(20), 
	status VARCHAR(20), 
	note VARCHAR(500), 
	created_by_id INTEGER, 
	created_by VARCHAR(80), 
	created_ip VARCHAR(80), 
	session_id VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES account (id), 
	FOREIGN KEY(previous_reconciliation_id) REFERENCES account_reconciliation (id)
);

CREATE TABLE account_transaction (
	id INTEGER NOT NULL, 
	from_account_id INTEGER, 
	to_account_id INTEGER, 
	amount FLOAT, 
	amount_minor BIGINT, 
	description VARCHAR(200), 
	date_posted DATETIME, 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	transaction_type VARCHAR(50), 
	source_type VARCHAR(50), 
	source_id INTEGER, 
	reconciliation_id INTEGER, 
	created_by VARCHAR(80), 
	voided_by VARCHAR(80), 
	voided_at DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(from_account_id) REFERENCES account (id), 
	FOREIGN KEY(to_account_id) REFERENCES account (id), 
	FOREIGN KEY(reconciliation_id) REFERENCES account_reconciliation (id)
);

CREATE TABLE accounting_audit_log (
	id VARCHAR(36) NOT NULL, 
	module VARCHAR(50) NOT NULL, 
	action VARCHAR(30) NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id INTEGER, 
	user_id INTEGER, 
	username VARCHAR(80), 
	ip_address VARCHAR(80), 
	session_id VARCHAR(80), 
	before_json TEXT, 
	after_json TEXT, 
	amount_before_minor BIGINT, 
	amount_after_minor BIGINT, 
	account_before_id INTEGER, 
	account_after_id INTEGER, 
	party_before_id INTEGER, 
	party_after_id INTEGER, 
	reason VARCHAR(500), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE audit_log (
	id VARCHAR(36) NOT NULL, 
	user_id INTEGER, 
	username VARCHAR(80), 
	action VARCHAR(200) NOT NULL, 
	details VARCHAR(1000), 
	timestamp DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE bill_counter (
	id INTEGER NOT NULL, 
	namespace VARCHAR(12) NOT NULL, 
	count INTEGER, 
	PRIMARY KEY (id)
);

CREATE TABLE booking (
	id INTEGER NOT NULL, 
	client_name VARCHAR(100), 
	amount FLOAT, 
	paid_amount FLOAT, 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	photo_path VARCHAR(200), 
	photo_url VARCHAR(500), 
	date_posted DATETIME, 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	discount FLOAT, 
	discount_reason VARCHAR(200), 
	receive_in_account_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(receive_in_account_id) REFERENCES account (id)
);

CREATE TABLE booking_allocation (
	id INTEGER NOT NULL, 
	sale_id INTEGER NOT NULL, 
	sale_item_id INTEGER NOT NULL, 
	booking_item_id INTEGER NOT NULL, 
	qty FLOAT, 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id), 
	FOREIGN KEY(sale_item_id) REFERENCES direct_sale_item (id), 
	FOREIGN KEY(booking_item_id) REFERENCES booking_item (id)
);

CREATE TABLE booking_allocation_repair_archive (
	id INTEGER NOT NULL, 
	original_allocation_id INTEGER NOT NULL, 
	sale_id INTEGER NOT NULL, 
	sale_item_id INTEGER NOT NULL, 
	booking_item_id INTEGER NOT NULL, 
	qty FLOAT, 
	was_void BOOLEAN, 
	violations VARCHAR(200) NOT NULL, 
	repair_reason VARCHAR(500) NOT NULL, 
	repair_run_id VARCHAR(64) NOT NULL, 
	source_row_json TEXT NOT NULL, 
	sale_snapshot_json TEXT, 
	sale_item_snapshot_json TEXT, 
	booking_item_snapshot_json TEXT, 
	booking_snapshot_json TEXT, 
	archived_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE booking_item (
	id INTEGER NOT NULL, 
	booking_id INTEGER NOT NULL, 
	material_name VARCHAR(100), 
	qty FLOAT, 
	price_at_time FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(booking_id) REFERENCES booking (id)
);

CREATE TABLE cash_flow_category (
	id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	direction VARCHAR(10), 
	is_active BOOLEAN, 
	sort_order INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE cash_flow_difference_adjustment (
	id INTEGER NOT NULL, 
	adjustment_date DATE NOT NULL, 
	amount FLOAT, 
	note VARCHAR(500), 
	physical_cash_available FLOAT, 
	calculated_closing FLOAT, 
	difference FLOAT, 
	reason VARCHAR(500), 
	old_physical_cash FLOAT, 
	edited_by VARCHAR(80), 
	edited_date DATETIME, 
	edit_count INTEGER, 
	created_by VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_cash_flow_difference_adjustment_date UNIQUE (adjustment_date)
);

CREATE TABLE cash_flow_entry (
	id INTEGER NOT NULL, 
	direction VARCHAR(10) NOT NULL, 
	amount FLOAT, 
	account_id INTEGER, 
	category_id INTEGER, 
	subcategory_id INTEGER, 
	party_id INTEGER, 
	party_name VARCHAR(160), 
	party_type VARCHAR(40), 
	description VARCHAR(200), 
	note VARCHAR(500), 
	date_posted DATETIME, 
	created_by VARCHAR(80), 
	account_tx_id INTEGER, 
	is_void BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES account (id), 
	FOREIGN KEY(category_id) REFERENCES cash_flow_category (id), 
	FOREIGN KEY(subcategory_id) REFERENCES cash_flow_subcategory (id), 
	FOREIGN KEY(party_id) REFERENCES cash_flow_party (id), 
	FOREIGN KEY(account_tx_id) REFERENCES account_transaction (id)
);

CREATE TABLE cash_flow_party (
	id INTEGER NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	party_type VARCHAR(40), 
	phone VARCHAR(40), 
	note VARCHAR(300), 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE cash_flow_reconciliation_audit (
	id INTEGER NOT NULL, 
	reconciliation_id INTEGER NOT NULL, 
	adjustment_date DATE NOT NULL, 
	change_type VARCHAR(20) NOT NULL, 
	old_physical_cash FLOAT, 
	new_physical_cash FLOAT, 
	old_difference FLOAT, 
	new_difference FLOAT, 
	old_reason VARCHAR(500), 
	new_reason VARCHAR(500), 
	changed_by VARCHAR(80), 
	changed_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reconciliation_id) REFERENCES cash_flow_difference_adjustment (id)
);

CREATE TABLE cash_flow_subcategory (
	id INTEGER NOT NULL, 
	category_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(category_id) REFERENCES cash_flow_category (id)
);

CREATE TABLE client (
	id INTEGER NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	phone VARCHAR(20), 
	address VARCHAR(200), 
	category VARCHAR(50), 
	opening_balance FLOAT, 
	opening_balance_date DATETIME, 
	is_active BOOLEAN, 
	transferred_to_id INTEGER, 
	require_manual_invoice BOOLEAN, 
	book_no VARCHAR(50), 
	financial_page VARCHAR(50), 
	cement_page VARCHAR(50), 
	steel_page VARCHAR(50), 
	financial_book_no VARCHAR(50), 
	cement_book_no VARCHAR(50), 
	steel_book_no VARCHAR(50), 
	location_url VARCHAR(500), 
	page_notes VARCHAR(300), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(transferred_to_id) REFERENCES client (id)
);

CREATE TABLE delivery (
	id INTEGER NOT NULL, 
	client_name VARCHAR(100), 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	photo_path VARCHAR(200), 
	date_posted DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE delivery_item (
	id INTEGER NOT NULL, 
	delivery_id INTEGER NOT NULL, 
	product VARCHAR(100), 
	qty FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(delivery_id) REFERENCES delivery (id)
);

CREATE TABLE delivery_person (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	phone VARCHAR(30), 
	opening_balance FLOAT, 
	opening_balance_date DATETIME, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE delivery_person_payment (
	id INTEGER NOT NULL, 
	delivery_person_id INTEGER NOT NULL, 
	sale_id INTEGER, 
	allocation_id INTEGER, 
	amount_paid FLOAT, 
	amount_paid_minor BIGINT, 
	waive_off_amount FLOAT, 
	waive_off_minor BIGINT, 
	payment_account_id INTEGER, 
	method VARCHAR(50), 
	reference VARCHAR(50), 
	note VARCHAR(500), 
	date_posted DATETIME, 
	idempotency_key VARCHAR(64), 
	revision INTEGER, 
	created_by VARCHAR(80), 
	updated_by VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(delivery_person_id) REFERENCES delivery_person (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id), 
	FOREIGN KEY(allocation_id) REFERENCES sale_delivery_persons (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE delivery_rent (
	id INTEGER NOT NULL, 
	sale_id INTEGER, 
	delivery_person_name VARCHAR(100) NOT NULL, 
	bill_no VARCHAR(50), 
	amount FLOAT, 
	note VARCHAR(500), 
	date_posted DATETIME, 
	created_by VARCHAR(80), 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id)
);

CREATE TABLE direct_sale (
	id INTEGER NOT NULL, 
	idempotency_key VARCHAR(64), 
	client_name VARCHAR(100), 
	client_code VARCHAR(50), 
	category VARCHAR(50), 
	amount FLOAT, 
	paid_amount FLOAT, 
	discount FLOAT, 
	discount_reason VARCHAR(200), 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	photo_path VARCHAR(200), 
	photo_url VARCHAR(500), 
	invoice_id INTEGER, 
	date_posted DATETIME, 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	driver_name VARCHAR(100), 
	rent_item_revenue FLOAT, 
	delivery_rent_cost FLOAT, 
	rent_variance_loss FLOAT, 
	payment_method VARCHAR(50), 
	payment_account_id INTEGER, 
	bank_name VARCHAR(100), 
	account_name VARCHAR(100), 
	account_no VARCHAR(50), 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoice (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE direct_sale_draft (
	id INTEGER NOT NULL, 
	client_code VARCHAR(50), 
	client_name VARCHAR(100), 
	manual_client_name VARCHAR(100), 
	category VARCHAR(50), 
	driver_name VARCHAR(100), 
	manual_bill_no VARCHAR(50), 
	item_count INTEGER, 
	total_qty FLOAT, 
	total_amount FLOAT, 
	payload TEXT, 
	created_by VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE direct_sale_item (
	id INTEGER NOT NULL, 
	sale_id INTEGER NOT NULL, 
	product_name VARCHAR(100), 
	qty FLOAT, 
	price_at_time FLOAT, 
	grn_item_id INTEGER, 
	cost_rate_at_sale FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id), 
	FOREIGN KEY(grn_item_id) REFERENCES grn_item (id)
);

CREATE TABLE entry (
	id INTEGER NOT NULL, 
	date VARCHAR(20), 
	time VARCHAR(20), 
	type VARCHAR(10), 
	material VARCHAR(100), 
	client VARCHAR(100), 
	client_code VARCHAR(50), 
	client_category VARCHAR(50), 
	qty FLOAT, 
	bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	nimbus_no VARCHAR(50), 
	invoice_id INTEGER, 
	created_by VARCHAR(80), 
	created_at DATETIME, 
	is_void BOOLEAN, 
	transaction_category VARCHAR(50), 
	driver_name VARCHAR(100), 
	note VARCHAR(500), 
	booked_material VARCHAR(100), 
	is_alternate BOOLEAN, 
	source_module VARCHAR(50), 
	source_table VARCHAR(50), 
	source_id INTEGER, 
	source_bill_no VARCHAR(50), 
	transaction_type VARCHAR(50), 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoice (id)
);

CREATE TABLE fbm_cash_drawer_category (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE fbm_cash_drawer_entry (
	id INTEGER NOT NULL, 
	entry_type VARCHAR(10), 
	amount FLOAT, 
	category VARCHAR(100), 
	method VARCHAR(20), 
	note VARCHAR(500), 
	source VARCHAR(20), 
	date_posted DATETIME, 
	created_by VARCHAR(80), 
	is_void BOOLEAN, 
	PRIMARY KEY (id)
);

CREATE TABLE fbm_client (
	id INTEGER NOT NULL, 
	full_name VARCHAR(150) NOT NULL, 
	address VARCHAR(250), 
	phone VARCHAR(50), 
	identity_card VARCHAR(100), 
	is_active BOOLEAN, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE fbm_rental (
	id INTEGER NOT NULL, 
	client_id INTEGER NOT NULL, 
	item_id INTEGER NOT NULL, 
	qty INTEGER, 
	rent_per_unit FLOAT, 
	total_amount FLOAT, 
	qty_returned INTEGER, 
	paid_amount FLOAT, 
	discount_amount FLOAT, 
	start_datetime DATETIME, 
	return_datetime DATETIME, 
	status VARCHAR(20), 
	payment_account_id INTEGER, 
	note VARCHAR(500), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(client_id) REFERENCES fbm_client (id), 
	FOREIGN KEY(item_id) REFERENCES fbm_rental_item (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE fbm_rental_item (
	id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	opening_qty INTEGER, 
	available_qty INTEGER, 
	rent_per_day FLOAT, 
	is_void BOOLEAN, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE follow_up_contact (
	id INTEGER NOT NULL, 
	pending_bill_id INTEGER NOT NULL, 
	reminder_id INTEGER, 
	contacted_at DATETIME NOT NULL, 
	channel VARCHAR(30), 
	response VARCHAR(200), 
	note VARCHAR(500), 
	created_by VARCHAR(80), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(pending_bill_id) REFERENCES pending_bill (id), 
	FOREIGN KEY(reminder_id) REFERENCES follow_up_reminder (id)
);

CREATE TABLE follow_up_reminder (
	id INTEGER NOT NULL, 
	pending_bill_id INTEGER NOT NULL, 
	remind_at DATETIME NOT NULL, 
	note VARCHAR(500), 
	is_done BOOLEAN, 
	alerted_at DATETIME, 
	acknowledged_at DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(pending_bill_id) REFERENCES pending_bill (id)
);

CREATE TABLE future_account_audit_log (
	id INTEGER NOT NULL, 
	message VARCHAR(500), 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE grn (
	id INTEGER NOT NULL, 
	supplier_id INTEGER, 
	supplier VARCHAR(100), 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	photo_path VARCHAR(200), 
	photo_url VARCHAR(500), 
	loading_cost FLOAT, 
	freight_cost FLOAT, 
	other_expense FLOAT, 
	adjustment_amount FLOAT, 
	discount FLOAT, 
	paid_amount FLOAT, 
	payment_type VARCHAR(50), 
	payment_account_id INTEGER, 
	tax_percent FLOAT, 
	tax_amount FLOAT, 
	tax_type VARCHAR(50), 
	bank_name VARCHAR(100), 
	account_name VARCHAR(100), 
	account_no VARCHAR(50), 
	supplier_invoice_no VARCHAR(50), 
	due_date DATE, 
	bill_date DATE, 
	date_posted DATETIME, 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	PRIMARY KEY (id), 
	FOREIGN KEY(supplier_id) REFERENCES supplier (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE grn_allocation (
	id INTEGER NOT NULL, 
	sale_id INTEGER NOT NULL, 
	sale_item_id INTEGER NOT NULL, 
	grn_item_id INTEGER NOT NULL, 
	qty FLOAT, 
	cost_rate FLOAT, 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id), 
	FOREIGN KEY(sale_item_id) REFERENCES direct_sale_item (id), 
	FOREIGN KEY(grn_item_id) REFERENCES grn_item (id)
);

CREATE TABLE grn_item (
	id INTEGER NOT NULL, 
	grn_id INTEGER NOT NULL, 
	mat_name VARCHAR(100), 
	qty FLOAT, 
	price_at_time FLOAT, 
	is_void BOOLEAN, 
	is_locked BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(grn_id) REFERENCES grn (id)
);

CREATE TABLE import_history_entry (
	id INTEGER NOT NULL, 
	import_job_id INTEGER NOT NULL, 
	event_type VARCHAR(50) NOT NULL, 
	sheet_name VARCHAR(50), 
	row_number INTEGER, 
	message TEXT, 
	status_snapshot JSON, 
	recorded_at DATETIME NOT NULL, 
	created_by VARCHAR(100), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(import_job_id) REFERENCES import_job (id)
);

CREATE TABLE import_job (
	id INTEGER NOT NULL, 
	upload_id INTEGER NOT NULL, 
	started_at DATETIME, 
	finished_at DATETIME, 
	status VARCHAR(20) NOT NULL, 
	current_sheet VARCHAR(50), 
	current_row INTEGER, 
	total_rows INTEGER, 
	processed_rows INTEGER, 
	error_message TEXT, 
	import_stats JSON, 
	initiated_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (upload_id), 
	FOREIGN KEY(upload_id) REFERENCES import_upload (id), 
	FOREIGN KEY(initiated_by) REFERENCES user (id)
);

CREATE TABLE import_upload (
	id INTEGER NOT NULL, 
	upload_id VARCHAR(36) NOT NULL, 
	filename VARCHAR(255) NOT NULL, 
	stored_filename VARCHAR(255) NOT NULL, 
	size_bytes INTEGER NOT NULL, 
	uploaded_by INTEGER, 
	uploaded_at DATETIME NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	notes TEXT, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploaded_by) REFERENCES user (id)
);

CREATE TABLE invoice (
	id INTEGER NOT NULL, 
	client_code VARCHAR(50), 
	client_name VARCHAR(100), 
	invoice_no VARCHAR(50), 
	is_manual BOOLEAN, 
	date DATE, 
	total_amount FLOAT, 
	balance FLOAT, 
	status VARCHAR(20), 
	is_cash BOOLEAN, 
	created_at VARCHAR(50), 
	created_by VARCHAR(80), 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	PRIMARY KEY (id)
);

CREATE TABLE material (
	id INTEGER NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	category_id INTEGER, 
	unit_price FLOAT, 
	total FLOAT, 
	unit VARCHAR(20), 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(category_id) REFERENCES material_category (id)
);

CREATE TABLE material_category (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE material_return (
	id INTEGER NOT NULL, 
	client_name VARCHAR(100), 
	return_type VARCHAR(20), 
	amount FLOAT, 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	date_posted DATETIME, 
	note VARCHAR(500), 
	payment_id INTEGER, 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(payment_id) REFERENCES payment (id)
);

CREATE TABLE material_return_item (
	id INTEGER NOT NULL, 
	material_return_id INTEGER NOT NULL, 
	material_name VARCHAR(100), 
	qty FLOAT, 
	unit_rate FLOAT, 
	rent_rate FLOAT, 
	price_at_time FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(material_return_id) REFERENCES material_return (id)
);

CREATE TABLE payment (
	id INTEGER NOT NULL, 
	client_id INTEGER, 
	client_name VARCHAR(100), 
	amount FLOAT, 
	amount_minor BIGINT, 
	method VARCHAR(50), 
	payment_type VARCHAR(30), 
	source_type VARCHAR(50), 
	source_id INTEGER, 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	photo_path VARCHAR(200), 
	photo_url VARCHAR(500), 
	date_posted DATETIME, 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	discount FLOAT, 
	discount_minor BIGINT, 
	discount_reason VARCHAR(200), 
	bank_name VARCHAR(100), 
	account_name VARCHAR(100), 
	account_no VARCHAR(50), 
	payment_account_id INTEGER, 
	idempotency_key VARCHAR(64), 
	revision INTEGER, 
	created_by VARCHAR(80), 
	updated_by VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(client_id) REFERENCES client (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE pending_bill (
	id INTEGER NOT NULL, 
	client_code VARCHAR(50), 
	client_name VARCHAR(100), 
	bill_no VARCHAR(50), 
	bill_kind VARCHAR(10), 
	nimbus_no VARCHAR(50), 
	amount FLOAT, 
	reason VARCHAR(200), 
	photo_url VARCHAR(200), 
	photo_path VARCHAR(200), 
	is_paid BOOLEAN, 
	is_cash BOOLEAN, 
	is_manual BOOLEAN, 
	created_at VARCHAR(50), 
	created_by VARCHAR(80), 
	is_void BOOLEAN, 
	note VARCHAR(500), 
	risk_override VARCHAR(20), 
	source_module VARCHAR(50), 
	source_table VARCHAR(50), 
	source_id INTEGER, 
	source_bill_no VARCHAR(50), 
	transaction_type VARCHAR(50), 
	PRIMARY KEY (id)
);

CREATE TABLE recon_basket (
	id INTEGER NOT NULL, 
	bill_no VARCHAR(50), 
	inv_date DATE, 
	inv_client VARCHAR(100), 
	fin_client VARCHAR(100), 
	inv_material VARCHAR(100), 
	inv_qty FLOAT, 
	status VARCHAR(20), 
	match_score INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE root_backup_email_history (
	id INTEGER NOT NULL, 
	trigger_type VARCHAR(30) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	recipient_emails VARCHAR(1000), 
	subject VARCHAR(300), 
	attachment_name VARCHAR(255), 
	attachment_size_kb INTEGER, 
	backup_path VARCHAR(1000), 
	message VARCHAR(1000), 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE root_backup_settings (
	id INTEGER NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	frequency VARCHAR(20) NOT NULL, 
	recipient_emails VARCHAR(1000), 
	include_full_raw_xlsx BOOLEAN NOT NULL, 
	include_sqlite_db BOOLEAN NOT NULL, 
	subject_prefix VARCHAR(120) NOT NULL, 
	keep_history_count INTEGER NOT NULL, 
	last_sent_at DATETIME, 
	last_status VARCHAR(20), 
	last_message VARCHAR(500), 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE root_recovery_code (
	id INTEGER NOT NULL, 
	username VARCHAR(80) NOT NULL, 
	code_hash VARCHAR(255) NOT NULL, 
	created_at DATETIME, 
	used_at DATETIME, 
	generated_by VARCHAR(80), 
	note VARCHAR(300), 
	PRIMARY KEY (id)
);

CREATE TABLE sale_delivery_persons (
	id INTEGER NOT NULL, 
	sale_id INTEGER NOT NULL, 
	delivery_person_id INTEGER NOT NULL, 
	bags_delivered FLOAT, 
	rent_amount FLOAT, 
	created_at DATETIME, 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES direct_sale (id), 
	FOREIGN KEY(delivery_person_id) REFERENCES delivery_person (id)
);

CREATE TABLE schema_version (
	id INTEGER NOT NULL, 
	version INTEGER, 
	applied_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE settings (
	id INTEGER NOT NULL, 
	currency VARCHAR(10), 
	company_name VARCHAR(100), 
	company_address VARCHAR(200), 
	company_phone VARCHAR(50), 
	company_email VARCHAR(100), 
	tax_rate FLOAT, 
	invoice_prefix VARCHAR(10), 
	bill_prefix VARCHAR(10), 
	ui_theme VARCHAR(20), 
	allow_global_negative_stock BOOLEAN NOT NULL, 
	google_client_id VARCHAR(500), 
	google_client_secret VARCHAR(500), 
	google_refresh_token VARCHAR(1000), 
	google_access_token VARCHAR(1000), 
	google_token_expiry VARCHAR(50), 
	google_sender_email VARCHAR(200), 
	PRIMARY KEY (id)
);

CREATE TABLE staff_email (
	id INTEGER NOT NULL, 
	email VARCHAR(200) NOT NULL, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (email)
);

CREATE TABLE supplier (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	phone VARCHAR(20), 
	address VARCHAR(200), 
	opening_balance FLOAT, 
	opening_balance_date DATETIME, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE supplier_payment (
	id INTEGER NOT NULL, 
	supplier_id INTEGER NOT NULL, 
	amount FLOAT, 
	amount_minor BIGINT, 
	method VARCHAR(50), 
	payment_type VARCHAR(30), 
	source_type VARCHAR(50), 
	source_id INTEGER, 
	date_posted DATETIME, 
	note VARCHAR(500), 
	is_void BOOLEAN, 
	bank_name VARCHAR(100), 
	account_name VARCHAR(100), 
	account_no VARCHAR(50), 
	payment_account_id INTEGER, 
	manual_bill_no VARCHAR(50), 
	auto_bill_no VARCHAR(50), 
	idempotency_key VARCHAR(64), 
	revision INTEGER, 
	created_by VARCHAR(80), 
	updated_by VARCHAR(80), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(supplier_id) REFERENCES supplier (id), 
	FOREIGN KEY(payment_account_id) REFERENCES account (id)
);

CREATE TABLE system_lock (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	owner VARCHAR(100), 
	acquired_at DATETIME, 
	ttl_seconds INTEGER, 
	note VARCHAR(500), 
	PRIMARY KEY (id)
);

CREATE TABLE tenant_wipe_backup_history (
	id INTEGER NOT NULL, 
	tenant_name VARCHAR(120), 
	performed_by VARCHAR(80), 
	targets VARCHAR(1000), 
	backup_filename VARCHAR(255), 
	backup_path VARCHAR(1000), 
	wipe_status VARCHAR(20), 
	note VARCHAR(500), 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE user (
	id INTEGER NOT NULL, 
	username VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(200), 
	password_plain VARCHAR(200), 
	role VARCHAR(20), 
	status VARCHAR(20), 
	can_view_stock BOOLEAN, 
	can_view_daily BOOLEAN, 
	can_view_history BOOLEAN, 
	can_import_export BOOLEAN, 
	can_manage_directory BOOLEAN, 
	can_view_dashboard BOOLEAN, 
	can_manage_grn BOOLEAN, 
	can_manage_bookings BOOLEAN, 
	can_manage_payments BOOLEAN, 
	can_manage_sales BOOLEAN, 
	can_view_delivery_rent BOOLEAN, 
	can_manage_pending_bills BOOLEAN, 
	can_view_reports BOOLEAN, 
	can_manage_notifications BOOLEAN, 
	can_view_client_ledger BOOLEAN, 
	can_view_supplier_ledger BOOLEAN, 
	can_view_decision_ledger BOOLEAN, 
	can_manage_clients BOOLEAN, 
	can_manage_suppliers BOOLEAN, 
	can_manage_materials BOOLEAN, 
	can_manage_delivery_persons BOOLEAN, 
	can_access_settings BOOLEAN, 
	restrict_backdated_edit BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE user_login_session (
	id INTEGER NOT NULL, 
	sid VARCHAR(40) NOT NULL, 
	user_id INTEGER NOT NULL, 
	username VARCHAR(80), 
	role VARCHAR(20), 
	ip VARCHAR(80), 
	user_agent VARCHAR(300), 
	created_at DATETIME, 
	last_seen_at DATETIME, 
	ended_at DATETIME, 
	PRIMARY KEY (id)
);

CREATE TABLE waive_off (
	id INTEGER NOT NULL, 
	payment_id INTEGER, 
	client_code VARCHAR(50), 
	client_name VARCHAR(100), 
	bill_no VARCHAR(50), 
	amount FLOAT, 
	reason VARCHAR(300), 
	date_posted DATETIME, 
	created_by VARCHAR(80), 
	note VARCHAR(500), 
	is_void BOOLEAN, 
	PRIMARY KEY (id), 
	FOREIGN KEY(payment_id) REFERENCES payment (id)
);

PRAGMA foreign_keys = ON;
