import json

import erpnext
import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from erpnext.stock.get_item_details import get_item_details
from frappe import _
from frappe.exceptions import ValidationError
from frappe.utils import cint, flt, nowdate

from klik_pos.klik_pos.utils import get_current_pos_profile

from .item.item_price import get_price_list_with_customer_priority
from .loyalty import (
	apply_loyalty_redemption,
	get_invoice_loyalty_summary,
	normalize_loyalty_redemption,
)
from .sql_builder import apply_sql_permissions

# Performance optimization: Cache frequently accessed data
_cached_company_data = {}
_cached_customer_data = {}
_cached_item_accounts = {}

QUEUE_STATUSES = {
	"queued": "Queued",
	"processing": "Processing",
	"failed": "Failed",
	"submitted": "Submitted",
}


def _set_checkbox_field_value(doc, fieldname, value):
	"""Safely set checkbox fields only when present on the document."""
	if not doc or not hasattr(doc, fieldname):
		return
	setattr(doc, fieldname, cint(bool(value)))


def _apply_klik_invoice_flags(doc, is_held=None, is_submitted=None):
	"""Track Klik-origin invoices and hold/submission state using custom checkbox fields."""
	if not doc:
		return

	_set_checkbox_field_value(doc, "custom_is_created_from_klik", 1)

	if is_held is not None:
		_set_checkbox_field_value(doc, "custom_is_held", is_held)

	if is_submitted is not None:
		_set_checkbox_field_value(doc, "custom_is_submitted", is_submitted)


def validate_required_salesperson(doc):
	"""Enforce salesperson presence for POS flows when the POS profile requires it."""
	if not doc or not getattr(doc, "is_pos", 0):
		return

	pos_profile_name = getattr(doc, "pos_profile", None)
	if not pos_profile_name:
		return

	require_sales_person = frappe.db.get_value(
		"POS Profile",
		pos_profile_name,
		"custom_sales_person_pin_required",
	)
	if not cint(require_sales_person):
		return

	sales_team = getattr(doc, "sales_team", None) or []
	has_salesperson = any(
		(row.get("sales_person") if isinstance(row, dict) else getattr(row, "sales_person", None))
		for row in sales_team
	)
	if has_salesperson:
		return

	frappe.throw(
		_("Sales person is mandatory to complete this sale. Please enter a valid salesperson PIN before continuing.")
	)

def _is_return_allowed_for_current_profile():
	"""Return True unless POS Profile explicitly disables returns."""
	try:
		pos_profile = get_current_pos_profile()
		allow_return = getattr(pos_profile, "custom_allow_return", None)
		if allow_return in (0, "0", False):
			return False
		return True
	except Exception:
		# Keep backward compatibility: do not block returns when profile resolution fails.
		return True


def _ensure_return_allowed():
	if not _is_return_allowed_for_current_profile():
		frappe.throw(_("Returns are disabled for the current POS Profile."))

def _coerce_queue_status(status):
	if not status:
		return QUEUE_STATUSES["queued"]
	if isinstance(status, str):
		normalized = status.strip().lower()
		return QUEUE_STATUSES.get(normalized, status)
	return QUEUE_STATUSES["queued"]


def _truncate_queue_error(error_message, max_length=900):
	message = str(error_message or "").strip()
	if len(message) <= max_length:
		return message
	return f"{message[:max_length].rstrip()}..."


def get_reserved_stock_map(item_codes=None, warehouse=None, exclude_invoice=None):
	"""Return reserved stock from Stock Reservation Entries keyed by (item_code, warehouse)."""
	conditions = [
		"sre.docstatus = 1",
		"sre.delivered_qty < sre.reserved_qty",
		"IFNULL(sre.item_code, '') != ''",
		"IFNULL(sre.warehouse, '') != ''",
	]
	params = []

	if item_codes:
		item_placeholders = ", ".join(["%s"] * len(item_codes))
		conditions.append(f"sre.item_code IN ({item_placeholders})")
		params.extend(list(item_codes))

	if warehouse:
		conditions.append("sre.warehouse = %s")
		params.append(warehouse)

	if exclude_invoice:
		conditions.append("NOT (sre.voucher_type = 'Sales Invoice' AND sre.voucher_no = %s)")
		params.append(exclude_invoice)

	query = f"""
		SELECT
			sre.item_code,
			sre.warehouse,
			SUM(COALESCE(sre.reserved_qty, 0) - COALESCE(sre.delivered_qty, 0) - COALESCE(sre.transferred_qty, 0) - COALESCE(sre.consumed_qty, 0)) AS reserved_qty
		FROM `tabStock Reservation Entry` sre
		WHERE {' AND '.join(conditions)}
		GROUP BY sre.item_code, sre.warehouse
	"""

	rows = frappe.db.sql(query, tuple(params), as_dict=True)
	reserved_map = {}
	for row in rows:
		reserved_map[(row.item_code, row.warehouse)] = flt(row.reserved_qty or 0)

	return reserved_map


def _get_sales_invoice_reservation_map(invoice_name, item_codes=None, warehouse=None):
	"""Return reservation qty map for one Sales Invoice from Stock Reservation Entry."""
	if not invoice_name:
		return {}

	conditions = [
		"docstatus = 1",
		"voucher_type = 'Sales Invoice'",
		"voucher_no = %s",
		"delivered_qty < reserved_qty",
	]
	params = [invoice_name]

	if item_codes:
		placeholders = ", ".join(["%s"] * len(item_codes))
		conditions.append(f"item_code IN ({placeholders})")
		params.extend(list(item_codes))

	if warehouse:
		conditions.append("warehouse = %s")
		params.append(warehouse)

	query = f"""
		SELECT
			item_code,
			warehouse,
			SUM(COALESCE(reserved_qty, 0) - COALESCE(delivered_qty, 0) - COALESCE(transferred_qty, 0) - COALESCE(consumed_qty, 0)) AS reserved_qty
		FROM `tabStock Reservation Entry`
		WHERE {' AND '.join(conditions)}
		GROUP BY item_code, warehouse
	"""

	rows = frappe.db.sql(query, tuple(params), as_dict=True)
	return {(row.item_code, row.warehouse): flt(row.reserved_qty or 0) for row in rows}


def _cancel_sales_invoice_reservations(invoice_name):
	"""Cancel active Stock Reservation Entries for a Sales Invoice."""
	if not invoice_name:
		return

	from erpnext.stock.doctype.stock_reservation_entry.stock_reservation_entry import (
		cancel_stock_reservation_entries,
	)

	cancel_stock_reservation_entries(
		voucher_type="Sales Invoice",
		voucher_no=invoice_name,
		notify=False,
	)


def _should_reserve_stock(doc):
	return bool(getattr(doc, "reserve_stock", 0))


def _reserve_stock_for_queued_invoice(doc):
	"""Create Stock Reservation Entry rows for queued Sales Invoice draft rows."""
	if not doc or doc.doctype != "Sales Invoice" or doc.docstatus != 0:
		return
	if not _should_reserve_stock(doc):
		return
	if getattr(doc, "is_return", 0):
		return

	_cancel_sales_invoice_reservations(doc.name)

	item_codes = list({row.item_code for row in doc.items if row.item_code})
	item_meta_map = {}
	if item_codes:
		item_meta_map = {
			row.name: row
			for row in frappe.get_all(
				"Item",
				filters={"name": ["in", item_codes]},
				fields=["name", "is_stock_item", "has_serial_no", "has_batch_no", "stock_uom"],
			)
		}

	for row in doc.items:
		if not row.item_code or not row.warehouse:
			continue

		item_meta = item_meta_map.get(row.item_code)
		if not item_meta or not int(item_meta.is_stock_item or 0):
			continue

		required_qty = flt(abs(getattr(row, "stock_qty", 0) or 0))
		if required_qty <= 0:
			required_qty = flt(abs(getattr(row, "qty", 0) or 0))
		if required_qty <= 0:
			continue

		actual_qty = flt(
			frappe.db.get_value(
				"Bin",
				{"item_code": row.item_code, "warehouse": row.warehouse},
				"actual_qty",
			)
			or 0
		)
		reserved_map = get_reserved_stock_map(
			item_codes=[row.item_code],
			warehouse=row.warehouse,
			exclude_invoice=doc.name,
		)
		available_to_reserve = flt(actual_qty - reserved_map.get((row.item_code, row.warehouse), 0))

		if required_qty > available_to_reserve + 1e-9:
			frappe.throw(
				_(
					"Insufficient stock to reserve for item {0} in warehouse {1}. Required: {2}, Available to reserve: {3}."
				).format(
					frappe.bold(row.item_code),
					frappe.bold(row.warehouse),
					flt(required_qty),
					flt(available_to_reserve),
				)
			)

		sre = frappe.new_doc("Stock Reservation Entry")
		sre.item_code = row.item_code
		sre.warehouse = row.warehouse
		sre.has_serial_no = int(item_meta.has_serial_no or 0)
		sre.has_batch_no = int(item_meta.has_batch_no or 0)
		sre.voucher_type = "Sales Invoice"
		sre.voucher_no = doc.name
		sre.voucher_detail_no = row.name
		sre.available_qty = available_to_reserve
		sre.voucher_qty = required_qty
		sre.reserved_qty = required_qty
		sre.company = doc.company
		sre.stock_uom = row.stock_uom or item_meta.stock_uom
		sre.project = doc.project
		sre.save(ignore_permissions=True)
		sre.submit()


def get_reserved_qty_for_item_warehouse(item_code, warehouse, exclude_invoice=None):
	reserved_map = get_reserved_stock_map(
		item_codes=[item_code],
		warehouse=warehouse,
		exclude_invoice=exclude_invoice,
	)
	return flt(reserved_map.get((item_code, warehouse), 0))


def _validate_reserved_stock_for_items(doc, exclude_invoice=None):
	"""Validate stock considering quantities reserved via Stock Reservation Entry."""
	if not _should_reserve_stock(doc):
		return
	if not getattr(doc, "items", None):
		return

	item_codes_in_doc = list({row.item_code for row in doc.items if row.item_code})
	item_stock_flag_map = {}
	if item_codes_in_doc:
		item_stock_flag_map = {
			row.name: int(row.is_stock_item or 0)
			for row in frappe.get_all(
				"Item",
				filters={"name": ["in", item_codes_in_doc]},
				fields=["name", "is_stock_item"],
			)
		}

	required_qty_map = {}
	item_codes = set()
	warehouses = set()

	for row in doc.items:
		if not row.item_code or not row.warehouse:
			continue
		if item_stock_flag_map.get(row.item_code, 1) == 0:
			continue

		required_qty = flt(abs(getattr(row, "stock_qty", 0) or 0))
		if required_qty <= 0:
			required_qty = flt(abs(getattr(row, "qty", 0) or 0))
		if required_qty <= 0:
			continue

		key = (row.item_code, row.warehouse)
		required_qty_map[key] = flt(required_qty_map.get(key, 0) + required_qty)
		item_codes.add(row.item_code)
		warehouses.add(row.warehouse)

	if not required_qty_map:
		return

	bins = frappe.get_all(
		"Bin",
		filters={"item_code": ["in", list(item_codes)], "warehouse": ["in", list(warehouses)]},
		fields=["item_code", "warehouse", "actual_qty"],
	)
	actual_qty_map = {(row.item_code, row.warehouse): flt(row.actual_qty or 0) for row in bins}

	reserved_map = get_reserved_stock_map(
		item_codes=list(item_codes),
		exclude_invoice=exclude_invoice,
	)

	insufficient = []
	for key, required_qty in required_qty_map.items():
		actual_qty = flt(actual_qty_map.get(key, 0))
		reserved_qty = flt(reserved_map.get(key, 0))
		available_qty = flt(actual_qty - reserved_qty)

		if required_qty > available_qty + 1e-9:
			insufficient.append(
				{
					"item_code": key[0],
					"warehouse": key[1],
					"required_qty": required_qty,
					"available_qty": available_qty,
					"actual_qty": actual_qty,
					"reserved_qty": reserved_qty,
				}
			)

	if insufficient:
		first = insufficient[0]
		frappe.throw(
			_(
				"Insufficient stock for item {0} in warehouse {1}. Required: {2}, Available (after stock reservations): {3}, Reserved: {4}."
			).format(
				frappe.bold(first["item_code"]),
				frappe.bold(first["warehouse"]),
				flt(first["required_qty"]),
				flt(first["available_qty"]),
				flt(first["reserved_qty"]),
			)
		)


def _update_queue_fields(doc, status, error_message=None, attempts=None):
	doc.queue_status = _coerce_queue_status(status)
	# Keep held flag unchanged for audit history; only update submitted state here.
	_apply_klik_invoice_flags(doc, is_submitted=(doc.queue_status == QUEUE_STATUSES["submitted"]))
	if hasattr(doc, "queue_error"):
		doc.queue_error = _truncate_queue_error(error_message) if error_message else ""
	if hasattr(doc, "queue_attempts") and attempts is not None:
		doc.queue_attempts = attempts
	if hasattr(doc, "queue_last_attempt_at") and status == QUEUE_STATUSES["processing"]:
		doc.queue_last_attempt_at = frappe.utils.now_datetime()


def _get_queue_failure_recipients(requested_by=None):
	recipients = set()
	user_ids = []

	if requested_by:
		user_ids.append(requested_by)

	manager_users = frappe.get_all(
		"Has Role",
		filters={"role": ["in", ["Sales Manager", "System Manager"]]},
		pluck="parent",
	)
	user_ids.extend(manager_users or [])

	for user_id in user_ids:
		try:
			user_doc = frappe.get_doc("User", user_id)
			if user_doc.enabled and user_doc.email:
				recipients.add(user_doc.email)
		except Exception:
			continue

	return list(recipients)


def _notify_queue_failure(invoice_doc, requested_by, error_message):
	subject = f"POS invoice queue failed: {invoice_doc.name}"
	body = (
		f"Invoice <b>{invoice_doc.name}</b> failed in the background queue."
		f"<br><br><b>Customer:</b> {invoice_doc.customer_name or invoice_doc.customer}"
		f"<br><b>Error:</b> {_truncate_queue_error(error_message)}"
	)

	try:
		notification = frappe.get_doc(
			{
				"doctype": "Notification Log",
				"subject": subject,
				"email_content": body,
				"for_user": requested_by or frappe.session.user,
				"type": "Alert",
			}
		)
		notification.insert(ignore_permissions=True)
	except Exception:
		pass

	recipients = _get_queue_failure_recipients(requested_by or frappe.session.user)
	if recipients:
		try:
			frappe.sendmail(recipients=recipients, subject=subject, message=body)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Failed to send queue failure alert for {invoice_doc.name}")


def _mark_invoice_queued(doc, requested_by=None):
	_update_queue_fields(doc, QUEUE_STATUSES["queued"], attempts=0)
	# Preserve held state if this queue action came from a held draft invoice.
	_apply_klik_invoice_flags(doc, is_submitted=False)
	if hasattr(doc, "queue_error"):
		doc.queue_error = ""
	if hasattr(doc, "queue_last_attempt_at"):
		doc.queue_last_attempt_at = None
	if requested_by and hasattr(doc, "owner"):
		doc.owner = requested_by


def _finalize_submitted_invoice(doc, amount_paid, mode_of_payment, business_type, customer):
	payment_entry = None
	should_create_payment_entry = False

	if business_type == "B2B":
		should_create_payment_entry = True
	elif business_type == "B2B & B2C":
		global _cached_customer_data
		if customer not in _cached_customer_data:
			_cached_customer_data[customer] = frappe.get_doc("Customer", customer)

		customer_doc = _cached_customer_data[customer]
		if customer_doc.customer_type == "Company":
			should_create_payment_entry = True

	if should_create_payment_entry and mode_of_payment and amount_paid > 0:
		try:
			payment_entry = create_payment_entry(doc, mode_of_payment, amount_paid)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Payment Entry Error for {doc.name}")
			payment_entry = None

	return payment_entry


def _get_payment_methods_from_invoice(doc):
	payment_methods = []
	for payment in getattr(doc, "payments", []) or []:
		payment_methods.append(
			{
				"method": payment.mode_of_payment,
				"amount": flt(payment.amount or 0),
			}
		)
	return payment_methods


def _get_invoice_response_summary(doc):
	return {
		"name": doc.name,
		"doctype": doc.doctype,
		"customer": doc.customer,
		"customer_name": doc.customer_name,
		"posting_date": doc.posting_date,
		"base_grand_total": doc.base_grand_total,
		"grand_total": doc.grand_total,
		"rounded_total": doc.rounded_total,
		"paid_amount": doc.paid_amount,
		"outstanding_amount": doc.outstanding_amount,
		"currency": doc.currency,
		"currency_symbol": frappe.db.get_value("Currency", doc.currency, "symbol") or doc.currency,
		"status": doc.status,
		"is_pos": doc.is_pos,
		"company": doc.company,
		"loyalty": get_invoice_loyalty_summary(doc),
	}


class PartialPaymentValidationError(ValidationError):
	pass


def get_current_pos_opening_entry():
	"""
	Get the latest active POS Opening Entry for the current user across ALL profiles.
	Returns the opening entry name or None if not found.
	"""
	try:
		user = frappe.session.user
		opening_entries = frappe.get_all(
			"POS Opening Entry",
			filters={"user": user, "docstatus": 1, "status": "Open"},
			fields=["name"],
			order_by="creation desc",
			limit_page_length=1,
		)

		if opening_entries:
			return opening_entries[0].name
		return None
	except Exception as e:
		frappe.log_error(f"Error getting current POS opening entry: {e!s}")
		return None


@frappe.whitelist(allow_guest=True)
def get_sales_invoices(limit=100, start=0, search="", skip_opening_entry_filter=False, cashier_name=None, submitted_only=False):
	"""
	Get sales invoices with proper filtering based on user role and POS opening entry.

	Args:
		skip_opening_entry_filter: If True, skip filtering by opening entry (for Invoice History page)
		cashier_name: Filter by cashier name (full name). If provided, only returns invoices for that cashier.
		submitted_only: If True, only return submitted invoices (docstatus=1). Use for Sales Dashboard; excludes Draft and Cancelled.
	"""
	try:
		if isinstance(skip_opening_entry_filter, str):
			skip_opening_entry_filter = skip_opening_entry_filter.lower() in ("true", "1", "yes")
		if isinstance(submitted_only, str):
			submitted_only = submitted_only.lower() in ("true", "1", "yes")

		limit = int(limit) if limit else 100
		start = int(start) if start else 0

		cashier_user_ids = None
		if cashier_name and cashier_name != "all":
			cashier_user_ids = _get_user_ids_by_full_name(cashier_name)
			if not cashier_user_ids:
				return {"success": True, "data": [], "total_count": 0}

		try:
			pos_doc = get_current_pos_profile()
			current_pos_profile = getattr(pos_doc, "name", None)
		except Exception:
			current_pos_profile = None

		current_opening_entry = get_current_pos_opening_entry()
		user_roles = frappe.get_roles()
		is_admin_user = "Administrator" in user_roles or "System Manager" in user_roles

		sales_invoice_meta = frappe.get_meta("Sales Invoice")
		has_zatca_status = any(df.fieldname == "custom_zatca_submit_status" for df in sales_invoice_meta.fields)
		has_custom_is_held = any(df.fieldname == "custom_is_held" for df in sales_invoice_meta.fields)
		has_custom_is_submitted = any(df.fieldname == "custom_is_submitted" for df in sales_invoice_meta.fields)
		has_custom_is_created_from_klik = any(
			df.fieldname == "custom_is_created_from_klik" for df in sales_invoice_meta.fields
		)

		select_fields = """name, posting_date, posting_time, owner, customer, customer_name,
			base_grand_total, base_rounded_total, status, discount_amount,
			total_taxes_and_charges, custom_pos_opening_entry, queue_status,
			queue_error, queue_attempts, queue_last_attempt_at, pos_profile, currency, custom_is_printed"""
		if has_zatca_status:
			select_fields += ", custom_zatca_submit_status"
		if has_custom_is_held:
			select_fields += ", custom_is_held"
		if has_custom_is_submitted:
			select_fields += ", custom_is_submitted"
		if has_custom_is_created_from_klik:
			select_fields += ", custom_is_created_from_klik"

		conditions = []
		params = []

		if not skip_opening_entry_filter:
			if is_admin_user:
				conditions.append("si.custom_pos_opening_entry != ''")
			elif current_opening_entry:
				conditions.append("si.custom_pos_opening_entry = %s")
				params.append(current_opening_entry)
			else:
				conditions.append("si.custom_pos_opening_entry != ''")

		if submitted_only:
			conditions.append("si.docstatus = 1")

		if cashier_user_ids:
			if len(cashier_user_ids) == 1:
				conditions.append("si.owner = %s")
				params.append(cashier_user_ids[0])
			else:
				placeholders = ", ".join(["%s"] * len(cashier_user_ids))
				conditions.append(f"si.owner IN ({placeholders})")
				params.extend(cashier_user_ids)

		if current_pos_profile and not is_admin_user:
			conditions.append("si.pos_profile = %s")
			params.append(current_pos_profile)

		if search and search.strip():
			search_term = f"%{search.strip()}%"
			conditions.append("(si.name LIKE %s OR si.customer_name LIKE %s OR si.customer LIKE %s)")
			params.extend([search_term, search_term, search_term])

		where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

		count_sql = apply_sql_permissions(
			f"SELECT COUNT(*) as total FROM `tabSales Invoice` si {where_clause}"
		)
		count_result = frappe.db.sql(count_sql, tuple(params), as_dict=True)
		total_count = count_result[0]["total"] if count_result else 0

		main_sql = apply_sql_permissions(f"""
			SELECT {select_fields}
			FROM `tabSales Invoice` si
			{where_clause}
			ORDER BY si.modified DESC
			LIMIT %s OFFSET %s
		""")
		invoices = frappe.db.sql(main_sql, (*params, limit, start), as_dict=True)

		if not invoices:
			return {"success": True, "data": [], "total_count": total_count}

		invoice_names = [inv.name for inv in invoices]
		user_ids = list(set([inv.owner for inv in invoices]))

		cashier_names_map = _batch_fetch_cashier_names(user_ids)
		payment_methods_map = _batch_fetch_payment_methods(invoice_names)
		items_map = _batch_fetch_items(invoice_names)

		_process_invoices(invoices, cashier_names_map, payment_methods_map, items_map)

		return {"success": True, "data": invoices, "total_count": total_count}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching sales invoices")
		return {"success": False, "error": str(e)}

def _get_user_ids_by_full_name(full_name):
	"""Get user IDs (emails) that match the given full name."""
	try:
		users = frappe.get_all(
			"User",
			filters={"full_name": full_name, "enabled": 1},
			fields=["name"],
		)
		return [user.name for user in users] if users else []
	except Exception as e:
		frappe.logger().error(f"Error getting user IDs by full name '{full_name}': {e}")
		return []


def _sql_in_clause(values):
	"""Build a parameterized SQL IN clause for dynamic value lists."""
	values = list(values or [])
	return ", ".join(["%s"] * len(values)), tuple(values)


def _batch_fetch_cashier_names(user_ids):
	"""Batch fetch cashier names for given user IDs."""
	if not user_ids:
		return {}

	placeholders, params = _sql_in_clause(user_ids)
	cashier_query = """
		SELECT name, full_name
		FROM `tabUser`
		WHERE name IN ({})
	""".format(placeholders)
	cashier_results = frappe.db.sql(cashier_query, params, as_dict=True)
	return {user.name: user.full_name or user.name for user in cashier_results}


def _batch_fetch_payment_methods(invoice_names):
	"""Batch fetch payment methods for given invoices."""
	if not invoice_names:
		return {}

	placeholders, params = _sql_in_clause(invoice_names)
	payment_query = """
		SELECT parent, mode_of_payment, amount
		FROM `tabSales Invoice Payment`
		WHERE parent IN ({})
	""".format(placeholders)
	payment_results = frappe.db.sql(payment_query, params, as_dict=True)

	# Group by parent invoice
	payment_methods_map = {}
	for payment in payment_results:
		if payment.parent not in payment_methods_map:
			payment_methods_map[payment.parent] = []
		payment_methods_map[payment.parent].append(
			{"mode_of_payment": payment.mode_of_payment, "amount": payment.amount}
		)

	return payment_methods_map


def _batch_fetch_items(invoice_names):
	"""Batch fetch items for given invoices."""
	if not invoice_names:
		return {}

	placeholders, params = _sql_in_clause(invoice_names)
	items_query = """
		SELECT parent, item_code, qty, rate, amount
		FROM `tabSales Invoice Item`
		WHERE parent IN ({})
	""".format(placeholders)
	items_results = frappe.db.sql(items_query, params, as_dict=True)

	# Group by parent invoice
	items_map = {}
	for item in items_results:
		if item.parent not in items_map:
			items_map[item.parent] = []
		items_map[item.parent].append(
			{
				"item_code": item.item_code,
				"qty": item.qty,
				"rate": item.rate,
				"amount": item.amount,
				"quantity": item.qty,
			}
		)

	return items_map


def _process_invoices(invoices, cashier_names_map, payment_methods_map, items_map):
	"""Process and enrich invoices with related data."""
	for inv in invoices:
		# Set cashier name
		inv["cashier_name"] = cashier_names_map.get(inv.owner, inv.owner)

		# Format posting_time
		if inv.get("posting_time"):
			if hasattr(inv["posting_time"], "total_seconds"):
				total_seconds = int(inv["posting_time"].total_seconds())
				hours = total_seconds // 3600
				minutes = (total_seconds % 3600) // 60
				seconds = total_seconds % 60
				inv["posting_time"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
			else:
				inv["posting_time"] = str(inv["posting_time"])

		# Set payment methods
		payment_methods = payment_methods_map.get(inv.name, [])
		inv["payment_methods"] = payment_methods

		# Set backward-compatible mode_of_payment field
		if len(payment_methods) == 0:
			inv["mode_of_payment"] = "-"
		elif len(payment_methods) == 1:
			inv["mode_of_payment"] = payment_methods[0]["mode_of_payment"]
		else:
			inv["mode_of_payment"] = "/".join([pm["mode_of_payment"] for pm in payment_methods])

		# Set items and calculate return data
		items = items_map.get(inv.name, [])

		# Only calculate return data for Credit Note Issued invoices
		if inv.get("status") == "Credit Note Issued":
			_calculate_return_quantities(inv, items)
		else:
			for item in items:
				item["returned_qty"] = 0
				item["available_qty"] = item["qty"]

		inv["items"] = items


def _calculate_return_quantities(invoice, items):
	"""Calculate return quantities for credit note invoices."""
	item_codes = [item["item_code"] for item in items]
	if not item_codes:
		return

	item_placeholders, item_params = _sql_in_clause(item_codes)
	returns_query = """
		SELECT sii.item_code, COALESCE(SUM(ABS(sii.qty)), 0) as total_returned_qty
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
		WHERE si.is_return = 1
		  AND si.return_against = %s
		  AND sii.item_code IN ({})
		  AND si.docstatus = 1
		  AND si.customer = %s
		GROUP BY sii.item_code
	""".format(item_placeholders)

	returns_data = frappe.db.sql(
		returns_query, (invoice.name, *item_params, invoice.customer), as_dict=True
	)
	returned_qty_map = {row.item_code: row.total_returned_qty for row in returns_data}

	# Update items with return data
	for item in items:
		returned_qty_value = returned_qty_map.get(item["item_code"], 0)
		item["returned_qty"] = round(float(returned_qty_value), 6)
		item["available_qty"] = round(item["qty"] - returned_qty_value, 6)


@frappe.whitelist(allow_guest=True)
def get_invoice_details(invoice_id):
	"""
	Main function to fetch complete invoice details.
	"""
	try:
		invoice = frappe.get_doc("Sales Invoice", invoice_id)
		invoice_data = invoice.as_dict()

		# Get items with return data
		items = _get_invoice_items_with_returns(invoice_id, invoice.customer)

		# Get address and customer information
		address_data = _get_address_and_customer_info(invoice)

		# Format posting time
		if invoice_data.get("posting_time"):
			if hasattr(invoice_data["posting_time"], "total_seconds"):
				total_seconds = int(invoice_data["posting_time"].total_seconds())
				hours = total_seconds // 3600
				minutes = (total_seconds % 3600) // 60
				seconds = total_seconds % 60
				invoice_data["posting_time"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
			else:
				invoice_data["posting_time"] = str(invoice_data["posting_time"])

		# Get cashier full name
		cashier_name = frappe.db.get_value(
			"User", invoice_data.get("owner"), "full_name"
		) or invoice_data.get("owner")
		invoice_data["cashier_name"] = cashier_name

		return {
			"success": True,
			"data": {
				**invoice_data,
				"items": items,
				"loyalty": get_invoice_loyalty_summary(invoice),
				**address_data,
			},
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error fetching invoice {invoice_id}")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def mark_invoice_as_printed(invoice_name):
	try:
		frappe.db.sql(
			"UPDATE `tabSales Invoice` SET custom_is_printed = 1 WHERE name = %s",
			(invoice_name,)
		)
		return {"success": True}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error marking invoice {invoice_name} as printed")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def validate_checkout_invoice(data):
	"""
	Pre-validate invoice payload at checkout time without creating any document.
	This catches batch/serial and item-account issues early before payment submission.
	"""
	try:
		(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_charge,
			delivery_personnel,
			is_credit_sale,
			allow_partial_payment,
			due_date,
			salesperson,
			tax_id,
			enable_background_submission,
			loyalty_redemption,
		) = parse_invoice_data(data)

		preview_doc = build_sales_invoice_doc(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_charge,
			include_payments=False,
			delivery_personnel=delivery_personnel,
			is_credit_sale=is_credit_sale,
			due_date=due_date,
			salesperson=salesperson,
			tax_id=tax_id,
			create_batch_and_serial_bundle=False,
			enable_background_submission=enable_background_submission,
			loyalty_redemption=loyalty_redemption,
		)

		validate_required_salesperson(preview_doc)

		_validate_reserved_stock_for_items(preview_doc)

		tax_breakdown = []
		for tax in preview_doc.get("taxes") or []:
			tax_breakdown.append(
				{
					"description": tax.description,
					"account_head": tax.account_head,
					"charge_type": tax.charge_type,
					"rate": flt(tax.rate or 0),
					"tax_amount": flt(tax.tax_amount or 0),
					"total": flt(tax.total or 0),
					"included_in_print_rate": int(tax.included_in_print_rate or 0),
				}
			)

		result = {
			"success": True,
			"message": "Checkout validation passed",
			"tax_preview": {
				"tax_breakdown": tax_breakdown,
				"net_total": flt(preview_doc.net_total or 0),
				"total_taxes_and_charges": flt(preview_doc.total_taxes_and_charges or 0),
				"grand_total": flt(preview_doc.grand_total or 0),
				"rounded_total": flt(preview_doc.rounded_total or 0),
				"disable_rounded_total": int(preview_doc.disable_rounded_total or 0),
			},
		}

		return result

	except Exception as e:
		return {"success": False, "message": str(e)}
	

def _get_invoice_items_with_returns(invoice_id, customer):
	"""
	Fetch invoice items and calculate returned/available quantities.
	"""
	# Batch fetch all items for this invoice
	items_query = """
		SELECT name, item_code, item_name, qty, rate, amount, description, uom,
			price_list_rate, discount_amount, discount_percentage
		FROM `tabSales Invoice Item`
		WHERE parent = %s
	"""
	items_data = frappe.db.sql(items_query, (invoice_id,), as_dict=True)

	# Batch fetch return quantities for all items at once
	item_codes = [item.item_code for item in items_data]
	returned_qty_map = {}

	if item_codes:
		item_placeholders, item_params = _sql_in_clause(item_codes)
		returns_query = """
			SELECT sii.item_code, COALESCE(SUM(ABS(sii.qty)), 0) as total_returned_qty
			FROM `tabSales Invoice` si
			JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
			WHERE si.is_return = 1
			  AND si.return_against = %s
			  AND sii.item_code IN ({})
			  AND si.docstatus = 1
			  AND si.customer = %s
			GROUP BY sii.item_code
		""".format(item_placeholders)

		returns_data = frappe.db.sql(
			returns_query, (invoice_id, *item_params, customer), as_dict=True
		)
		returned_qty_map = {row.item_code: row.total_returned_qty for row in returns_data}

	# Build items list with return data
	items = []
	for item in items_data:
		returned_qty_value = returned_qty_map.get(item.item_code, 0)
		available_qty = round(item.qty - returned_qty_value, 6)

		items.append(
			{
				"name": item.name,
				"item_code": item.item_code,
				"item_name": item.item_name,
				"qty": item.qty,
				"rate": item.rate,
				"price_list_rate": item.price_list_rate,
				"discount_amount": item.discount_amount,
				"discount_percentage": item.discount_percentage,
				"amount": item.amount,
				"description": item.description,
				"uom": item.uom,
				"returned_qty": returned_qty_value,
				"available_qty": available_qty,
			}
		)

	return items


def _get_address_and_customer_info(invoice):
	"""
	Fetch company address, customer address, and customer contact information.
	"""
	# Get company address
	company_address_doc = None
	if invoice.company_address:
		company_address_doc = frappe.get_doc("Address", invoice.company_address).as_dict()

	# Get customer address
	customer_address_doc = None
	if invoice.customer_address:
		customer_address_doc = frappe.get_doc("Address", invoice.customer_address).as_dict()
	else:
		primary_address = frappe.db.get_value(
			"Dynamic Link",
			{
				"link_doctype": "Customer",
				"link_name": invoice.customer,
				"parenttype": "Address",
			},
			"parent",
		)
		if primary_address:
			customer_address_doc = frappe.get_doc("Address", primary_address).as_dict()

	# Get customer contact information
	customer_email = ""
	customer_mobile_no = ""
	customer_address_line1 = ""
	customer_city = ""
	customer_state = ""
	customer_pincode = ""
	customer_country = ""
	customer_is_walkin = 0

	if invoice.customer:
		customer_doc = frappe.get_doc("Customer", invoice.customer)
		customer_email = customer_doc.email_id or ""
		customer_mobile_no = customer_doc.mobile_no or ""
		customer_is_walkin = customer_doc.custom_is_walkin

		# Extract address fields
		if customer_address_doc:
			customer_address_line1 = customer_address_doc.get("address_line1", "")
			customer_city = customer_address_doc.get("city", "")
			customer_state = customer_address_doc.get("state", "")
			customer_pincode = customer_address_doc.get("pincode", "")
			customer_country = customer_address_doc.get("country", "")

	return {
		"company_address_doc": company_address_doc,
		"customer_address_doc": customer_address_doc,
		"customer_email": customer_email,
		"customer_mobile_no": customer_mobile_no,
		"customer_address_line1": customer_address_line1,
		"customer_city": customer_city,
		"customer_state": customer_state,
		"customer_pincode": customer_pincode,
		"customer_country": customer_country,
		"customer_is_walkin": customer_is_walkin,
	}


@frappe.whitelist()
def create_and_submit_invoice(data):
	return queue_sales_invoice(data)


@frappe.whitelist()
def queue_sales_invoice(data):
	try:
		import time

		start_time = time.time()

		if not data:
			frappe.throw("No data provided for invoice creation")

		(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_charge,
			delivery_personnel,
			is_credit_sale,
			allow_partial_payment,
			due_date,
			salesperson,
			tax_id,
			enable_background_submission,
			loyalty_redemption,
		) = parse_invoice_data(data)

		if not customer:
			frappe.throw("Customer is required")
		if not items or len(items) == 0:
			frappe.throw("At least one item is required")

		doc = build_sales_invoice_doc(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_charge,
			include_payments=True,
			delivery_personnel=delivery_personnel,
			is_credit_sale=is_credit_sale,
			allow_partial_payment=allow_partial_payment,
			due_date=due_date,
			salesperson=salesperson,
			tax_id=tax_id,
			enable_background_submission=enable_background_submission,
			loyalty_redemption=loyalty_redemption,
		)

		validate_required_salesperson(doc)

		paid_credit = flt(amount_paid) + flt(getattr(doc, "loyalty_amount", 0))
		doc.base_paid_amount = paid_credit
		doc.paid_amount = paid_credit
		doc.outstanding_amount = max(flt(doc.grand_total) - paid_credit, 0)
		doc.reserve_stock = 1
		_apply_klik_invoice_flags(doc, is_held=False, is_submitted=False)

		_validate_reserved_stock_for_items(doc)

		if enable_background_submission:
			_mark_invoice_queued(doc, frappe.session.user)
			doc.save(ignore_permissions=True)

			try:
				_reserve_stock_for_queued_invoice(doc)
			except Exception as reserve_error:
				_update_queue_fields(doc, QUEUE_STATUSES["failed"], error_message=str(reserve_error))
				doc.save(ignore_permissions=True)
				return {"success": False, "message": str(reserve_error)}

			frappe.enqueue(
				"klik_pos.api.sales_invoice.process_queued_sales_invoice",
				queue="long",
				enqueue_after_commit=True,
				invoice_name=doc.name,
				requested_by=frappe.session.user,
			)

			doc.save(ignore_permissions=True)

			if tax_id:
				doc.db_set("tax_id", tax_id)

			processing_time = time.time() - start_time
			frappe.logger().info(f"Invoice {doc.name} queued in {processing_time:.2f} seconds")

			return {
				"success": True,
				"queue_status": doc.queue_status,
				"invoice_name": doc.name,
				"invoice_id": doc.name,
				"invoice": _get_invoice_response_summary(doc),
				"payment_entry": None,
				"processing_time": round(processing_time, 2),
			}
		else:
			doc.insert(ignore_permissions=True)

			if tax_id:
				doc.db_set("tax_id", tax_id)

			_apply_klik_invoice_flags(doc, is_submitted=True)
			doc.submit()
			doc.reload()

			try:
				_cancel_sales_invoice_reservations(doc.name)
			except Exception:
				frappe.log_error(
					frappe.get_traceback(),
					f"Failed to cancel reservations after submit for {doc.name}",
				)

			_finalize_submitted_invoice(
				doc,
				flt(doc.paid_amount or 0),
				_get_payment_methods_from_invoice(doc),
				getattr(doc, "business_type", None),
				doc.customer,
			)

			processing_time = time.time() - start_time
			frappe.logger().info(f"Invoice {doc.name} submitted directly in {processing_time:.2f} seconds")

			return {
				"success": True,
				"invoice_name": doc.name,
				"invoice_id": doc.name,
				"invoice": _get_invoice_response_summary(doc),
				"payment_entry": None,
				"processing_time": round(processing_time, 2),
			}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
		return {"success": False, "message": str(e)}
	

@frappe.whitelist()
def process_queued_sales_invoice(invoice_name, requested_by=None):
	"""Background worker that submits a queued draft sales invoice."""
	try:
		doc = frappe.get_doc("Sales Invoice", invoice_name)
		tax_id = doc.tax_id
		if doc.docstatus != 0:
			_apply_klik_invoice_flags(doc, is_submitted=True)
			_update_queue_fields(doc, QUEUE_STATUSES["submitted"], None)
			doc.save(ignore_permissions=True)
			return {"success": True, "message": "Invoice already submitted"}

		attempts = int(getattr(doc, "queue_attempts", 0) or 0) + 1
		_update_queue_fields(doc, QUEUE_STATUSES["processing"], attempts=attempts)
		doc.save(ignore_permissions=True)
		if tax_id:
			doc.tax_id = tax_id
		_apply_klik_invoice_flags(doc, is_submitted=True)
		doc.submit()
		doc.reload()
		try:
			_cancel_sales_invoice_reservations(doc.name)
		except Exception:
			frappe.log_error(
				frappe.get_traceback(),
				f"Failed to cancel reservations after submit for {doc.name}",
			)
		_update_queue_fields(doc, QUEUE_STATUSES["submitted"], attempts=attempts)
		if hasattr(doc, "queue_error"):
			doc.queue_error = ""
		doc.save(ignore_permissions=True)

		_finalize_submitted_invoice(
			doc,
			flt(doc.paid_amount or 0),
			_get_payment_methods_from_invoice(doc),
			getattr(doc, "business_type", None),
			doc.customer,
		)

		return {"success": True, "message": f"Invoice {invoice_name} submitted successfully"}

	except Exception as e:
		frappe.db.rollback()
		try:
			doc = frappe.get_doc("Sales Invoice", invoice_name)
			attempts = int(getattr(doc, "queue_attempts", 0) or 0) + 1
			_update_queue_fields(doc, QUEUE_STATUSES["failed"], error_message=str(e), attempts=attempts)
			doc.save(ignore_permissions=True)
			_notify_queue_failure(doc, requested_by, str(e))
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Queue failure update error for {invoice_name}")
		frappe.log_error(frappe.get_traceback(), f"Queued Invoice Submit Error for {invoice_name}")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def retry_failed_sales_invoice(invoice_name):
	"""Retry a failed queued invoice by enqueueing it again."""
	try:
		doc = frappe.get_doc("Sales Invoice", invoice_name)
		if doc.docstatus != 0:
			frappe.throw("Only draft invoices can be retried from the queue.")

		if (getattr(doc, "queue_status", "") or "").lower() not in ("failed", "processing", "queued"):
			frappe.throw("This invoice is not in a retryable queue state.")

		_validate_reserved_stock_for_items(doc, exclude_invoice=doc.name)
		_reserve_stock_for_queued_invoice(doc)

		_update_queue_fields(doc, QUEUE_STATUSES["queued"], error_message="")
		doc.save(ignore_permissions=True)

		frappe.enqueue(
			"klik_pos.api.sales_invoice.process_queued_sales_invoice",
			queue="long",
			enqueue_after_commit=True,
			invoice_name=doc.name,
			requested_by=frappe.session.user,
		)
		doc.save(ignore_permissions=True)

		return {"success": True, "queue_status": doc.queue_status}

	except Exception as e:
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def create_draft_invoice(data):
	try:
		if isinstance(data, str):
			data = json.loads(data)

		target_draft_invoice_id = data.get("draft_invoice_id") if isinstance(data, dict) else None
		(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_charge,
			delivery_personnel,
			is_credit_sale,
			allow_partial_payment,
			due_date,
			salesperson,
			tax_id,
			enable_background_submission,
			loyalty_redemption,
		) = parse_invoice_data(data)

		if target_draft_invoice_id:
			doc = frappe.get_doc("Sales Invoice", target_draft_invoice_id)
			if doc.docstatus != 0 or doc.status != "Draft":
				frappe.throw(
					_("Cannot update invoice {0}. Only Draft invoices can be held again.").format(
						target_draft_invoice_id
					)
				)

			_update_existing_draft_invoice(
				doc,
				customer,
				items,
				amount_paid,
				sales_and_tax_charges,
				mode_of_payment,
				business_type,
				roundoff_amount,
				delivery_charge,
				delivery_personnel=delivery_personnel,
				is_credit_sale=is_credit_sale,
				allow_partial_payment=allow_partial_payment,
				due_date=due_date,
				salesperson=salesperson,
				tax_id=tax_id,
				enable_background_submission=enable_background_submission,
				loyalty_redemption=loyalty_redemption,
			)
		else:
			doc = build_sales_invoice_doc(
				customer,
				items,
				amount_paid,
				sales_and_tax_charges,
				mode_of_payment,
				business_type,
				roundoff_amount,
				delivery_charge,
				include_payments=True,
				delivery_personnel=delivery_personnel,
				is_credit_sale=is_credit_sale,
				allow_partial_payment=allow_partial_payment,
				due_date=due_date,
				salesperson=salesperson,
				tax_id=tax_id,
				enable_background_submission=enable_background_submission,
				loyalty_redemption=loyalty_redemption,
			)

			validate_required_salesperson(doc)
			_apply_klik_invoice_flags(doc, is_held=True, is_submitted=False)
			doc.insert(ignore_permissions=True)

		if tax_id:
			doc.db_set("tax_id", tax_id)

		return {"success": True, "invoice_name": doc.name, "invoice": doc}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Draft Invoice Error")
		return {"success": False, "message": str(e)}
	

def parse_invoice_data(data):
	if isinstance(data, str):
		data = json.loads(data)

	def _normalize_bundle_entries(value):
		if not value:
			return []
		if isinstance(value, list):
			return value
		if isinstance(value, str):
			try:
				parsed = json.loads(value)
				return parsed if isinstance(parsed, list) else []
			except Exception:
				return []
		return []

	def _as_bool(value):
		if isinstance(value, str):
			return value.lower() in ("true", "1", "yes", "on")
		return bool(value)

	customer = data.get("customer", {}).get("id")
	items = []
	item_discounts = data.get("itemDiscounts", {})
	has_positive_priced_item = False
	raw_credit_sale_flag = data.get("isCreditSale")
	if raw_credit_sale_flag is None:
		raw_credit_sale_flag = data.get("is_credit_sale")
	is_credit_sale = _as_bool(raw_credit_sale_flag)
	allow_partial_payment = _as_bool(
		data.get("allowPartialPayment") or data.get("allow_partial_payment")
	)
	enable_background_submission = _as_bool(
		data.get("enable_background_invoice_submission") or 0
	)
	loyalty_redemption = normalize_loyalty_redemption(data)
	due_date = data.get("dueDate") or data.get("due_date")
	mode_of_payment = None
	default_payment_mode = None
	checkout_status = str(data.get("status") or "").strip().lower()
	has_payment_submission_context = any(
		key in data
		for key in (
			"paymentMethods",
			"amountPaid",
			"isCreditSale",
			"is_credit_sale",
			"dueDate",
			"due_date",
		)
	)

	if raw_credit_sale_flag is None and has_payment_submission_context:
		default_sales_type = (
			getattr(get_current_pos_profile(), "default_sales_type", None) or "Cash"
		).strip().lower()
		is_credit_sale = default_sales_type == "credit"

	allow_zero_rate_sales = cint(
		getattr(get_current_pos_profile(), "allow_zero_rate_sales", 0) or 0
	)

	for item in data.get("items", []):
		# Draft edit flows can send a unique cart-line id and the actual item code separately.
		item_code = item.get("item_code") or item.get("id")
		line_id = item.get("id")

		discount_data = item_discounts.get(item_code) or item_discounts.get(line_id) or {}
		if isinstance(discount_data, str):
			try:
				discount_data = json.loads(discount_data)
			except Exception:
				discount_data = {}
		if not isinstance(discount_data, dict):
			discount_data = {}

		bundle_entries = _normalize_bundle_entries(
			item.get("bundle_entries")
			or item.get("serial_batch_bundle")
			or discount_data.get("bundle_entries")
			or discount_data.get("serial_batch_bundle")
		)

		item_tax_rate = item.get("item_tax_rate") or {}
		if isinstance(item_tax_rate, str):
			try:
				item_tax_rate = json.loads(item_tax_rate)
			except Exception:
				item_tax_rate = {}

		discount_percentage = flt(item.get("discountPercentage") or discount_data.get("discountPercentage") or 0)
		discount_amount = flt(item.get("discountAmount") or discount_data.get("discountAmount") or 0)

		items.append({
			"id": item_code,
			"quantity": item.get("quantity"),
			"price": item.get("price"),
			"bundle_entries": bundle_entries,
			"uom": item.get("uom"),
			"item_tax_template": item.get("item_tax_template") or "",
			"item_tax_rate": item_tax_rate,
			"discountPercentage": discount_percentage,
			"discountAmount": discount_amount,
		})

		price = flt(item.get("price") or 0)
		quantity = flt(item.get("quantity") or 0)
		if price > 0 and quantity > 0:
			has_positive_priced_item = True

		if price < 0:
			frappe.throw(
				_("Rate cannot be negative for item {0}").format(
					item_code or _("Unknown Item")
				)
			)

		if (
			price == 0
			and discount_percentage <= 0
			and discount_amount <= 0
			and not allow_zero_rate_sales
		):
			frappe.throw(
				_("Rate must be greater than 0 for item {0} when no discount is set").format(
					item_code or _("Unknown Item")
				)
			)

	amount_paid = 0.0
	pos_profile = get_current_pos_profile()
	sales_and_tax_charges = pos_profile.taxes_and_charges
	business_type = data.get("businessType")

	# ERPNext owns invoice rounding through rounding_adjustment/rounded_total.
	# Ignore legacy Klik roundOffAmount payloads to avoid duplicate write-off entries.
	roundoff_amount = 0.0
	delivery_charge = flt(data.get("deliveryCharge") or data.get("delivery_charge") or 0.0)
	if delivery_charge < 0:
		frappe.throw(_("Delivery charge cannot be negative."))

	if delivery_charge > 0:
		allow_delivery_charge = cint(getattr(pos_profile, "custom_enable_delivery_charge", 0) or 0)
		if allow_delivery_charge != 1:
			frappe.throw(_("Delivery charge is not enabled for this POS Profile."))

		delivery_item_code = (getattr(pos_profile, "custom_delivery_charge_item", None) or "").strip()
		if not delivery_item_code:
			frappe.throw(
				_("Set Delivery Charge Item on POS Profile to use delivery charges.")
			)

		delivery_item = frappe.db.get_value(
			"Item",
			delivery_item_code,
			["name", "disabled", "is_sales_item", "is_stock_item"],
			as_dict=1,
		)
		if not delivery_item or cint(delivery_item.get("disabled") or 0) == 1:
			frappe.throw(
				_("Delivery Charge Item {0} is missing or disabled.").format(
					frappe.bold(delivery_item_code)
				)
			)

		if cint(delivery_item.get("is_sales_item") or 0) != 1:
			frappe.throw(
				_("Delivery Charge Item {0} must be allowed in sales.").format(
					frappe.bold(delivery_item_code)
				)
			)

		if cint(delivery_item.get("is_stock_item") or 0) == 1:
			frappe.throw(
				_("Delivery Charge Item {0} must be a non-stock service item.").format(
					frappe.bold(delivery_item_code)
				)
			)

	if data.get("amountPaid"):
		amount_paid = data.get("amountPaid")
	if flt(amount_paid or 0) < 0:
		frappe.throw(_("Payment amounts cannot be negative."))

	if data.get("paymentMethods"):
		mode_of_payment = data.get("paymentMethods")
		if isinstance(mode_of_payment, list):
			for payment in mode_of_payment:
				if not isinstance(payment, dict):
					continue
				if flt(payment.get("amount") or 0) < 0:
					frappe.throw(_("Payment amounts cannot be negative."))

	if is_credit_sale and has_payment_submission_context:
		if not due_date:
			frappe.throw(_("Please select a due date for this credit sale"))

		if customer and _is_walkin_customer(customer):
			frappe.throw(_("Credit sales require a non walk-in customer."))

		if _has_positive_payment_amount(mode_of_payment):
			frappe.throw(
				_("Credit sale cannot include payment amounts. Disable Credit Sale to collect payment.")
			)

		# Trust payment rows for credit-sale validation and always persist as unpaid.
		amount_paid = 0.0
		default_payment_mode = _get_default_payment_mode()
		mode_of_payment = _normalize_credit_sale_payment_methods(mode_of_payment, default_payment_mode)
	elif (
		has_payment_submission_context
		and checkout_status != "held"
		and has_positive_priced_item
		and not loyalty_redemption
	):
		if flt(amount_paid or 0) <= 0 or not _has_positive_payment_amount(mode_of_payment):
			frappe.throw(
				_("Cash sale requires at least one payment method with a positive amount.")
			)

	if data.get("SalesTaxCharges"):
		sales_and_tax_charges = data.get("SalesTaxCharges")

	delivery_personnel = data.get("deliveryPersonnel")
	salesperson = data.get("salesperson")
	tax_id = data.get("tax_id")

	if not customer or not items:
		frappe.throw(_("Customer and items are required"))

	return (
		customer,
		items,
		amount_paid,
		sales_and_tax_charges,
		mode_of_payment,
		business_type,
		roundoff_amount,
		delivery_charge,
		delivery_personnel,
		is_credit_sale,
		allow_partial_payment,
		due_date,
		salesperson,
		tax_id,
		enable_background_submission,
		loyalty_redemption,
	)


def build_sales_invoice_doc(
	customer,
	items,
	amount_paid,
	sales_and_tax_charges,
	mode_of_payment,
	business_type,
	roundoff_amount=0.0,
	delivery_charge=0.0,
	include_payments=False,
	delivery_personnel=None,
	is_credit_sale=False,
	allow_partial_payment=False,
	due_date=None,
	salesperson=None,
	tax_id=None,
	create_batch_and_serial_bundle=True,
	enable_background_submission=False,
	loyalty_redemption=None,
):
	"""Main function to build a sales invoice document."""
	doc = frappe.new_doc("Sales Invoice")
	_apply_klik_invoice_flags(doc, is_held=False, is_submitted=False)
	doc.customer = customer
	doc.due_date = due_date or frappe.utils.nowdate()
	doc.custom_delivery_date = frappe.utils.nowdate()
	doc.enable_background_invoice_submission = 1 if enable_background_submission else 0

	# Set delivery personnel if provided
	if delivery_personnel:
		doc.custom_delivery_personnel = delivery_personnel

	# Set tax ID if provided
	if tax_id:
		doc.tax_id = tax_id

	# Set salesperson in sales team
	if salesperson:
		doc.append("sales_team", {
			"sales_person": salesperson,
			"allocated_percentage": 100,
		})

	# Configure POS profile and company settings
	pos_profile = _get_active_pos_profile()
	_set_pos_profile_fields(doc, pos_profile, customer, business_type, amount_paid, allow_partial_payment)

	# Ensure batch/serial requirements are satisfied BEFORE building items
	_validate_no_variant_templates(items)
	_validate_and_autofetch_batch_and_serial(items, pos_profile)
	_validate_product_bundle_components(items, pos_profile)

	# Set posting details
	_set_posting_fields(doc)

	# Set POS opening entry
	_set_pos_opening_entry(doc)

	# Handle round-off
	_set_roundoff_fields(doc, roundoff_amount)

	# Set taxes and charges
	_set_taxes_and_charges(doc, sales_and_tax_charges, pos_profile)
	force_inclusive_tax = _is_pos_profile_tax_included_in_basic_rate(pos_profile)

	# Add items to invoice
	_populate_invoice_items(doc, items, pos_profile)

	# Populate tax details from template (if any)
	_populate_tax_details(doc, force_inclusive_tax=force_inclusive_tax)

	# Build per-item taxes from item_tax_rate fields
	_populate_per_item_taxes(doc, pos_profile, force_inclusive_tax=force_inclusive_tax)
	_upsert_delivery_charge_service_item(doc, pos_profile, delivery_charge)

	doc.set_taxes()
	doc.set_missing_values()
	doc.calculate_taxes_and_totals()
	apply_loyalty_redemption(doc, loyalty_redemption)
	if loyalty_redemption:
		doc.calculate_taxes_and_totals()

	if create_batch_and_serial_bundle:
		_create_batch_and_serial_bundle(items, doc)

	# Add payment information
	if include_payments:
		doc.is_pos = 1
		_add_payment_entries(doc, mode_of_payment)
		doc.calculate_taxes_and_totals()

	if is_credit_sale and due_date:
		doc.due_date = due_date

	return doc


def _update_existing_draft_invoice(
	invoice_doc,
	customer,
	items,
	amount_paid,
	sales_and_tax_charges,
	mode_of_payment,
	business_type,
	roundoff_amount,
	delivery_charge=0.0,
	delivery_personnel=None,
	is_credit_sale=False,
	allow_partial_payment=False,
	due_date=None,
	salesperson=None,
	tax_id=None,
	enable_background_submission=False,
	loyalty_redemption=None,
):
	rebuilt_doc = build_sales_invoice_doc(
		customer,
		items,
		amount_paid,
		sales_and_tax_charges,
		mode_of_payment,
		business_type,
		roundoff_amount,
		delivery_charge,
		include_payments=True,
		delivery_personnel=delivery_personnel,
		is_credit_sale=is_credit_sale,
		allow_partial_payment=allow_partial_payment,
		due_date=due_date,
		salesperson=salesperson,
		tax_id=tax_id,
		create_batch_and_serial_bundle=False,
		enable_background_submission=enable_background_submission,
		loyalty_redemption=loyalty_redemption,
	)

	invoice_doc.customer = rebuilt_doc.customer
	invoice_doc.due_date = rebuilt_doc.due_date
	invoice_doc.custom_delivery_date = rebuilt_doc.custom_delivery_date
	invoice_doc.enable_background_invoice_submission = rebuilt_doc.enable_background_invoice_submission
	invoice_doc.custom_delivery_personnel = rebuilt_doc.custom_delivery_personnel
	invoice_doc.tax_id = rebuilt_doc.tax_id
	invoice_doc.pos_profile = rebuilt_doc.pos_profile
	invoice_doc.company = rebuilt_doc.company
	invoice_doc.currency = rebuilt_doc.currency
	invoice_doc.selling_price_list = rebuilt_doc.selling_price_list
	invoice_doc.conversion_rate = rebuilt_doc.conversion_rate
	invoice_doc.update_stock = rebuilt_doc.update_stock
	invoice_doc.warehouse = rebuilt_doc.warehouse
	invoice_doc.cost_center = rebuilt_doc.cost_center
	invoice_doc.is_pos = rebuilt_doc.is_pos
	invoice_doc.redeem_loyalty_points = rebuilt_doc.redeem_loyalty_points
	invoice_doc.loyalty_points = rebuilt_doc.loyalty_points
	invoice_doc.loyalty_amount = rebuilt_doc.loyalty_amount
	invoice_doc.loyalty_program = rebuilt_doc.loyalty_program
	invoice_doc.loyalty_redemption_account = rebuilt_doc.loyalty_redemption_account
	invoice_doc.loyalty_redemption_cost_center = rebuilt_doc.loyalty_redemption_cost_center
	invoice_doc.taxes_and_charges = rebuilt_doc.taxes_and_charges
	invoice_doc.set("items", [])
	for item_row in rebuilt_doc.get("items", []):
		invoice_doc.append("items", item_row.as_dict())
	invoice_doc.set("taxes", [])
	for tax_row in rebuilt_doc.get("taxes", []):
		invoice_doc.append("taxes", tax_row.as_dict())
	invoice_doc.set("sales_team", [])
	for sales_person_row in rebuilt_doc.get("sales_team", []):
		invoice_doc.append("sales_team", sales_person_row.as_dict())

	if items:
		_create_batch_and_serial_bundle(items, invoice_doc)

	invoice_doc.set_taxes()
	invoice_doc.set_missing_values()
	invoice_doc.calculate_taxes_and_totals()

	# Payments must be applied after the first totals pass, then totals are recalculated
	# so ERPNext includes both payment rows and loyalty redemption in paid/outstanding amounts.
	invoice_doc.set("payments", [])
	_add_payment_entries(invoice_doc, mode_of_payment)
	invoice_doc.calculate_taxes_and_totals()

	validate_required_salesperson(invoice_doc)
	_apply_klik_invoice_flags(invoice_doc, is_held=True, is_submitted=False)
	invoice_doc.save(ignore_permissions=True)


def _select_invoice_row_for_bundle(doc, item_code, preferred_index, used_rows):
	if preferred_index < len(doc.items):
		candidate = doc.items[preferred_index]
		if candidate.item_code == item_code and candidate.name not in used_rows:
			return candidate

	for row in doc.items:
		if row.item_code == item_code and row.name not in used_rows:
			return row

	return None


def _normalize_bundle_qty_entries(row, entries, item_meta, item_code):
	cleaned_entries = []
	for entry in entries:
		if not isinstance(entry, dict):
			continue
		batch_no = entry.get("batch_no")
		serial_no = entry.get("serial_no")
		if not batch_no and not serial_no:
			continue
		cleaned_entries.append({"batch_no": batch_no, "serial_no": serial_no, "qty": flt(entry.get("qty") or 0)})

	if not cleaned_entries:
		return []

	target_qty = flt(abs(getattr(row, "stock_qty", 0) or 0))
	if target_qty <= 0:
		target_qty = flt(abs(getattr(row, "qty", 0) or 0))

	if target_qty <= 0:
		return cleaned_entries

	target_precision = row.precision("stock_qty") if hasattr(row, "precision") else 6

	if item_meta.has_serial_no:
		serial_entries = [entry for entry in cleaned_entries if entry.get("serial_no")]
		if serial_entries and flt(len(serial_entries), target_precision) != flt(target_qty, target_precision):
			frappe.throw(
				_(
					"Serial count for Item {0} is {1} but required quantity is {2}. Please reselect serial numbers."
				).format(item_code, len(serial_entries), target_qty)
			)
		for entry in cleaned_entries:
			entry["qty"] = 1 if entry.get("serial_no") else flt(abs(entry.get("qty") or 0))
		return cleaned_entries

	if len(cleaned_entries) == 1:
		cleaned_entries[0]["qty"] = target_qty
		return cleaned_entries

	current_total = flt(sum(abs(flt(entry.get("qty") or 0)) for entry in cleaned_entries))
	if flt(current_total, target_precision) != flt(target_qty, target_precision):
		frappe.throw(
			_(
				"Batch quantity for Item {0} is {1} but required quantity is {2}. Please reselect batch quantities."
			).format(item_code, current_total, target_qty)
		)

	for entry in cleaned_entries:
		entry["qty"] = flt(abs(entry.get("qty") or 0))

	return cleaned_entries

def _create_batch_and_serial_bundle(items, doc):
	used_rows = set()


	for idx, item_data in enumerate(items):
		item_code = item_data.get("item_code") or item_data.get("id")
		serial_batch_bundle = item_data.get("bundle_entries")

		if not item_code or not serial_batch_bundle:
			continue

		item_meta = frappe.db.get_value(
			"Item",
			item_code,
			["has_batch_no", "has_serial_no", "is_stock_item"],
			as_dict=1,
		)

		if not item_meta or int(item_meta.get("is_stock_item") or 0) == 0:
			continue

		if not (item_meta.has_batch_no or item_meta.has_serial_no):
			continue

		row = _select_invoice_row_for_bundle(doc, item_code, idx, used_rows)
		if not row:
			continue

		normalized_entries = _normalize_bundle_qty_entries(row, serial_batch_bundle, item_meta, item_code)
		if not normalized_entries:
			continue

		bundle = frappe.new_doc("Serial and Batch Bundle")
		bundle.item_code = item_code
		bundle.company = doc.company
		bundle.warehouse = row.warehouse
		bundle.has_batch_no = item_meta.has_batch_no
		bundle.has_serial_no = item_meta.has_serial_no
		bundle.type_of_transaction = "Outward"
		bundle.voucher_type = doc.doctype

		for entry in normalized_entries:
			bundle.append(
				"entries",
				{
					"batch_no": entry.get("batch_no"),
					"serial_no": entry.get("serial_no"),
					"qty": -abs(flt(entry.get("qty") or 0)),
				},
			)

		bundle.insert()
		row.serial_and_batch_bundle = bundle.name
		used_rows.add(row.name)


def _get_active_pos_profile():
	"""Get the active POS profile from current session or fallback to default."""
	selected_pos_profile_name = None

	try:
		current_opening_entry = get_current_pos_opening_entry()
		if current_opening_entry:
			opening_doc = frappe.get_doc("POS Opening Entry", current_opening_entry)
			selected_pos_profile_name = opening_doc.pos_profile
	except Exception:
		frappe.logger().error(f"Error getting POS Opening Entry: {frappe.get_traceback()}")
		pass

	try:
		if selected_pos_profile_name:
			pos_profile_doc = frappe.get_doc("POS Profile", selected_pos_profile_name)
			return pos_profile_doc
		else:
			fallback_profile = get_current_pos_profile()
			return fallback_profile
	except Exception:
		frappe.logger().error(f"Error getting POS Profile: {frappe.get_traceback()}")
		frappe.logger().error(f"Attempted to get profile: {selected_pos_profile_name}")
		raise


def _set_pos_profile_fields(doc, pos_profile, customer, business_type, amount_paid=0.0, allow_partial_payment=False):
	"""Set POS profile, company, currency and POS-specific fields."""
	doc.pos_profile = pos_profile.name
	doc.company = pos_profile.company
	doc.currency = get_customer_billing_currency(customer)
	price_list = get_price_list_with_customer_priority(customer) or getattr(pos_profile, "selling_price_list", None)
	if price_list:
		doc.selling_price_list = price_list
	doc.conversion_rate = 1.0
	doc.update_stock = 1
	doc.warehouse = pos_profile.warehouse
	doc.cost_center = pos_profile.cost_center

	# Determine if this is a POS invoice
	doc.is_pos = 1 if allow_partial_payment or flt(amount_paid or 0) > 0 else _determine_is_pos(customer, business_type)


def _validate_and_autofetch_batch_and_serial(items, pos_profile):
	"""
	Validate that all batch/serial requirements are satisfied for POS items.

	Behaviour:
	- If POS Profile.custom_autofetch_batchserial_ is truthy:
	  * For batch-tracked items missing batch, try to auto-assign a batch using FIFO.
	  * If no suitable batch is found, raise a clear error and STOP invoice creation.
	- If the flag is not set:
	  * For batch-tracked items missing batch, raise an error and STOP invoice creation.
	- For serial-tracked items we do NOT auto-assign; user must select serials explicitly.
	"""
	if not items:
		return

	item_codes = [item.get("id") for item in items if item.get("id")]
	if not item_codes:
		return

	item_data_map = _batch_fetch_item_data(item_codes)
	auto_fetch_enabled = int(getattr(pos_profile, "custom_autofetch_batchserial_", 0) or 0)

	for item in items:
		item_code = item.get("id")
		if not item_code:
			continue

		item_db_data = item_data_map.get(item_code, {}) or {}
		is_stock_item = int(item_db_data.get("is_stock_item") or 0)
		if not is_stock_item:
			continue

		has_batch_no = int(item_db_data.get("has_batch_no") or 0)
		has_serial_no = int(item_db_data.get("has_serial_no") or 0)
		bundle_entries = item.get("bundle_entries") or item.get("serial_batch_bundle") or []
		has_bundle_values = any(
			(entry.get("batch_no") or entry.get("serial_no"))
			for entry in bundle_entries
		)
		has_explicit_batch = bool(item.get("batchNumber") or item.get("batch_no"))
		has_explicit_serial = bool(item.get("serialNumber") or item.get("serial_no"))

		# Serial-tracked items must have either serial bundle entries or explicit serial data.
		if has_serial_no and not (has_bundle_values or has_explicit_serial):
			frappe.throw(
				_(
					"Serial No / Batch No are mandatory for Item {0}. Please select serial numbers before submitting the invoice."
				).format(item_code)
			)

		# Batch-tracked items must have either bundle entries, explicit batch, or be auto-fetched.
		if has_batch_no and not (has_bundle_values or has_explicit_batch):
			if auto_fetch_enabled:
				auto_batch = _autofetch_batch_fifo(item_code, pos_profile.warehouse, item.get("quantity"))
				if not auto_batch:
					frappe.throw(
						_(
							"Serial No / Batch No are mandatory for Item {0} and no suitable batch is available in warehouse {1}."
						).format(item_code, pos_profile.warehouse)
					)
				item["batchNumber"] = auto_batch
			else:
				frappe.throw(
					_(
						"Serial No / Batch No are mandatory for Item {0}. Please select a batch before submitting the invoice."
					).format(item_code)
				)


def _validate_no_variant_templates(items):
	if not items:
		return

	item_codes = [item.get("id") for item in items if item.get("id")]
	if not item_codes:
		return

	templates = frappe.get_all(
		"Item",
		filters={"name": ["in", item_codes], "has_variants": 1},
		pluck="name",
	)
	if templates:
		frappe.throw(
			_(
				"Item {0} is a variant template. Please select a specific variant before submitting the invoice."
			).format(", ".join(templates))
		)


def _validate_product_bundle_components(items, pos_profile):
	if not items:
		return

	bundle_item_codes = [item.get("id") for item in items if item.get("id")]
	if not bundle_item_codes:
		return

	placeholders = ", ".join(["%s"] * len(bundle_item_codes))
	bundle_rows = frappe.db.sql(
		f"""
		SELECT
			pb.new_item_code AS bundle_item_code,
			pbi.item_code,
			pbi.qty,
			i.item_name,
			i.is_stock_item,
			i.has_batch_no,
			i.has_serial_no
		FROM `tabProduct Bundle` pb
		INNER JOIN `tabProduct Bundle Item` pbi ON pbi.parent = pb.name
		INNER JOIN `tabItem` i ON i.name = pbi.item_code
		WHERE pb.disabled = 0
		AND pb.new_item_code IN ({placeholders})
		ORDER BY pb.new_item_code, pbi.idx
		""",
		tuple(bundle_item_codes),
		as_dict=True,
	)

	if not bundle_rows:
		return

	rows_by_bundle = {}
	for row in bundle_rows:
		rows_by_bundle.setdefault(row.bundle_item_code, []).append(row)

	for item in items:
		bundle_item_code = item.get("id")
		component_rows = rows_by_bundle.get(bundle_item_code)
		if not component_rows:
			continue

		parent_qty = flt(item.get("quantity") or 0)
		for component in component_rows:
			component_name = component.item_name or component.item_code
			if cint(component.has_batch_no) or cint(component.has_serial_no):
				frappe.throw(
					_(
						"Product Bundle {0} contains tracked component {1}. Klik POS does not yet support batch or serial selection for bundled components."
					).format(bundle_item_code, component_name)
				)

			if not cint(component.is_stock_item):
				continue

			required_qty = flt(component.qty or 0) * parent_qty
			available_qty = flt(
				frappe.db.get_value(
					"Bin",
					{"item_code": component.item_code, "warehouse": pos_profile.warehouse},
					"actual_qty",
				)
				or 0
			)
			if available_qty < required_qty:
				frappe.throw(
					_(
						"Insufficient stock for Product Bundle {0}. Component {1} requires {2}, but only {3} is available in warehouse {4}."
					).format(
						bundle_item_code,
						component_name,
						required_qty,
						available_qty,
						pos_profile.warehouse,
					)
				)

def _autofetch_batch_fifo(item_code, warehouse, qty):
	from erpnext.stock.doctype.batch.batch import get_batch_qty
	from frappe.utils import getdate, nowdate

	today = nowdate()
	required_qty = flt(qty or 0)

	# Walk batches in FIFO order and return the first usable batch.
	batches = frappe.get_all(
		"Batch",
		filters={
			"item": item_code,
			"disabled": 0,
		},
		fields=["name", "batch_id", "expiry_date", "creation"],
		order_by="expiry_date asc, creation asc",
	)

	for batch in batches:
		if batch.expiry_date and getdate(batch.expiry_date) < getdate(today):
			continue

		available_qty = flt(get_batch_qty(batch_no=batch.name, warehouse=warehouse) or 0)
		if available_qty >= required_qty:
			return batch.name

	item_name = frappe.db.get_value("Item", item_code, "item_name") or item_code
	frappe.throw(
		f"No batch with sufficient stock found for item {item_name} ({item_code}) "
		f"in warehouse {warehouse}. Required: {qty}"
	)

# def _autofetch_batch_fifo(item_code, warehouse, qty):
# 	"""
# 	Simple FIFO-based batch selector.

# 	Strategy:
# 	- Prefer non-expired batches for the given item.
# 	- Order by expiry_date ASC, then creation ASC (FIFO style).
# 	- Currently does NOT enforce per-warehouse stock; core ERPNext validations
# 	  will still ensure there is sufficient stock when the invoice is submitted.
# 	"""
# 	from frappe.utils import nowdate

# 	today = nowdate()

# 	# Filter by item and non-expired batches; ignore disabled batches
# 	batches = frappe.get_all(
# 		"Batch",
# 		filters={
# 			"item": item_code,
# 			"disabled": 0,
# 			"expiry_date": [">=", today],
# 		},
# 		fields=["name", "expiry_date", "creation"],
# 		order_by="expiry_date asc, creation asc",
# 		limit_page_length=1,
# 	)

# 	if not batches:
# 		# Fallback: try ANY active batch if no expiry_date / future-dated batches exist
# 		batches = frappe.get_all(
# 			"Batch",
# 			filters={
# 				"item": item_code,
# 				"disabled": 0,
# 			},
# 			fields=["name", "creation"],
# 			order_by="creation asc",
# 			limit_page_length=1,
# 		)

# 	return batches[0].name if batches else None

def _determine_is_pos(customer, business_type):
	"""Determine if the invoice should be marked as POS based on business type."""
	if business_type == "B2C":
		return 1
	elif business_type == "B2B":
		return 0
	elif business_type == "B2B & B2C":
		return _check_customer_type_for_pos(customer)
	else:
		return 0


def _check_customer_type_for_pos(customer):
	"""Check if customer is an individual for B2B & B2C business type."""
	global _cached_customer_data
	if customer not in _cached_customer_data:
		_cached_customer_data[customer] = frappe.get_doc("Customer", customer)

	customer_doc = _cached_customer_data[customer]
	return 1 if customer_doc.customer_type == "Individual" else 0


def _set_posting_fields(doc):
	"""Set posting date, time and related fields."""
	doc.posting_date = frappe.utils.nowdate()
	doc.posting_time = frappe.utils.nowtime()
	doc.set_posting_time = 1


def _set_pos_opening_entry(doc):
	"""Set the current POS opening entry on the document."""
	current_opening_entry = get_current_pos_opening_entry()
	if current_opening_entry:
		doc.custom_pos_opening_entry = current_opening_entry


def _set_roundoff_fields(doc, roundoff_amount):
	"""Legacy no-op: ERPNext handles invoice rounding natively."""
	return


def _set_taxes_and_charges(doc, sales_and_tax_charges, pos_profile):
	"""Set the taxes and charges template."""
	if sales_and_tax_charges:
		doc.taxes_and_charges = sales_and_tax_charges
	else:
		doc.taxes_and_charges = pos_profile.taxes_and_charges


def _upsert_delivery_charge_service_item(doc, pos_profile, delivery_charge):
	"""Create or update a configured delivery service item row using checkout delivery charge."""
	charge = flt(delivery_charge or 0)
	if charge <= 0:
		return

	enabled = cint(getattr(pos_profile, "custom_enable_delivery_charge", 0) or 0) == 1
	if not enabled:
		return

	delivery_item_code = (getattr(pos_profile, "custom_delivery_charge_item", None) or "").strip()
	if not delivery_item_code:
		frappe.throw(_("Set Delivery Charge Item on POS Profile to use delivery charges."))

	delivery_item = frappe.db.get_value(
		"Item",
		delivery_item_code,
		["name", "item_name", "disabled", "is_sales_item", "is_stock_item", "stock_uom"],
		as_dict=1,
	)
	if not delivery_item or cint(delivery_item.get("disabled") or 0) == 1:
		frappe.throw(
			_("Delivery Charge Item {0} is missing or disabled.").format(
				frappe.bold(delivery_item_code)
			)
		)

	if cint(delivery_item.get("is_sales_item") or 0) != 1:
		frappe.throw(
			_("Delivery Charge Item {0} must be allowed in sales.").format(
				frappe.bold(delivery_item_code)
			)
		)

	if cint(delivery_item.get("is_stock_item") or 0) == 1:
		frappe.throw(
			_("Delivery Charge Item {0} must be a non-stock service item.").format(
				frappe.bold(delivery_item_code)
			)
		)

	delivery_row = None
	for row in getattr(doc, "items", []) or []:
		if row.item_code == delivery_item_code:
			delivery_row = row
			break

	if delivery_row:
		delivery_row.qty = 1
		delivery_row.uom = delivery_row.uom or delivery_item.get("stock_uom") or "Nos"
		delivery_row.rate = charge
		delivery_row.price_list_rate = charge
		delivery_row.amount = charge
		delivery_row.base_rate = charge
		delivery_row.base_amount = charge
		return

	item_data_map = _batch_fetch_item_data([delivery_item_code])
	_precache_item_accounts([delivery_item_code], pos_profile.company)
	delivery_item_payload = {
		"id": delivery_item_code,
		"quantity": 1,
		"price": charge,
		"uom": delivery_item.get("stock_uom") or "Nos",
		"item_tax_template": "",
		"item_tax_rate": {},
		"discountPercentage": 0,
		"discountAmount": 0,
	}
	doc.append("items", _prepare_item_data(doc, delivery_item_payload, item_data_map, pos_profile))


def _is_pos_profile_tax_included_in_basic_rate(pos_profile):
	"""Return True when Klik POS should treat entered rates as tax-inclusive."""
	if not pos_profile:
		return False
	return cint(getattr(pos_profile, "is_tax_included_in_basic_rate", 0)) == 1


def _populate_invoice_items(doc, items, pos_profile):
	"""Add all items to the invoice."""
	item_codes = [item.get("id") for item in items]

	# Batch fetch item data and pre-cache accounts
	item_data_map = _batch_fetch_item_data(item_codes)
	_precache_item_accounts(item_codes, pos_profile.company)

	# Add each item to the invoice
	for item in items:
		item_data = _prepare_item_data(doc, item, item_data_map, pos_profile)
		doc.append("items", item_data)


def _batch_fetch_item_data(item_codes):
	"""Batch fetch item data for all items."""
	if not item_codes:
		return {}

	placeholders, params = _sql_in_clause(item_codes)
	item_query = """
		SELECT name, has_batch_no, has_serial_no, is_stock_item
		FROM `tabItem`
		WHERE name IN ({})
	""".format(placeholders)

	item_results = frappe.db.sql(item_query, params, as_dict=True)
	return {item.name: item for item in item_results}


def _precache_item_accounts(item_codes, company):
	"""Pre-cache income and expense accounts for all items."""
	if not item_codes:
		return

	# Cache company data
	if company not in _cached_company_data:
		_cached_company_data[company] = frappe.get_doc("Company", company)

	company_doc = _cached_company_data[company]
	income_account = company_doc.default_income_account
	expense_account = company_doc.default_expense_account

	# Pre-populate account cache
	for item_code in item_codes:
		_cached_item_accounts[item_code] = income_account
		_cached_item_accounts[f"{item_code}_expense"] = expense_account


def _resolve_item_tax_details_for_line(doc, item, pos_profile):
	"""Resolve item tax template/rate using ERPNext item detail context."""
	item_code = item.get("id")
	if not item_code:
		return "", {}

	item_tax_template = item.get("item_tax_template") or ""
	item_tax_rate = item.get("item_tax_rate") or {}

	if isinstance(item_tax_rate, str):
		try:
			item_tax_rate = json.loads(item_tax_rate)
		except Exception:
			item_tax_rate = {}

	price_list = doc.selling_price_list or pos_profile.selling_price_list
	currency = doc.currency or frappe.get_cached_value("Company", doc.company, "default_currency")
	price_list_currency = (
		frappe.get_cached_value("Price List", price_list, "currency") if price_list else None
	) or currency

	tax_category = None
	if doc.customer and doc.customer not in _cached_customer_data:
		_cached_customer_data[doc.customer] = frappe.get_doc("Customer", doc.customer)
	if doc.customer:
		customer_doc = _cached_customer_data.get(doc.customer)
		tax_category = customer_doc.tax_category if customer_doc else None

	ctx = {
		"item_code": item_code,
		"warehouse": pos_profile.warehouse,
		"customer": doc.customer,
		"company": doc.company,
		"currency": currency,
		"conversion_rate": flt(doc.conversion_rate or 1.0),
		"price_list": price_list,
		"selling_price_list": price_list,
		"price_list_currency": price_list_currency,
		"plc_conversion_rate": 1.0,
		"qty": flt(item.get("quantity") or 1),
		"uom": item.get("uom") or "Nos",
		"tax_category": tax_category,
		"is_pos": 1,
		"doctype": "Sales Invoice",
		"name": "",
		"transaction_date": doc.posting_date or nowdate(),
		"item_tax_template": item_tax_template,
	}

	if price_list_currency != currency:
		ctx["plc_conversion_rate"] = flt(
			frappe.get_cached_value(
				"Currency Exchange",
				{"from_currency": price_list_currency, "to_currency": currency},
				"exchange_rate",
			)
			or 1.0
		)

	try:
		resolved = get_item_details(ctx=ctx)
		item_tax_template = resolved.get("item_tax_template") or item_tax_template
		item_tax_rate = resolved.get("item_tax_rate") or item_tax_rate
		if isinstance(item_tax_rate, str):
			try:
				item_tax_rate = json.loads(item_tax_rate)
			except Exception:
				item_tax_rate = {}
	except Exception:
		pass

	return item_tax_template, item_tax_rate


def _prepare_item_data(doc, item, item_data_map, pos_profile):
	"""Prepare item data dictionary for invoice line."""
	item_code = item.get("id")

	# Get accounts and validate
	income_account = get_income_accounts(item_code)
	expense_account = get_expense_accounts(item_code)
	_validate_item_accounts(item_code, income_account, expense_account)

	# Build base item data
	item_data = {
		"item_code": item_code,
		"qty": item.get("quantity"),
		"rate": item.get("price"),
		"income_account": income_account,
		"expense_account": expense_account,
		"warehouse": pos_profile.warehouse,
		"cost_center": pos_profile.cost_center,
	}

	# Resolve per-item tax fields using ERPNext item selection logic.
	item_tax_template, item_tax_rate = _resolve_item_tax_details_for_line(doc, item, pos_profile)
	if item_tax_template:
		item_data["item_tax_template"] = item_tax_template
	if item_tax_rate:
		item_data["item_tax_rate"] = frappe.as_json(item_tax_rate)

	# Add optional fields
	_add_uom_to_item(item_data, item)
	_add_batch_to_item(item_data, item, item_data_map.get(item_code, {}))
	_add_serial_to_item(item_data, item)

	return item_data


def _validate_item_accounts(item_code, income_account, expense_account):
	"""Validate that required accounts exist for the item."""
	if not income_account:
		frappe.throw(
			f"Income account not found for item {item_code}. "
			"Please check item defaults or company settings."
		)
	if not expense_account:
		frappe.throw(
			f"Expense account not found for item {item_code}. "
			"Please check item defaults or company settings."
		)


def _add_uom_to_item(item_data, item):
	"""Add UOM to item data if specified and not default."""
	selected_uom = item.get("uom")
	if selected_uom and selected_uom != "Nos":
		item_data["uom"] = selected_uom


def _add_batch_to_item(item_data, item, item_db_data):
	"""Add batch information if item has batch tracking."""
	is_stock_item = int(item_db_data.get("is_stock_item") or 0)
	if not is_stock_item:
		return

	has_batch_no = item_db_data.get("has_batch_no", 0)
	batch_number = item.get("batchNumber")

	if has_batch_no and batch_number:
		item_data["use_serial_batch_fields"] = 1
		item_data["batch_no"] = batch_number


def _add_serial_to_item(item_data, item):
	"""Add serial number if provided."""
	serial_number = item.get("serialNumber")
	if serial_number:
		item_data["use_serial_batch_fields"] = 1
		item_data["serial_no"] = serial_number


def _populate_tax_details(doc, force_inclusive_tax=False):
	"""Populate tax details from the taxes and charges template."""
	if not doc.taxes_and_charges:
		return

	tax_doc = get_tax_template(doc.taxes_and_charges)
	if not tax_doc:
		return

	for tax in tax_doc.taxes:
		included_in_print_rate = bool(tax.included_in_print_rate)
		if force_inclusive_tax and tax.charge_type == "On Net Total":
			included_in_print_rate = True

		doc.append(
			"taxes",
			{
				"charge_type": tax.charge_type,
				"account_head": tax.account_head,
				"description": tax.description,
				"cost_center": tax.cost_center,
				"rate": tax.rate,
				"row_id": tax.row_id,
				"tax_amount": tax.tax_amount,
				"included_in_print_rate": included_in_print_rate,
			},
		)


def _populate_per_item_taxes(doc, pos_profile, force_inclusive_tax=False):
	"""Build tax rows from per-item tax rates on invoice items.
	
	When items have item_tax_template set (e.g., from Item Tax Template),
	ERPNext stores the tax rates in item_tax_rate but doesn't automatically
	create tax rows. This function aggregates those per-item taxes and creates
	proper tax rows.
	"""
	# Collect per-account tax rates from item_tax_rate maps.
	# Do not pre-compute tax_amount here; ERPNext handles inclusive/exclusive
	# math correctly during calculate_taxes_and_totals().
	tax_aggregates = {}  # {account_head: {"rate": 0, "description": ""}}

	for item in doc.items or []:
		if not item.item_tax_rate:
			continue

		item_tax_rate = item.item_tax_rate
		if isinstance(item_tax_rate, str):
			try:
				item_tax_rate = json.loads(item_tax_rate)
			except Exception:
				continue

		for account_head, tax_rate in (item_tax_rate or {}).items():
			tax_rate_pct = flt(tax_rate or 0)
			if tax_rate_pct <= 0:
				continue

			if account_head not in tax_aggregates:
				tax_aggregates[account_head] = {
					"rate": tax_rate_pct,
					"description": account_head,
				}

	if not tax_aggregates:
		return

	# Get included_in_print_rate settings from the active taxes template.
	included_map = {}
	template_name = doc.taxes_and_charges or pos_profile.taxes_and_charges
	if template_name:
		for row in frappe.get_all(
			"Sales Taxes and Charges",
			filters={
				"parent": template_name,
				"account_head": ["in", list(tax_aggregates.keys())],
			},
			fields=["account_head", "included_in_print_rate"],
		):
			included_map[row.account_head] = bool(row.included_in_print_rate)

	# Avoid duplicating account rows if template-level taxes already populated them.
	existing_accounts = {
		row.account_head
		for row in (doc.get("taxes") or [])
		if row.account_head
	}

	# Create missing tax rows for per-item taxes.
	for account_head, tax_data in tax_aggregates.items():
		if account_head in existing_accounts:
			continue

		included_in_print_rate = included_map.get(account_head, False)
		if force_inclusive_tax:
			included_in_print_rate = True

		doc.append(
			"taxes",
			{
				"charge_type": "On Net Total",
				"account_head": account_head,
				"description": tax_data["description"],
				"rate": tax_data["rate"],
				"included_in_print_rate": included_in_print_rate,
			},
		)

def _add_payment_entries(doc, mode_of_payment):
	"""Add payment entries to the invoice."""
	if not isinstance(mode_of_payment, list):
		return

	for payment in mode_of_payment:
		payment_row = {
			"mode_of_payment": payment.get("method"),
			"amount": payment.get("amount"),
		}

		if payment.get("reference_no"):
			payment_row["reference_no"] = payment.get("reference_no")
		if payment.get("phone_number"):
			payment_row["phone_number"] = payment.get("phone_number")
		if payment.get("type"):
			payment_row["type"] = payment.get("type")
		if payment.get("custom_reference_text"):
			payment_row["custom_reference_text"] = payment.get("custom_reference_text")

		doc.append("payments", payment_row)


def _get_default_payment_mode():
	"""Return the default payment mode for the active POS profile, or a safe fallback."""
	try:
		pos_profile = get_current_pos_profile()
		payment_methods = frappe.get_all(
			"POS Payment Method",
			filters={"parent": pos_profile.name},
			fields=["mode_of_payment", "default"],
			order_by="idx asc",
		)

		if not payment_methods:
			return None

		default_mode = next((row["mode_of_payment"] for row in payment_methods if row.get("default") in (1, True)), None)
		return default_mode or payment_methods[0].get("mode_of_payment")
	except Exception:
		return None


def _normalize_credit_sale_payment_methods(payment_methods, default_payment_mode):
	"""Ensure credit sales carry a zero-amount default payment row when no amount is entered."""
	if not isinstance(payment_methods, list):
		payment_methods = []

	if _has_positive_payment_amount(payment_methods):
		return payment_methods

	if payment_methods:
		for payment in payment_methods:
			if not payment.get("amount"):
				payment["amount"] = 0.0
		return payment_methods

	if default_payment_mode:
		return [{"method": default_payment_mode, "amount": 0.0}]

	return payment_methods


def _has_positive_payment_amount(payment_methods):
	"""Check whether any payment method has a positive amount."""
	if not isinstance(payment_methods, list):
		return False

	for payment in payment_methods:
		try:
			if flt(payment.get("amount") or 0) > 0:
				return True
		except Exception:
			continue
	return False


def _is_walkin_customer(customer):
	"""Return True when the selected customer is marked as walk-in."""
	if not customer:
		return False

	try:
		is_walkin = frappe.db.get_value("Customer", customer, "custom_is_walkin")
		return cint(is_walkin or 0) == 1
	except Exception:
		return False


def get_tax_template(template_name):
	"""
	Optimized tax template getter with caching.
	Custom helper function to fetch Sales Taxes and Charges Template.
	Returns the full template document or raises an error if not found.
	"""
	global _cached_item_accounts

	if not template_name:
		return None

	cache_key = f"tax_template_{template_name}"
	if cache_key not in _cached_item_accounts:
		try:
			template_doc = frappe.get_doc("Sales Taxes and Charges Template", template_name)
			_cached_item_accounts[cache_key] = template_doc
		except frappe.DoesNotExistError:
			frappe.throw(f"Tax Template '{template_name}' not found")
		except Exception as e:
			frappe.log_error(f"Error fetching tax template {template_name}: {e!s}")
			_cached_item_accounts[cache_key] = None

	return _cached_item_accounts[cache_key]


def get_customer_billing_currency(customer):
	try:
		customer_doc = frappe.get_doc("Customer", customer)
		if customer_doc.default_currency:
			return customer_doc.default_currency
	except Exception:
		pass

	# Fallback to company currency
	pos_profile = get_current_pos_profile()
	company_doc = frappe.get_doc("Company", pos_profile.company)
	return company_doc.default_currency


def get_income_accounts(item_code):
	"""Optimized income account getter with caching"""
	global _cached_item_accounts

	if item_code not in _cached_item_accounts:
		try:
			pos_profile = get_current_pos_profile()
			company = pos_profile.company

			# Cache company data
			if company not in _cached_company_data:
				_cached_company_data[company] = frappe.get_doc("Company", company)

			company_doc = _cached_company_data[company]
			_cached_item_accounts[item_code] = company_doc.default_income_account
		except Exception as e:
			frappe.log_error(
				f"Error fetching income account for {item_code}: {e!s}",
				"Income Account Error",
			)
			_cached_item_accounts[item_code] = None

	return _cached_item_accounts[item_code]


def get_expense_accounts(item_code):
	"""Optimized expense account getter with caching"""
	global _cached_item_accounts

	cache_key = f"{item_code}_expense"
	if cache_key not in _cached_item_accounts:
		try:
			pos_profile = get_current_pos_profile()
			company = pos_profile.company

			# Cache company data
			if company not in _cached_company_data:
				_cached_company_data[company] = frappe.get_doc("Company", company)

			company_doc = _cached_company_data[company]
			_cached_item_accounts[cache_key] = company_doc.default_expense_account
		except Exception as e:
			frappe.log_error(
				f"Error fetching expense account for {item_code}: {e!s}",
				"Expense Account Error",
			)
			_cached_item_accounts[cache_key] = None

	return _cached_item_accounts[cache_key]


from frappe.model.mapper import get_mapped_doc


@frappe.whitelist()
def return_sales_invoice(invoice_name):
	try:
		_ensure_return_allowed()

		original_invoice = frappe.get_doc("Sales Invoice", invoice_name)

		if original_invoice.docstatus != 1:
			frappe.throw("Only submitted invoices can be returned.")

		if original_invoice.is_return:
			frappe.throw("This invoice is already a return.")

		# Exclude payment mapping
		return_doc = get_mapped_doc(
			"Sales Invoice",
			invoice_name,
			{
				"Sales Invoice": {
					"doctype": "Sales Invoice",
					"field_map": {"name": "return_against"},
					"validation": {"docstatus": ["=", 1]},
				},
				"Sales Invoice Item": {
					"doctype": "Sales Invoice Item",
					"field_map": {"name": "prevdoc_detail_docname"},
				},
			},
		)

		return_doc.is_return = 1
		return_doc.posting_date = frappe.utils.nowdate()
		_apply_klik_invoice_flags(return_doc, is_held=False, is_submitted=True)

		for item in return_doc.items:
			item.qty = -abs(item.qty)

		return_doc.payments = []
		for p in original_invoice.payments:
			return_doc.append(
				"payments",
				{
					"mode_of_payment": p.mode_of_payment,
					"amount": -abs(p.amount),
					"account": p.account,
				},
			)

		return_doc.save(ignore_permissions=True)
		return_doc.submit()

		return {"success": True, "return_invoice": return_doc.name}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Return Invoice Error")
		return {"success": False, "message": str(e)}


class CustomSalesInvoice(SalesInvoice):
	def validate_pos_opening_entry(self):
		opening_entries = frappe.get_all(
			"POS Opening Entry",
			fields=["name", "period_start_date"],
			filters={"pos_profile": self.pos_profile, "status": "Open"},
			order_by="period_start_date desc",
		)
		if not opening_entries:
			frappe.throw(
				title=_("POS Opening Entry Missing"),
				msg=_("No open POS Opening Entry found for POS Profile {0}.").format(
					frappe.bold(self.pos_profile)
				),
			)

	def before_submit(self):
		if _should_reserve_stock(self):
			_update_queue_fields(self, QUEUE_STATUSES["submitted"], error_message=None)
			_cancel_sales_invoice_reservations(self.name)
		self.validate_reserved_stock_availability()
		self.validate_full_payment()

	def validate_reserved_stock_availability(self):
		if not _should_reserve_stock(self):
			return
		if not self.update_stock or getattr(self, "is_return", 0):
			return

		item_codes = list({row.item_code for row in self.items if row.item_code})
		item_stock_flag_map = {}
		if item_codes:
			item_stock_flag_map = {
				row.name: int(row.is_stock_item or 0)
				for row in frappe.get_all(
					"Item",
					filters={"name": ["in", item_codes]},
					fields=["name", "is_stock_item"],
				)
			}

		own_reserved_map = _get_sales_invoice_reservation_map(self.name)

		for row in self.items:
			if not row.item_code or not row.warehouse:
				continue
			if item_stock_flag_map.get(row.item_code, 1) == 0:
				continue

			required_qty = flt(abs(getattr(row, "stock_qty", 0) or 0))
			if required_qty <= 0:
				required_qty = flt(abs(getattr(row, "qty", 0) or 0))
			if required_qty <= 0:
				continue

			actual_qty = flt(
				frappe.db.get_value(
					"Bin",
					{"item_code": row.item_code, "warehouse": row.warehouse},
					"actual_qty",
				)
				or 0
			)
			reserved_map = get_reserved_stock_map(item_codes=[row.item_code], warehouse=row.warehouse)
			reserved_qty = flt(reserved_map.get((row.item_code, row.warehouse), 0))
			available_qty = flt(actual_qty - reserved_qty + flt(own_reserved_map.get((row.item_code, row.warehouse), 0)))

			if required_qty > available_qty + 1e-9:
				frappe.throw(
					_(
						"Reserved stock protection: item {0} in warehouse {1} has only {2} available after reservations, but {3} is required."
					).format(
						frappe.bold(row.item_code),
						frappe.bold(row.warehouse),
						flt(available_qty),
						flt(required_qty),
					)
				)

	def validate_full_payment(self):
		if not self.pos_profile or getattr(self, "is_return", 0):
			return

		allow_partial_payment = frappe.db.get_value(
			"POS Profile", self.pos_profile, "allow_partial_payment"
		)
		allow_partial_payment = allow_partial_payment or getattr(self, "custom_allow_partial_payment", 0)
		precision = self.precision("rounded_total")
		if precision is None:
			precision = self.precision("grand_total")
		invoice_total = flt(self.rounded_total, precision) or flt(self.grand_total, precision)
		paid_amount = flt(self.paid_amount, precision)
		if paid_amount < invoice_total and flt(getattr(self, "loyalty_amount", 0)):
			paid_amount = flt(paid_amount + flt(self.loyalty_amount, precision), precision)

		if not allow_partial_payment and paid_amount < invoice_total:
			frappe.throw(
				msg=_("Partial Payment in POS Transactions are not allowed."),
				exc=PartialPaymentValidationError,
			)

	def get_gl_entries(self, warehouse_account=None):
		from erpnext.accounts.general_ledger import merge_similar_entries

		gl_entries = []

		self.make_customer_gl_entry(gl_entries)

		self.make_tax_gl_entries(gl_entries)
		self.make_internal_transfer_gl_entries(gl_entries)

		self.make_item_gl_entries(gl_entries)
		self.make_precision_loss_gl_entry(gl_entries)
		self.make_discount_gl_entries(gl_entries)

		gl_entries = make_regional_gl_entries(gl_entries, self)

		# merge gl entries before adding pos entries
		gl_entries = merge_similar_entries(gl_entries)

		self.make_loyalty_point_redemption_gle(gl_entries)
		self.make_pos_gl_entries(gl_entries)

		self.make_write_off_gl_entry(gl_entries)
		self.make_gle_for_rounding_adjustment(gl_entries)

		return gl_entries

@erpnext.allow_regional
def make_regional_gl_entries(gl_entries, doc):
	return gl_entries


def create_payment_entry(sales_invoice, mode_of_payment, amount_paid):
	"""
	Create Payment Entry for B2B Sales Invoice
	"""
	try:
		# Get company and customer details
		company = sales_invoice.company
		customer = sales_invoice.customer

		# Create Payment Entry
		payment_entry = frappe.new_doc("Payment Entry")
		payment_entry.payment_type = "Receive"
		payment_entry.party_type = "Customer"
		payment_entry.party = customer
		payment_entry.company = company
		payment_entry.posting_date = frappe.utils.nowdate()

		# Set paid amount
		payment_entry.paid_amount = amount_paid
		payment_entry.received_amount = amount_paid
		payment_entry.source_exchange_rate = 1
		payment_entry.target_exchange_rate = 1

		company_doc = frappe.get_doc("Company", company)

		payment_entry.party_account = get_customer_receivable_account(customer, company)

		# Handle multiple payment methods
		if isinstance(mode_of_payment, list) and len(mode_of_payment) > 0:
			first_payment = mode_of_payment[0]
			mode_of_payment_doc = frappe.get_doc("Mode of Payment", first_payment["method"])

			for account in mode_of_payment_doc.accounts:
				if account.company == company:
					payment_entry.paid_to = account.default_account
					break

			if not payment_entry.paid_to:
				payment_entry.paid_to = company_doc.default_cash_account

			payment_entry.mode_of_payment = first_payment["method"]

			payment_entry.append(
				"references",
				{
					"reference_doctype": "Sales Invoice",
					"reference_name": sales_invoice.name,
					"allocated_amount": amount_paid,
				},
			)

		else:
			payment_entry.paid_to = company_doc.default_cash_account
			payment_entry.mode_of_payment = "Cash"

			payment_entry.append(
				"references",
				{
					"reference_doctype": "Sales Invoice",
					"reference_name": sales_invoice.name,
					"allocated_amount": amount_paid,
				},
			)

		payment_entry.paid_from_account_currency = sales_invoice.currency
		payment_entry.paid_to_account_currency = sales_invoice.currency

		payment_entry.save()
		payment_entry.submit()

		return payment_entry

	except Exception as e:
		frappe.log_error(
			frappe.get_traceback(),
			f"Error creating payment entry for invoice {sales_invoice.name}",
		)
		frappe.throw(f"Failed to create payment entry: {e!s}")


def get_customer_receivable_account(customer, company):
	"""Get customer's receivable account using ERPNext utility"""
	try:
		from erpnext.accounts.party import get_party_account

		return get_party_account("Customer", customer, company)
	except Exception as e:
		frappe.log_error(f"Error getting receivable account for customer {customer}: {e!s}")
		return frappe.db.get_value("Company", company, "default_receivable_account")


@frappe.whitelist()
def returned_qty(customer, sales_invoice, item):
	"""
	Get total returned quantity for a specific item (item_code) against a given sales invoice.
	- sales_invoice should be the original invoice name.
	- item should be the item_code (not item name or child row name).
	Returns: {'total_returned_qty': <float>}
	"""
	values = {
		"customer": customer,
		"sales_invoice": sales_invoice,
		"item": item,
	}

	# Sum qty from Sales Invoice Items of return invoices that point to the original invoice
	result = frappe.db.sql(
		"""
		SELECT COALESCE(SUM(sii.qty), 0) AS total_returned_qty
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
		WHERE si.is_return = 1
		  AND si.return_against = %(sales_invoice)s
		  AND sii.item_code = %(item)s
		  AND si.docstatus = 1
		  AND si.customer = %(customer)s
		""",
		values=values,
		as_dict=True,
	)

	total = abs(result[0]["total_returned_qty"]) if result else 0.0
	return {
		"total_returned_qty": round(float(total), 6)
	}  # Round to 6 decimal places to avoid precision issues


@frappe.whitelist()
def get_valid_sales_invoices(doctype, txt, searchfield, start, page_len, filters=None):
	"""Get valid sales invoices based on filters for multi-invoice returns"""
	_ensure_return_allowed()

	filters = filters or {}

	customer = filters.get("customer")
	shipping_address = filters.get("shipping_address")
	item_code = filters.get("item_code")
	start_date = filters.get("start_date")

	if not customer or not item_code or not start_date:
		return []

	# Build dynamic conditions
	conditions = [
		"si.docstatus = 1",
		"si.is_return = 0",
		"si.custom_pos_opening_entry IS NOT NULL AND si.custom_pos_opening_entry != ''",
	]
	query_params = {
		"txt": f"%{txt}%",
		"start": start,
		"page_len": page_len,
	}

	if customer:
		conditions.append("si.customer = %(customer)s")
		query_params["customer"] = customer

	if shipping_address:
		conditions.append("si.shipping_address_name = %(shipping_address)s")
		query_params["shipping_address"] = shipping_address

	if item_code:
		conditions.append("sii.item_code = %(item_code)s")
		query_params["item_code"] = item_code

	if start_date:
		conditions.append("si.posting_date >= %(start_date)s")
		query_params["start_date"] = start_date

	conditions.append(
		"""
		(sii.qty + COALESCE((
			SELECT SUM(cd.qtr)
			FROM `tabCredit Details` cd
			JOIN `tabSales Invoice` rsi ON cd.parent = rsi.name
			WHERE cd.sales_invoice = si.name
			AND cd.item = sii.item_code
			AND rsi.customer = si.customer
			AND rsi.docstatus = 1
			AND rsi.status != 'Cancelled'
		), 0)) > 0
	"""
	)

	where_clause = " AND ".join(conditions)
	query = f"""
		SELECT DISTINCT si.name,si.posting_date,sii.qty
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
		WHERE {where_clause}
		AND si.name LIKE %(txt)s
		LIMIT %(start)s, %(page_len)s
	"""

	return frappe.db.sql(query, query_params)


@frappe.whitelist()
def get_customer_invoices_for_return(customer, start_date=None, end_date=None, shipping_address=None):
	"""Get all invoices for a customer within date range that can be returned"""
	try:
		_ensure_return_allowed()

		filters = {
			"customer": customer,
			"docstatus": 1,
			"is_return": 0,
			"status": ["!=", "Cancelled"],
			"custom_pos_opening_entry": ["!=", ""],
		}

		if start_date:
			filters["posting_date"] = [">=", start_date]
		if end_date:
			if "posting_date" in filters:
				filters["posting_date"] = ["between", [start_date, end_date]]
			else:
				filters["posting_date"] = ["<=", end_date]

		# Add shipping address filter if provided
		if shipping_address:
			filters["customer_address"] = shipping_address

		invoices = frappe.get_all(
			"Sales Invoice",
			filters=filters,
			fields=[
				"name",
				"posting_date",
				"posting_time",
				"customer",
				"grand_total",
				"paid_amount",
				"status",
			],
			order_by="posting_date desc",
		)

		# Batch fetch all items for all invoices
		invoice_names = [inv.name for inv in invoices]
		all_items = []
		if invoice_names:
			all_items = frappe.get_all(
				"Sales Invoice Item",
				filters={"parent": ["in", invoice_names]},
				fields=["parent", "item_code", "item_name", "qty", "rate", "amount"],
				order_by="parent, idx",
			)

		# Batch fetch all returned quantities for all items at once
		returned_qty_map = {}
		if all_items:
			item_codes = list(set([item.item_code for item in all_items]))
			_invoice_item_pairs = [(item.parent, item.item_code) for item in all_items]

			if item_codes:
				invoice_placeholders, invoice_params = _sql_in_clause(invoice_names)
				item_placeholders, item_params = _sql_in_clause(item_codes)
				# Create a more efficient query to get all returned quantities
				returns_query = """
					SELECT
						rsi.return_against as original_invoice,
						sii.item_code,
						COALESCE(SUM(ABS(sii.qty)), 0) as total_returned_qty
					FROM `tabSales Invoice` rsi
					JOIN `tabSales Invoice Item` sii ON rsi.name = sii.parent
					WHERE rsi.is_return = 1
					  AND rsi.return_against IN ({})
					  AND sii.item_code IN ({})
					  AND rsi.docstatus = 1
					  AND rsi.customer = %s
					GROUP BY rsi.return_against, sii.item_code
				""".format(
					invoice_placeholders,
					item_placeholders,
				)

				returns_data = frappe.db.sql(
					returns_query, (*invoice_params, *item_params, customer), as_dict=True
				)
				returned_qty_map = {
					(row.original_invoice, row.item_code): row.total_returned_qty for row in returns_data
				}

		# Group items by invoice and calculate returned quantities
		invoice_items_map = {}
		for item in all_items:
			if item.parent not in invoice_items_map:
				invoice_items_map[item.parent] = []

			returned_qty_value = returned_qty_map.get((item.parent, item.item_code), 0)
			item.returned_qty = returned_qty_value
			item.available_qty = round(
				item.qty - returned_qty_value, 6
			)  # Round to 6 decimal places to avoid precision issues

			invoice_items_map[item.parent].append(item)

		# Assign items to invoices
		for invoice in invoices:
			invoice.items = invoice_items_map.get(invoice.name, [])

			# Get all payment methods from payment child table
			invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)
			payment_methods = []
			if invoice_doc.payments:
				for payment in invoice_doc.payments:
					payment_methods.append(
						{"mode_of_payment": payment.mode_of_payment, "amount": payment.amount}
					)
			elif invoice_doc.status == "Draft":
				payment_methods = []
			else:
				# Check Payment Entry if invoice payments table is empty but invoice is paid
				if invoice_doc.status in ["Paid", "Partly Paid"] and not invoice_doc.payments:
					payment_entries = frappe.get_all(
						"Payment Entry Reference",
						filters={"reference_name": invoice_doc.name, "reference_doctype": "Sales Invoice"},
						fields=["parent", "allocated_amount"],
						parent_doctype="Payment Entry",
					)

					for pe_ref in payment_entries:
						payment_entry = frappe.get_doc("Payment Entry", pe_ref.parent)
						if payment_entry.docstatus == 1:
							payment_methods.append(
								{
									"mode_of_payment": payment_entry.mode_of_payment,
									"amount": pe_ref.allocated_amount,
								}
							)

			invoice.payment_methods = payment_methods
			# Keep backward compatibility - show first payment method or combined display
			if len(payment_methods) == 0:
				invoice.payment_method = "-"
			elif len(payment_methods) == 1:
				invoice.payment_method = payment_methods[0]["mode_of_payment"]
			else:
				# Show combined payment methods like "Cash/Credit Card"
				invoice.payment_method = "/".join([pm["mode_of_payment"] for pm in payment_methods])

		return {"success": True, "data": invoices}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching customer invoices for return")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def create_partial_return(
	invoice_name, return_items, payment_method=None, return_amount=None, expected_return_amount=None
):
	"""Create a partial return for selected items from an invoice with custom payment method"""

	try:
		_ensure_return_allowed()

		if isinstance(return_items, str):
			return_items = json.loads(return_items)

		original_invoice = frappe.get_doc("Sales Invoice", invoice_name)

		if original_invoice.docstatus != 1:
			frappe.throw("Only submitted invoices can be returned.")

		if original_invoice.is_return:
			frappe.throw("This invoice is already a return.")

		# Create return invoice using the same approach as return_sales_invoice
		return_doc = get_mapped_doc(
			"Sales Invoice",
			invoice_name,
			{
				"Sales Invoice": {
					"doctype": "Sales Invoice",
					"field_map": {"name": "return_against"},
					"validation": {"docstatus": ["=", 1]},
				},
				"Sales Invoice Item": {
					"doctype": "Sales Invoice Item",
					"field_map": {"name": "prevdoc_detail_docname"},
				},
			},
		)

		return_doc.is_return = 1
		return_doc.posting_date = frappe.utils.nowdate()
		return_doc.custom_delivery_date = frappe.utils.nowdate()
		_apply_klik_invoice_flags(return_doc, is_held=False, is_submitted=True)

		# Set the current POS opening entry
		current_opening_entry = get_current_pos_opening_entry()
		if current_opening_entry:
			return_doc.custom_pos_opening_entry = current_opening_entry

		# Filter items to only include selected ones with return quantities
		filtered_items = []
		for return_item in return_items:
			if return_item.get("return_qty", 0) > 0:
				for item in return_doc.items:
					if item.item_code == return_item["item_code"]:
						item.qty = -abs(return_item["return_qty"])
						filtered_items.append(item)
						break

		return_doc.items = filtered_items

		# Clear existing payments
		return_doc.payments = []

		# Calculate total returned amount (baseline expected refund)
		# Prefer client-provided expected amount; fallback to backend computation
		if expected_return_amount is not None:
			try:
				total_returned_amount = flt(expected_return_amount, return_doc.precision("grand_total") or 2)
			except Exception:
				total_returned_amount = sum(abs(item.qty * item.rate) for item in return_doc.items)
		else:
			total_returned_amount = sum(abs(item.qty * item.rate) for item in return_doc.items)

		final_return_amount = return_amount if return_amount is not None else total_returned_amount

		final_payment_method = payment_method if payment_method else "Cash"

		# Optionally persist the auto-calculated expected refund if a custom field exists
		try:
			_si_meta = frappe.get_meta("Sales Invoice")
			if any(df.fieldname == "custom_expected_refund_amount" for df in _si_meta.fields):
				return_doc.custom_expected_refund_amount = flt(
					total_returned_amount, return_doc.precision("grand_total") or 2
				)
		except Exception:
			pass

		if final_return_amount > 0:
			return_doc.append(
				"payments",
				{
					"mode_of_payment": final_payment_method,
					"amount": -abs(final_return_amount),
				},
			)
		print("Mko 3", -abs(final_return_amount))
		# Recalculate totals (payment amount stays as user entered)
		try:
			return_doc.calculate_taxes_and_totals()
		except Exception:
			pass

		return_doc.save(ignore_permissions=True)
		return_doc.submit()

		return {
			"success": True,
			"return_invoice": return_doc.name,
			"message": f"Return created successfully: {return_doc.name} (Payment: {final_payment_method})",
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Partial Return Error")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def create_multi_invoice_return(return_data):
	"""Create multiple return invoices for items from different invoices"""
	try:
		_ensure_return_allowed()

		if isinstance(return_data, str):
			return_data = json.loads(return_data)

		invoice_returns = return_data.get("invoice_returns", [])

		created_returns = []

		for _i, invoice_return in enumerate(invoice_returns):
			invoice_name = invoice_return.get("invoice_name")
			return_items = invoice_return.get("return_items", [])
			payment_method = invoice_return.get("payment_method")
			return_amount = invoice_return.get("return_amount")

			if return_items:
				# Call create_partial_return with payment method and return amount
				result = create_partial_return(
					invoice_name, return_items, payment_method=payment_method, return_amount=return_amount
				)
				if result.get("success"):
					created_returns.append(result.get("return_invoice"))
				else:
					frappe.log_error(f"Failed to create return for {invoice_name}: {result.get('message')}")

		return {
			"success": True,
			"created_returns": created_returns,
			"message": f"Created {len(created_returns)} return invoices successfully",
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Multi Invoice Return Error")
		return {"success": False, "message": str(e)}


def delete_draft_invoices_for_opening_entry(opening_entry_name):
	"""
	Delete all draft Sales Invoices linked to the given POS Opening Entry (session).
	Called on POS close when POS Profile has custom_clear_draft_invoices enabled.
	"""
	try:
		drafts = frappe.get_all(
			"Sales Invoice",
			filters={
				"docstatus": 0,
				"custom_pos_opening_entry": opening_entry_name,
			},
			pluck="name",
		)
		deleted = 0
		for name in drafts:
			try:
				doc = frappe.get_doc("Sales Invoice", name)
				if doc.docstatus == 0:
					_cancel_sales_invoice_reservations(doc.name)
					doc.delete()
					deleted += 1
			except Exception as e:
				frappe.logger().error(f"Error deleting draft invoice {name}: {e}")
		if deleted:
			frappe.logger().info(f"Cleared {deleted} draft invoice(s) for opening entry {opening_entry_name}")
		return deleted
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Clear draft invoices on POS close")
		# Do not raise - closing entry already succeeded
		return 0


@frappe.whitelist()
def delete_draft_invoice(invoice_id):
	"""
	Delete a draft sales invoice.
	Only allows deletion of Draft status invoices.
	"""
	try:
		# Get the invoice document
		invoice_doc = frappe.get_doc("Sales Invoice", invoice_id)

		if invoice_doc.status != "Draft":
			return {
				"success": False,
				"error": f"Cannot delete invoice {invoice_id}. Only Draft invoices can be deleted. Current status: {invoice_doc.status}",
			}

		_cancel_sales_invoice_reservations(invoice_doc.name)
		invoice_doc.delete()

		return {
			"success": True,
			"message": f"Draft invoice {invoice_id} deleted successfully",
		}

	except frappe.DoesNotExistError:
		return {"success": False, "error": f"Invoice {invoice_id} not found"}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error deleting draft invoice {invoice_id}")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def submit_draft_invoice(invoice_id, data=None):
	"""
	Submit a draft sales invoice directly without payment dialog.
	This converts a draft invoice to submitted status.
	"""
	try:
		invoice_doc = frappe.get_doc("Sales Invoice", invoice_id)

		if invoice_doc.status != "Draft":
			return {
				"success": False,
				"error": f"Cannot submit invoice {invoice_id}. Only Draft invoices can be submitted. Current status: {invoice_doc.status}",
			}

		if data:
			(
				customer,
				items,
				amount_paid,
				sales_and_tax_charges,
				mode_of_payment,
				business_type,
				roundoff_amount,
				delivery_charge,
				delivery_personnel,
				is_credit_sale,
				allow_partial_payment,
				due_date,
				salesperson,
				tax_id,
				enable_background_submission,
				loyalty_redemption,
			) = parse_invoice_data(data)

			rebuilt_doc = build_sales_invoice_doc(
				customer,
				items,
				amount_paid,
				sales_and_tax_charges,
				mode_of_payment,
				business_type,
				roundoff_amount,
				delivery_charge,
				include_payments=True,
				delivery_personnel=delivery_personnel,
				is_credit_sale=is_credit_sale,
				allow_partial_payment=allow_partial_payment,
				due_date=due_date,
				salesperson=salesperson,
				tax_id=tax_id,
				create_batch_and_serial_bundle=False,
				enable_background_submission=enable_background_submission,
				loyalty_redemption=loyalty_redemption,
			)

			invoice_doc.customer = rebuilt_doc.customer
			invoice_doc.due_date = rebuilt_doc.due_date
			invoice_doc.custom_delivery_date = rebuilt_doc.custom_delivery_date
			invoice_doc.enable_background_invoice_submission = rebuilt_doc.enable_background_invoice_submission
			invoice_doc.custom_delivery_personnel = rebuilt_doc.custom_delivery_personnel
			invoice_doc.tax_id = rebuilt_doc.tax_id
			invoice_doc.pos_profile = rebuilt_doc.pos_profile
			invoice_doc.company = rebuilt_doc.company
			invoice_doc.currency = rebuilt_doc.currency
			invoice_doc.selling_price_list = rebuilt_doc.selling_price_list
			invoice_doc.conversion_rate = rebuilt_doc.conversion_rate
			invoice_doc.update_stock = rebuilt_doc.update_stock
			invoice_doc.warehouse = rebuilt_doc.warehouse
			invoice_doc.cost_center = rebuilt_doc.cost_center
			invoice_doc.is_pos = rebuilt_doc.is_pos
			invoice_doc.redeem_loyalty_points = rebuilt_doc.redeem_loyalty_points
			invoice_doc.loyalty_points = rebuilt_doc.loyalty_points
			invoice_doc.loyalty_amount = rebuilt_doc.loyalty_amount
			invoice_doc.loyalty_program = rebuilt_doc.loyalty_program
			invoice_doc.loyalty_redemption_account = rebuilt_doc.loyalty_redemption_account
			invoice_doc.loyalty_redemption_cost_center = rebuilt_doc.loyalty_redemption_cost_center
			invoice_doc.taxes_and_charges = rebuilt_doc.taxes_and_charges
			invoice_doc.set("items", [])
			for item_row in rebuilt_doc.get("items", []):
				invoice_doc.append("items", item_row.as_dict())
			invoice_doc.set("taxes", [])
			for tax_row in rebuilt_doc.get("taxes", []):
				invoice_doc.append("taxes", tax_row.as_dict())
			invoice_doc.set("sales_team", [])
			for sales_person_row in rebuilt_doc.get("sales_team", []):
				invoice_doc.append("sales_team", sales_person_row.as_dict())

			if items:
				_create_batch_and_serial_bundle(items, invoice_doc)

			invoice_doc.set_taxes()
			invoice_doc.set_missing_values()
			invoice_doc.calculate_taxes_and_totals()

			# Payments must be applied after the first totals pass, then totals are recalculated
			# so ERPNext includes both payment rows and loyalty redemption in paid/outstanding amounts.
			invoice_doc.set("payments", [])
			_add_payment_entries(invoice_doc, mode_of_payment)
			invoice_doc.calculate_taxes_and_totals()

			invoice_doc.save(ignore_permissions=True)

		validate_required_salesperson(invoice_doc)

		if enable_background_submission:
			_mark_invoice_queued(invoice_doc, frappe.session.user)
			_apply_klik_invoice_flags(invoice_doc, is_submitted=False)
			invoice_doc.save(ignore_permissions=True)

			try:
				_reserve_stock_for_queued_invoice(invoice_doc)
			except Exception as reserve_error:
				_update_queue_fields(invoice_doc, QUEUE_STATUSES["failed"], error_message=str(reserve_error))
				invoice_doc.save(ignore_permissions=True)
				return {"success": False, "error": str(reserve_error)}

			frappe.enqueue(
				"klik_pos.api.sales_invoice.process_queued_sales_invoice",
				queue="long",
				enqueue_after_commit=True,
				invoice_name=invoice_doc.name,
				requested_by=frappe.session.user,
			)

			return {
				"success": True,
				"message": f"Draft invoice {invoice_id} queued for background submission",
				"queue_status": invoice_doc.queue_status,
				"invoice_name": invoice_doc.name,
				"invoice": invoice_doc,
			}
		else:
			_apply_klik_invoice_flags(invoice_doc, is_submitted=True)
			invoice_doc.submit()
			try:
				_cancel_sales_invoice_reservations(invoice_doc.name)
			except Exception:
				frappe.log_error(
					frappe.get_traceback(),
					f"Failed to cancel reservations after submit for {invoice_doc.name}",
				)

			return {
				"success": True,
				"message": f"Draft invoice {invoice_id} submitted successfully",
				"invoice_name": invoice_doc.name,
				"invoice": invoice_doc,
			}

	except frappe.DoesNotExistError:
		return {"success": False, "error": f"Invoice {invoice_id} not found"}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error submitting draft invoice {invoice_id}")
		return {"success": False, "error": str(e)}
