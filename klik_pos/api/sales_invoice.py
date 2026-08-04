import json

import erpnext
import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from frappe import _
from frappe.utils import flt

from klik_pos.klik_pos.utils import get_current_pos_profile

# Performance optimization: Cache frequently accessed data
_cached_company_data = {}
_cached_customer_data = {}
_cached_item_accounts = {}


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
		# Convert string to boolean if needed (Frappe passes query params as strings)
		if isinstance(skip_opening_entry_filter, str):
			skip_opening_entry_filter = skip_opening_entry_filter.lower() in ("true", "1", "yes")
		if isinstance(submitted_only, str):
			submitted_only = submitted_only.lower() in ("true", "1", "yes")

		# Get user IDs for cashier filter if cashier_name is provided
		cashier_user_ids = None
		if cashier_name and cashier_name != "all":
			cashier_user_ids = _get_user_ids_by_full_name(cashier_name)
			if not cashier_user_ids:
				# No users found with this name, return empty result
				return {"success": True, "data": [], "total_count": 0}

		filters, fields = _build_filters_and_fields(
			skip_opening_entry_filter=skip_opening_entry_filter, cashier_user_ids=cashier_user_ids, submitted_only=submitted_only
		)

		# Build search filters
		or_filters = _build_search_filters(search)

		invoices = frappe.get_all(
			"Sales Invoice",
			filters=filters,
			or_filters=or_filters,
			fields=fields,
			order_by="modified desc",
			limit=limit,
			start=start,
		)

		count_rows = frappe.get_all(
			"Sales Invoice", filters=filters, or_filters=or_filters, fields=["count(name) as total"]
		)
		total_count = count_rows[0].total if count_rows else 0

		# Batch fetch related data
		invoice_names = [inv.name for inv in invoices]
		user_ids = list(set([inv.owner for inv in invoices]))

		cashier_names_map = _batch_fetch_cashier_names(user_ids)
		payment_methods_map = _batch_fetch_payment_methods(invoice_names)
		items_map = _batch_fetch_items(invoice_names)

		# Process and enrich invoices
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


def _build_filters_and_fields(skip_opening_entry_filter=False, cashier_user_ids=None, submitted_only=False):
	"""Build filters and fields list based on user role and metadata.

	Args:
		skip_opening_entry_filter: If True, skip filtering by opening entry (show all invoices)
		cashier_user_ids: List of user IDs to filter by. If provided, only returns invoices for these users.
		submitted_only: If True, only return submitted invoices (docstatus=1); excludes Draft and Cancelled.
	"""
	current_opening_entry = get_current_pos_opening_entry()

	# Check if user is admin
	user_roles = frappe.get_roles()
	is_admin_user = "Administrator" in user_roles or "System Manager" in user_roles

	# Base filters: opening entry (and optionally submitted only)
	filters = {}

	# Skip opening entry filter if requested (for Invoice History page - show all invoices for cashier)
	if skip_opening_entry_filter:
		frappe.logger().info(
			f"Skipping opening entry filter - showing all invoices for user {frappe.session.user}"
		)
	elif is_admin_user:
		frappe.logger().info(
			f"Admin user {frappe.session.user} with roles {user_roles} - showing all POS invoices"
		)
		filters["custom_pos_opening_entry"] = ["!=", ""]
	elif current_opening_entry:
		filters["custom_pos_opening_entry"] = current_opening_entry
	else:
		frappe.logger().info("No active POS opening entry found, showing all POS invoices")
		filters["custom_pos_opening_entry"] = ["!=", ""]

	# Only submitted invoices (for Sales Dashboard): docstatus 1 = Submitted; 0 = Draft, 2 = Cancelled
	if submitted_only:
		filters["docstatus"] = 1

	# Check if ZATCA status field exists
	sales_invoice_meta = frappe.get_meta("Sales Invoice")
	has_zatca_status = any(df.fieldname == "custom_zatca_submit_status" for df in sales_invoice_meta.fields)

	# Build fields list
	fields = [
		"name",
		"posting_date",
		"posting_time",
		"owner",
		"customer",
		"customer_name",
		"base_grand_total",
		"base_rounded_total",
		"status",
		"discount_amount",
		"total_taxes_and_charges",
		"custom_pos_opening_entry",
		"pos_profile",
		"currency",
	]

	if has_zatca_status:
		fields.append("custom_zatca_submit_status")

	# Add cashier filter if provided
	if cashier_user_ids:
		if len(cashier_user_ids) == 1:
			filters["owner"] = cashier_user_ids[0]
		else:
			filters["owner"] = ["in", cashier_user_ids]
		frappe.logger().info(f"Filtering by cashier user IDs: {cashier_user_ids}")

	return filters, fields


def _build_search_filters(search):
	"""Build OR filters for search functionality."""
	if not search or not search.strip():
		return None

	search_term = search.strip()
	return [
		["name", "like", f"%{search_term}%"],
		["customer_name", "like", f"%{search_term}%"],
		["customer", "like", f"%{search_term}%"],
	]


def _batch_fetch_cashier_names(user_ids):
	"""Batch fetch cashier names for given user IDs."""
	if not user_ids:
		return {}

	cashier_query = """
		SELECT name, full_name
		FROM `tabUser`
		WHERE name IN ({})
	""".format(",".join([f"'{uid}'" for uid in user_ids]))
	cashier_results = frappe.db.sql(cashier_query, as_dict=True)
	return {user.name: user.full_name or user.name for user in cashier_results}


def _batch_fetch_payment_methods(invoice_names):
	"""Batch fetch payment methods for given invoices."""
	if not invoice_names:
		return {}

	payment_query = """
		SELECT parent, mode_of_payment, amount
		FROM `tabSales Invoice Payment`
		WHERE parent IN ({})
	""".format(",".join([f"'{name}'" for name in invoice_names]))
	payment_results = frappe.db.sql(payment_query, as_dict=True)

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

	items_query = """
		SELECT name, parent, item_code, uom, qty, rate, amount
		FROM `tabSales Invoice Item`
		WHERE parent IN ({})
	""".format(",".join([f"'{name}'" for name in invoice_names]))
	items_results = frappe.db.sql(items_query, as_dict=True)

	# Group by parent invoice
	items_map = {}
	for item in items_results:
		if item.parent not in items_map:
			items_map[item.parent] = []
		items_map[item.parent].append(
			{
				"name": item.name,
				"item_code": item.item_code,
				"uom": item.uom,
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


def _map_returned_qty_by_line(return_against, customer, items):
	"""
	Compute returned qty per original invoice line, for a single source invoice.

	An invoice can have multiple lines with the same item_code (e.g. different rate/UOM),
	so a plain item_code aggregate would misattribute one line's return to a sibling line
	that was never returned. Returns are matched using the (item_code, uom, rate) triple,
	which uniquely identifies a line in that scenario (there is no persisted field linking
	a return line back to a specific original line docname).
	"""
	if not items:
		return []

	returns_query = """
		SELECT sii.item_code, sii.uom, sii.rate, COALESCE(SUM(ABS(sii.qty)), 0) as qty
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
		WHERE si.is_return = 1
		  AND si.return_against = %s
		  AND si.docstatus = 1
		  AND si.customer = %s
		GROUP BY sii.item_code, sii.uom, sii.rate
	"""
	returns_data = frappe.db.sql(returns_query, (return_against, customer), as_dict=True)
	returned_map = {(row.item_code, row.uom, flt(row.rate)): row.qty for row in returns_data}

	# Return a list aligned with the input items order.
	result = []
	for item in items:
		key = (item["item_code"], item.get("uom"), flt(item["rate"]))
		result.append(returned_map.get(key, 0))
	return result


def _calculate_return_quantities(invoice, items):
	"""Calculate return quantities for credit note invoices."""
	if not items:
		return

	returned_by_line = _map_returned_qty_by_line(invoice.name, invoice.customer, items)

	# Update items with return data
	for item, returned_qty_value in zip(items, returned_by_line):
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
				**address_data,
			},
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error fetching invoice {invoice_id}")
		return {"success": False, "error": str(e)}


def _get_invoice_items_with_returns(invoice_id, customer):
	"""
	Fetch invoice items and calculate returned/available quantities.
	"""
	# Batch fetch all items for this invoice
	items_query = """
		SELECT name, item_code, item_name, uom, qty, rate, amount, description
		FROM `tabSales Invoice Item`
		WHERE parent = %s
	"""
	items_data = frappe.db.sql(items_query, (invoice_id,), as_dict=True)

	returned_by_line = (
		_map_returned_qty_by_line(invoice_id, customer, items_data) if items_data else []
	)

	# Build items list with return data
	items = []
	for item, returned_qty_value in zip(items_data, returned_by_line):
		available_qty = round(item.qty - returned_qty_value, 6)

		items.append(
			{
				"name": item.name,
				"item_code": item.item_code,
				"item_name": item.item_name,
				"uom": item.uom,
				"qty": item.qty,
				"rate": item.rate,
				"amount": item.amount,
				"description": item.description,
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

	if invoice.customer:
		customer_doc = frappe.get_doc("Customer", invoice.customer)
		customer_email = customer_doc.email_id or ""
		customer_mobile_no = customer_doc.mobile_no or ""

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
	}


@frappe.whitelist()
def create_and_submit_invoice(data):
	try:
		import time

		start_time = time.time()

		# Validate input data
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
			delivery_personnel,
		) = parse_invoice_data(data)

		# Validate required fields
		if not customer:
			frappe.throw("Customer is required")
		if not items or len(items) == 0:
			frappe.throw("At least one item is required")

		# Build invoice document
		doc = build_sales_invoice_doc(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			include_payments=True,
			delivery_personnel=delivery_personnel,
		)

		doc.base_paid_amount = amount_paid
		doc.paid_amount = amount_paid
		doc.outstanding_amount = 0

		# Save then submit; if submit fails (e.g. negative stock), delete the draft and return error
		# (do not re-raise: Frappe would rollback the transaction and undo the delete)
		doc.save(ignore_permissions=True)
		try:
			doc.submit()
		except Exception as submit_err:
			frappe.db.rollback()  # ← undo the save + partial submit atomically
			frappe.log_error(frappe.get_traceback(), "Submit Invoice Error (e.g. negative stock)")
			return {"success": False, "message": str(submit_err)}

		payment_entry = None
		should_create_payment_entry = False

		if business_type == "B2B":
			should_create_payment_entry = True
		elif business_type == "B2B & B2C":
			# For B2B & B2C, only create payment entry for company customers
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

		processing_time = time.time() - start_time
		frappe.logger().info(f"Invoice {doc.name} processed in {processing_time:.2f} seconds")

		# Return minimal invoice data for frontend performance
		return {
			"success": True,
			"invoice_name": doc.name,
			"invoice_id": doc.name,
			"invoice": {
				"name": doc.name,
				"doctype": doc.doctype,
				"customer": doc.customer,
				"customer_name": doc.customer_name,
				"posting_date": doc.posting_date,
				"base_grand_total": doc.base_grand_total,
				"currency": doc.currency,
				"status": doc.status,
				"is_pos": doc.is_pos,
				"company": doc.company,
			},
			"payment_entry": payment_entry.name if payment_entry else None,
			"processing_time": round(processing_time, 2),
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def create_draft_invoice(data):
	try:
		(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			delivery_personnel,
		) = parse_invoice_data(data)
		doc = build_sales_invoice_doc(
			customer,
			items,
			amount_paid,
			sales_and_tax_charges,
			mode_of_payment,
			business_type,
			roundoff_amount,
			include_payments=True,
			delivery_personnel=delivery_personnel,
		)
		doc.insert(ignore_permissions=True)

		return {"success": True, "invoice_name": doc.name, "invoice": doc}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Draft Invoice Error")
		return {"success": False, "message": str(e)}


def parse_invoice_data(data):
	"""Sanitize and extract customer and items from request payload including round-off."""
	if isinstance(data, str):
		data = json.loads(data)

	customer = data.get("customer", {}).get("id")
	items = data.get("items", [])

	amount_paid = 0.0
	sales_and_tax_charges = get_current_pos_profile().taxes_and_charges
	business_type = data.get("businessType")
	mode_of_payment = None

	# Extract round-off data from frontend
	roundoff_amount = data.get("roundOffAmount", 0.0)

	# Only get round-off account if round-off amount is not zero
	if roundoff_amount != 0:
		_roundoff_account = get_writeoff_account()

	if data.get("amountPaid"):
		amount_paid = data.get("amountPaid")

	if data.get("paymentMethods"):
		mode_of_payment = data.get("paymentMethods")

	if data.get("SalesTaxCharges"):
		sales_and_tax_charges = data.get("SalesTaxCharges")

	# Extract delivery personnel
	delivery_personnel = data.get("deliveryPersonnel")

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
		delivery_personnel,
	)


def build_sales_invoice_doc(
	customer,
	items,
	amount_paid,
	sales_and_tax_charges,
	mode_of_payment,
	business_type,
	roundoff_amount=0.0,
	include_payments=False,
	delivery_personnel=None,
):
	"""Main function to build a sales invoice document."""
	doc = frappe.new_doc("Sales Invoice")
	doc.customer = customer
	doc.due_date = frappe.utils.nowdate()
	doc.custom_delivery_date = frappe.utils.nowdate()

	# Set delivery personnel if provided
	if delivery_personnel:
		doc.custom_delivery_personnel = delivery_personnel

	# Configure POS profile and company settings
	pos_profile = _get_active_pos_profile()
	_set_pos_profile_fields(doc, pos_profile, customer, business_type)

	# Ensure batch/serial requirements are satisfied BEFORE building items
	_validate_and_autofetch_batch_and_serial(items, pos_profile)

	# Set posting details
	_set_posting_fields(doc)

	# Set POS opening entry
	_set_pos_opening_entry(doc)

	# Handle round-off
	_set_roundoff_fields(doc, roundoff_amount)

	# Set taxes and charges
	_set_taxes_and_charges(doc, sales_and_tax_charges, pos_profile)

	# Add items to invoice
	_populate_invoice_items(doc, items, pos_profile)

	# Populate tax details
	_populate_tax_details(doc)

	# Add payment information
	if include_payments:
		_add_payment_entries(doc, mode_of_payment)

	return doc


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


def _set_pos_profile_fields(doc, pos_profile, customer, business_type):
	"""Set POS profile, company, currency and POS-specific fields."""
	doc.pos_profile = pos_profile.name
	doc.company = pos_profile.company
	doc.currency = get_customer_billing_currency(customer)
	doc.conversion_rate = 1.0
	doc.update_stock = 1
	doc.warehouse = pos_profile.warehouse

	# Determine if this is a POS invoice
	doc.is_pos = _determine_is_pos(customer, business_type)


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
		has_batch_no = int(item_db_data.get("has_batch_no") or 0)
		has_serial_no = int(item_db_data.get("has_serial_no") or 0)

		batch_number = item.get("batchNumber")
		serial_number = item.get("serialNumber")

		# Serial-number items: always require explicit selection from UI
		if has_serial_no and not serial_number:
			frappe.throw(
				_("Serial number is mandatory for Item {0}. Please select serial numbers before submitting.").format(
					item_code
				)
			)

		# Batch-number items: optionally auto-fetch, otherwise require explicit batch
		if has_batch_no and not batch_number:
			if auto_fetch_enabled:
				# Try to auto-pick a batch using simple FIFO strategy
				auto_batch = _autofetch_batch_fifo(item_code, pos_profile.warehouse, item.get("quantity"))
				if not auto_batch:
					frappe.throw(
						_(
							"Serial No / Batch No are mandatory for Item {0} and no suitable batch is available in warehouse {1}."
						).format(item_code, pos_profile.warehouse)
					)
				# Mutate the incoming item structure so downstream code uses this batch
				item["batchNumber"] = auto_batch
			else:
				frappe.throw(
					_(
						"Serial No / Batch No are mandatory for Item {0}. Please select a batch before submitting the invoice."
					).format(item_code)
				)

def _autofetch_batch_fifo(item_code, warehouse, qty):
    from frappe.utils import nowdate
    today = nowdate()

    # Pick oldest batch that actually has sufficient stock in the warehouse
    batches = frappe.db.sql("""
        SELECT 
            sle.batch_no,
            SUM(sle.actual_qty) as available_qty,
            b.expiry_date,
            b.creation
        FROM `tabStock Ledger Entry` sle
        INNER JOIN `tabBatch` b ON b.name = sle.batch_no
        WHERE 
            sle.item_code = %(item_code)s
            AND sle.warehouse = %(warehouse)s
            AND sle.is_cancelled = 0
            AND b.disabled = 0
            AND (b.expiry_date IS NULL OR b.expiry_date >= %(today)s)
        GROUP BY sle.batch_no
        HAVING available_qty >= %(qty)s
        ORDER BY b.expiry_date ASC, b.creation ASC
        LIMIT 1
    """, {
        "item_code": item_code,
        "warehouse": warehouse,
        "qty": qty,
        "today": today
    }, as_dict=True)

    if not batches:
        frappe.throw(
            f"No batch with sufficient stock found for item {item_code} "
            f"in warehouse {warehouse}. Required: {qty}"
        )

    return batches[0].batch_no
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
	"""Set round-off amount and account if roundoff is non-zero."""
	if roundoff_amount != 0:
		conversion_rate = doc.conversion_rate or 1
		doc.custom_roundoff_amount = flt(abs(roundoff_amount))
		doc.custom_roundoff_account = get_writeoff_account()
		doc.custom_base_roundoff_amount = flt(abs(roundoff_amount) * conversion_rate)


def _set_taxes_and_charges(doc, sales_and_tax_charges, pos_profile):
	"""Set the taxes and charges template."""
	if sales_and_tax_charges:
		doc.taxes_and_charges = sales_and_tax_charges
	else:
		doc.taxes_and_charges = pos_profile.taxes_and_charges


def _populate_invoice_items(doc, items, pos_profile):
	"""Add all items to the invoice."""
	item_codes = [item.get("id") for item in items]

	# Batch fetch item data and pre-cache accounts
	item_data_map = _batch_fetch_item_data(item_codes)
	_precache_item_accounts(item_codes, pos_profile.company)

	# Add each item to the invoice
	for item in items:
		item_data = _prepare_item_data(item, item_data_map, pos_profile)
		doc.append("items", item_data)


def _batch_fetch_item_data(item_codes):
	"""Batch fetch item data for all items."""
	if not item_codes:
		return {}

	item_query = """
		SELECT name, has_batch_no, has_serial_no
		FROM `tabItem`
		WHERE name IN ({})
	""".format(",".join([f"'{code}'" for code in item_codes]))

	item_results = frappe.db.sql(item_query, as_dict=True)
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


def _get_price_list_rate_for_uom(item_code, uom, price_list):
	"""
	Resolve the selling Item Price rate for a specific UOM.

	Falls back to the stock-UOM price scaled by the UOM conversion factor when no UOM
	specific Item Price exists. Returns None when nothing can be resolved, leaving the
	caller to decide.
	"""
	if not item_code or not uom:
		return None

	filters = {"item_code": item_code, "uom": uom, "selling": 1}
	if price_list:
		filters["price_list"] = price_list

	rate = frappe.db.get_value("Item Price", filters, "price_list_rate", order_by="modified desc")
	if rate:
		return flt(rate)

	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
	if not stock_uom or stock_uom == uom:
		return None

	base_filters = {"item_code": item_code, "uom": stock_uom, "selling": 1}
	if price_list:
		base_filters["price_list"] = price_list
	base_rate = frappe.db.get_value(
		"Item Price", base_filters, "price_list_rate", order_by="modified desc"
	)
	if not base_rate:
		return None

	conversion_factor = frappe.db.get_value(
		"UOM Conversion Detail", {"parent": item_code, "uom": uom}, "conversion_factor"
	)
	if not conversion_factor:
		return None

	return flt(base_rate) * flt(conversion_factor)


def _prepare_item_data(item, item_data_map, pos_profile):
	"""Prepare item data dictionary for invoice line."""
	item_code = item.get("id")

	# Get accounts and validate
	income_account = get_income_accounts(item_code)
	expense_account = get_expense_accounts(item_code)
	_validate_item_accounts(item_code, income_account, expense_account)

	discounted_price = item.get("discountedPrice")
	original_price   = item.get("price")

	# if discounted_price is not None and flt(discounted_price) != flt(original_price):
	# 	final_rate = flt(discounted_price)
	# 	ignore_pricing_rule = 1
	# else:
	# 	final_rate = flt(original_price)
	# 	ignore_pricing_rule = 0	

	rate = item.get("price") or item.get("original_price")

	price_list_rate = _get_price_list_rate_for_uom(
		item_code, item.get("uom"), getattr(pos_profile, "selling_price_list", None)
	)
	if price_list_rate is None:
		
		selected_uom = item.get("uom")
		stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
		if not selected_uom or selected_uom == stock_uom:
			price_list_rate = item.get("original_price") or item.get("price")
		else:
			price_list_rate = rate

	# Build base item data
	item_data = {
		"item_code": item_code,
		"qty": item.get("quantity"),
		"price_list_rate": flt(price_list_rate),
		"rate": rate,
		"discount_percentage": flt(item.get("discountPercentage", 0)),
    	"discount_amount": flt(item.get("discountAmount", 0)),
		"income_account": income_account,
		"expense_account": expense_account,
		"warehouse": pos_profile.warehouse,
		"cost_center": pos_profile.cost_center,
	}

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
	"""
	Add UOM to item data when the client supplied a usable one.

	The old check skipped "Nos", assuming it is always the stock UOM - it is not (this item
	sells in Kg), so a genuine UOM was silently dropped. The client also defaults to "Nos"
	when nothing is picked, so only set a UOM the item actually defines and otherwise leave
	it unset for ERPNext to fall back to the stock UOM.
	"""
	selected_uom = item.get("uom")
	if not selected_uom:
		return

	item_code = item_data.get("item_code")
	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
	if selected_uom == stock_uom or frappe.db.exists(
		"UOM Conversion Detail", {"parent": item_code, "uom": selected_uom}
	):
		item_data["uom"] = selected_uom


def _add_batch_to_item(item_data, item, item_db_data):
	"""Add batch information if item has batch tracking."""
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


def _populate_tax_details(doc):
	"""Populate tax details from the taxes and charges template."""
	if not doc.taxes_and_charges:
		return

	tax_doc = get_tax_template(doc.taxes_and_charges)
	if not tax_doc:
		return

	for tax in tax_doc.taxes:
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
				"included_in_print_rate": tax.included_in_print_rate,
			},
		)


def _add_payment_entries(doc, mode_of_payment):
	"""Add payment entries to the invoice."""
	if not isinstance(mode_of_payment, list):
		return

	for payment in mode_of_payment:
		doc.append(
			"payments",
			{"mode_of_payment": payment["method"], "amount": payment["amount"]},
		)


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

		for item in return_doc.items:
			item.qty = -abs(item.qty)

		# Mirror original round-off/write-off as POSITIVE on return; totals logic handles sign for returns
		try:
			if getattr(original_invoice, "custom_roundoff_amount", 0):
				return_doc.custom_roundoff_amount = abs(original_invoice.custom_roundoff_amount or 0)
				return_doc.custom_base_roundoff_amount = abs(
					getattr(original_invoice, "custom_base_roundoff_amount", 0) or 0
				)
				# keep same account
				return_doc.custom_roundoff_account = getattr(
					original_invoice, "custom_roundoff_account", None
				)
				# Do not set standard write_off fields on returns to avoid double impact in GL
		except Exception:
			# non-fatal; continue without custom roundoff
			pass

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

		# Payment sync will be handled after save so totals include write-off adjustments

		return_doc.save(ignore_permissions=True)

		# After save (totals finalized by validate), sync payments to match grand/rounded total
		if getattr(return_doc, "custom_roundoff_amount", 0):
			try:
				return_doc.reload()
			except Exception:
				pass
			final_total = getattr(return_doc, "rounded_total", None)
			if final_total is None:
				final_total = return_doc.grand_total
			desired_payment = abs(flt(final_total, return_doc.precision("grand_total")))
			if desired_payment > 0:
				if return_doc.payments and len(return_doc.payments) > 0:
					# POS returns require payment rows to be negative (refund) -
					# a positive amount here fails core's verify_payment_amount_is_negative().
					return_doc.payments[0].amount = -desired_payment
					for _p in return_doc.payments[1:]:
						_p.amount = 0
				else:
					return_doc.append(
						"payments",
						{"mode_of_payment": "Cash", "amount": -desired_payment},
					)
			# Sync totals fields
			return_doc.paid_amount = -desired_payment
			return_doc.base_paid_amount = -desired_payment * (return_doc.conversion_rate or 1)
			return_doc.outstanding_amount = 0
			return_doc.save(ignore_permissions=True)

		return_doc.submit()

		return {"success": True, "return_invoice": return_doc.name}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Return Invoice Error")
		return {"success": False, "message": str(e)}


# Add this function to handle round-off amount calculation and write-off
def set_base_roundoff_amount(doc, method):
	"""Set base round-off amount based on conversion rate"""
	if not doc.custom_roundoff_amount:
		return
	if not doc.conversion_rate:
		frappe.throw(_("Please set Exchange Rate First"))
	doc.custom_base_roundoff_amount = doc.conversion_rate * doc.custom_roundoff_amount


def set_grand_total_with_roundoff(doc, method):
	"""Modify grand total calculation to include round-off amount"""
	from erpnext.controllers.taxes_and_totals import calculate_taxes_and_totals

	if not doc.doctype == "Sales Invoice":
		return
	if not doc.custom_roundoff_account or not doc.custom_roundoff_amount:
		return

	# Monkey Patch calculate_totals method to include round-off
	calculate_taxes_and_totals.calculate_totals = custom_calculate_totals


def custom_calculate_totals(self):
	"""Main function to calculate invoice totals with custom round-off logic"""
	# Calculate basic grand total and taxes
	if self.doc.get("taxes"):
		self.doc.grand_total = flt(self.doc.get("taxes")[-1].total) + flt(self.doc.get("grand_total_diff"))
	else:
		self.doc.grand_total = flt(self.doc.net_total)

	if self.doc.get("taxes"):
		self.doc.total_taxes_and_charges = flt(
			self.doc.grand_total - self.doc.net_total - flt(self.doc.get("grand_total_diff")),
			self.doc.precision("total_taxes_and_charges"),
		)
	else:
		self.doc.total_taxes_and_charges = 0.0
	# Apply existing roundoff amount
	if (
		self.doc.doctype == "Sales Invoice"
		and self.doc.custom_roundoff_account
		and self.doc.custom_roundoff_amount
	):
		adjustment = self.doc.custom_roundoff_amount or 0

		# For returns, add the round-off to reduce the negative magnitude (e.g., -13 + 3.01 = -9.99)
		if getattr(self.doc, "is_return", 0):
			self.doc.grand_total += adjustment
		else:
			# Normal invoices subtract the round-off (e.g., 13 - 3.01 = 9.99)
			self.doc.grand_total -= adjustment

	self._set_in_company_currency(self.doc, ["total_taxes_and_charges", "rounding_adjustment"])
	# Calculate base currency totals
	if self.doc.doctype in [
		"Quotation",
		"Sales Order",
		"Delivery Note",
		"Sales Invoice",
		"POS Invoice",
	]:
		self.doc.base_grand_total = (
			flt(
				self.doc.grand_total * self.doc.conversion_rate,
				self.doc.precision("base_grand_total"),
			)
			if self.doc.total_taxes_and_charges
			else self.doc.base_net_total
		)
	else:
		self.doc.taxes_and_charges_added = self.doc.taxes_and_charges_deducted = 0.0
		for tax in self.doc.get("taxes"):
			if tax.category in ["Valuation and Total", "Total"]:
				if tax.add_deduct_tax == "Add":
					self.doc.taxes_and_charges_added += flt(tax.tax_amount_after_discount_amount)
				else:
					self.doc.taxes_and_charges_deducted += flt(tax.tax_amount_after_discount_amount)

		self.doc.round_floats_in(self.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"])

		self.doc.base_grand_total = (
			flt(self.doc.grand_total * self.doc.conversion_rate)
			if (self.doc.taxes_and_charges_added or self.doc.taxes_and_charges_deducted)
			else self.doc.base_net_total
		)

		self._set_in_company_currency(self.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"])

	self.doc.round_floats_in(self.doc, ["grand_total", "base_grand_total"])
	# Mania: Auto write-off small decimal amounts (e.g., 10.01 -> 10.00, -50.01 -> -50.00)
	if self.doc.doctype == "Sales Invoice":
		if self.doc.grand_total > 0:
			grand_total_int = int(self.doc.grand_total)
			# Float-safe fractional part (handles cases like 100.0100000001)
			decimal_part = flt(self.doc.grand_total - grand_total_int, 6)
			# If decimal part is very small (<= 0.01), write it off (with small tolerance)
			if decimal_part > 0 and decimal_part <= (0.01 + 1e-6):
				writeoff_account = get_writeoff_account()
				if writeoff_account:
					small_amount = decimal_part
					if self.doc.custom_roundoff_amount:
						self.doc.custom_roundoff_amount += small_amount
					else:
						self.doc.custom_roundoff_amount = small_amount
					self.doc.custom_roundoff_account = writeoff_account
					self.doc.custom_base_roundoff_amount = self.doc.custom_roundoff_amount * (
						self.doc.conversion_rate or 1
					)
					# For positive totals, subtract to reach .00
					self.doc.grand_total -= small_amount
					self.doc.base_grand_total = self.doc.grand_total * (self.doc.conversion_rate or 1)
		elif self.doc.grand_total < 0:
			abs_total = abs(self.doc.grand_total)
			abs_int = int(abs_total)
			decimal_part = flt(abs_total - abs_int, 6)
			if decimal_part > 0 and decimal_part <= (0.01 + 1e-6):
				writeoff_account = get_writeoff_account()
				if writeoff_account:
					small_amount = decimal_part
					if self.doc.custom_roundoff_amount:
						self.doc.custom_roundoff_amount += small_amount
					else:
						self.doc.custom_roundoff_amount = small_amount
					self.doc.custom_roundoff_account = writeoff_account
					self.doc.custom_base_roundoff_amount = self.doc.custom_roundoff_amount * (
						self.doc.conversion_rate or 1
					)
					# For negative totals, add to reach .00 (e.g., -50.01 + 0.01 = -50)
					self.doc.grand_total += small_amount
					self.doc.base_grand_total = self.doc.grand_total * (self.doc.conversion_rate or 1)
	# print("Round-off amount before adjustment:", self.doc.custom_roundoff_amount)

	self.set_rounded_total()


def create_roundoff_writeoff_entry(self):
	"""Create a write-off entry for round-off amount"""
	if not self.doc.custom_roundoff_amount or not self.doc.custom_roundoff_account:
		return
	if self.doc.is_return:
		write_off_amount = -self.doc.custom_roundoff_amount
	else:
		write_off_amount = self.doc.custom_roundoff_amount

	roundoff_entry = {
		"charge_type": "Actual",
		"account_head": self.doc.custom_roundoff_account,
		"description": "Round Off Adjustment",
		"tax_amount": write_off_amount,
		"base_tax_amount": write_off_amount or (write_off_amount * self.doc.conversion_rate),
		"add_deduct_tax": "Add" if write_off_amount > 0 else "Deduct",
		"category": "Total",
		"included_in_print_rate": 0,
		"cost_center": self.doc.cost_center
		or frappe.get_cached_value("Company", self.doc.company, "cost_center"),
	}

	self.doc.append("taxes", roundoff_entry)


def get_writeoff_account():
	pos_profile = get_current_pos_profile()
	if pos_profile.write_off_account:
		return pos_profile.write_off_account


class CustomSalesInvoice(SalesInvoice):
	def get_gl_entries(self, warehouse_account=None):
		from erpnext.accounts.general_ledger import merge_similar_entries

		gl_entries = []

		self.make_roundoff_gl_entry(gl_entries)

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

	def make_roundoff_gl_entry(self, gl_entries):
		if self.custom_roundoff_account and self.custom_roundoff_amount:
			against_voucher = self.name
			# For return invoices, reverse the GL impact (credit instead of debit)
			if getattr(self, "is_return", 0):
				gl_entries.append(
					self.get_gl_dict(
						{
							"account": self.custom_roundoff_account,
							"party_type": "Customer",
							"party": self.customer,
							"due_date": self.due_date,
							"against": against_voucher,
							"credit": self.custom_base_roundoff_amount,
							"credit_in_account_currency": (
								self.custom_base_roundoff_amount
								if self.party_account_currency == self.company_currency
								else self.custom_roundoff_amount
							),
							"against_voucher": against_voucher,
							"against_voucher_type": self.doctype,
							"cost_center": (
								self.cost_center
								if self.cost_center
								else "Main - " + frappe.db.get_value("Company", self.company, "abbr")
							),
							"project": self.project,
						},
						self.party_account_currency,
						item=self,
					)
				)
			else:
				gl_entries.append(
					self.get_gl_dict(
						{
							"account": self.custom_roundoff_account,
							"party_type": "Customer",
							"party": self.customer,
							"due_date": self.due_date,
							"against": against_voucher,
							"debit": self.custom_base_roundoff_amount,
							"debit_in_account_currency": (
								self.custom_base_roundoff_amount
								if self.party_account_currency == self.company_currency
								else self.custom_roundoff_amount
							),
							"against_voucher": against_voucher,
							"against_voucher_type": self.doctype,
							"cost_center": (
								self.cost_center
								if self.cost_center
								else "Main - " + frappe.db.get_value("Company", self.company, "abbr")
							),
							"project": self.project,
						},
						self.party_account_currency,
						item=self,
					)
				)


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
def returned_qty(customer, sales_invoice, item, uom=None, rate=None):
	"""
	Get total returned quantity for a specific item against a given sales invoice.
	- sales_invoice should be the original invoice name.
	- item should be the item_code.
	- uom/rate (optional): when an invoice has multiple lines with the same item_code (e.g.
	  different rate/UOM), aggregating by item_code alone attributes one line's return to
	  every line sharing that code. Pass both to get the precise figure for just that line
	  (there's no persisted field linking a return line back to a specific original line
	  docname, so (item_code, uom, rate) is used to identify it instead); omitted, this falls
	  back to the old item_code-wide aggregate for backward compatibility.
	Returns: {'total_returned_qty': <float>}
	"""
	values = {
		"customer": customer,
		"sales_invoice": sales_invoice,
		"item": item,
		"uom": uom,
		"rate": rate,
	}

	if uom is not None and rate is not None:
		result = frappe.db.sql(
			"""
			SELECT COALESCE(SUM(ABS(sii.qty)), 0) AS total_returned_qty
			FROM `tabSales Invoice` si
			JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
			WHERE si.is_return = 1
			  AND si.return_against = %(sales_invoice)s
			  AND sii.item_code = %(item)s
			  AND sii.uom = %(uom)s
			  AND sii.rate = %(rate)s
			  AND si.docstatus = 1
			  AND si.customer = %(customer)s
			""",
			values=values,
			as_dict=True,
		)
	else:
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
				fields=["name", "parent", "item_code", "item_name", "uom", "qty", "rate", "amount"],
				order_by="parent, idx",
			)

		# Batch fetch all returned quantities. An invoice can have multiple lines sharing the
		# same item_code (e.g. different rate/UOM), so a plain item_code aggregate would
		# misattribute one line's return to a sibling line that was never returned. Match on
		# (invoice, item_code, uom, rate) instead, which uniquely identifies a line in that
		# scenario (there's no persisted field linking a return line back to a specific
		# original line docname).
		returned_map = {}
		if all_items:
			returns_query = """
				SELECT
					rsi.return_against as original_invoice,
					sii.item_code,
					sii.uom,
					sii.rate,
					COALESCE(SUM(ABS(sii.qty)), 0) as total_returned_qty
				FROM `tabSales Invoice` rsi
				JOIN `tabSales Invoice Item` sii ON rsi.name = sii.parent
				WHERE rsi.is_return = 1
				  AND rsi.return_against IN ({})
				  AND rsi.docstatus = 1
				  AND rsi.customer = %s
				GROUP BY rsi.return_against, sii.item_code, sii.uom, sii.rate
			""".format(",".join([f"'{name}'" for name in invoice_names]))
			returns_data = frappe.db.sql(returns_query, (customer,), as_dict=True)
			returned_map = {
				(row.original_invoice, row.item_code, row.uom, flt(row.rate)): row.total_returned_qty
				for row in returns_data
			}

		# Group items by invoice and calculate returned quantities
		invoice_items_map = {}
		for item in all_items:
			if item.parent not in invoice_items_map:
				invoice_items_map[item.parent] = []

			key = (item.parent, item.item_code, item.uom, flt(item.rate))
			returned_qty_value = returned_map.get(key, 0)
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

		# Set the current POS opening entry
		current_opening_entry = get_current_pos_opening_entry()
		if current_opening_entry:
			return_doc.custom_pos_opening_entry = current_opening_entry

		# Ensure no original round-off leaks into partial return
		return_doc.custom_roundoff_amount = 0
		return_doc.custom_base_roundoff_amount = 0
		return_doc.custom_roundoff_account = get_writeoff_account()

		# Filter items to only include selected ones with return quantities.
		# An invoice can have multiple lines with the same item_code (different rate/batch),
		# so matched rows are removed from the candidate pool as they're used - otherwise a
		# single original row could be matched (and its amount double-counted) by more than
		# one return_item entry while other rows are silently skipped.
		candidate_items = list(return_doc.items)
		filtered_items = []
		for return_item in return_items:
			if return_item.get("return_qty", 0) > 0:
				match_idx = None
				# Most precise: item_code + uom + rate, which uniquely identifies a line even
				# when an invoice has multiple lines sharing the same item_code (e.g. different
				# UOM). There's no persisted field linking a return line back to a specific
				# original line docname, so this composite key is used instead.
				if return_item.get("uom"):
					for idx, item in enumerate(candidate_items):
						if (
							item.item_code == return_item["item_code"]
							and item.uom == return_item["uom"]
							and flt(item.rate) == flt(return_item.get("rate", item.rate))
						):
							match_idx = idx
							break
				if match_idx is None:
					for idx, item in enumerate(candidate_items):
						if item.item_code == return_item["item_code"] and flt(item.rate) == flt(
							return_item.get("rate", item.rate)
						):
							match_idx = idx
							break
				if match_idx is None:
					for idx, item in enumerate(candidate_items):
						if item.item_code == return_item["item_code"]:
							match_idx = idx
							break
				if match_idx is not None:
					item = candidate_items.pop(match_idx)
					item.qty = -abs(return_item["return_qty"])
					filtered_items.append(item)

		return_doc.items = filtered_items

		# No custom roundoff mirroring for now

		# Clear existing payments
		return_doc.payments = []

		# Calculate total returned amount (baseline expected refund).
		# This must be tax-inclusive - final_return_amount (from the client) is based on
		# paid_amount, which includes tax. Comparing that against a tax-EXCLUSIVE item sum
		# always looks like a "write-off" equal to the tax amount and corrupts the return's
		# grand_total, so compute the actual tax-inclusive total for the selected items first.
		try:
			return_doc.calculate_taxes_and_totals()
			computed_return_total = abs(
				flt(return_doc.grand_total, return_doc.precision("grand_total") or 2)
				# flt(
				# 	return_doc.rounded_total or return_doc.grand_total,
				# 	return_doc.precision("grand_total") or 2,
				# )
			)
		except Exception:
			computed_return_total = sum(abs(item.qty * item.rate) for item in return_doc.items)

		# Prefer client-provided expected amount; fallback to the computed tax-inclusive total
		if expected_return_amount is not None:
			try:
				total_returned_amount = flt(expected_return_amount, return_doc.precision("grand_total") or 2)
			except Exception:
				total_returned_amount = computed_return_total
		else:
			total_returned_amount = computed_return_total

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

		# If cashier entered a custom refund (partial return), push the difference to round-off on the return
		try:
			# Only apply when there's a meaningful difference
			prec = return_doc.precision("grand_total") or 2
			_diff = flt(total_returned_amount, prec) - flt(final_return_amount, prec)
			if abs(_diff) > (10 ** (-prec)) / 2:
				# For returns, custom_calculate_totals ADDS custom_roundoff_amount to grand_total.
				# This is a NEW write-off specific to this partial return. Do not accumulate.
				return_doc.custom_roundoff_amount = 0
				return_doc.custom_base_roundoff_amount = 0
				return_doc.custom_roundoff_amount = abs(flt(_diff, prec))
				return_doc.custom_roundoff_account = get_writeoff_account()
				return_doc.custom_base_roundoff_amount = flt(
					return_doc.custom_roundoff_amount * (return_doc.conversion_rate or 1), prec
				)
		except Exception:
			pass
		# Handle write-off for full returns
		original_grand_total = abs(original_invoice.grand_total)
		requested_return = abs(final_return_amount)
		is_full_return = abs(requested_return - original_grand_total) < 0.01

		if (
			is_full_return
			and hasattr(original_invoice, "custom_roundoff_amount")
			and original_invoice.custom_roundoff_amount
		):
			# For full returns, mirror the original write-off to make grand total = paid amount
			return_doc.custom_roundoff_amount = abs(original_invoice.custom_roundoff_amount)
			return_doc.custom_base_roundoff_amount = abs(original_invoice.custom_base_roundoff_amount)
			return_doc.custom_roundoff_account = getattr(
				original_invoice, "custom_roundoff_account", get_writeoff_account()
			)

			# Adjust payment amount to match the paid amount (after write-off)
			original_paid_amount = original_invoice.paid_amount or original_invoice.grand_total
			final_return_amount = abs(original_paid_amount)

		if final_return_amount > 0:
			return_doc.append(
				"payments",
				{
					"mode_of_payment": final_payment_method,
					"amount": -abs(final_return_amount),
				},
			)
		# Recalculate totals (payment amount stays as user entered)
		try:
			return_doc.calculate_taxes_and_totals()
		except Exception:
			pass

		# Core settles POS returns against rounded_total, not grand_total. If the refund row
		# doesn't match it to the cent, set_total_amount_to_default_mop() wipes the payments
		# table and inserts a POSITIVE "pending amount" row, which then trips
		# verify_payment_amount_is_negative ("Amount must be negative"). Rounding makes this
		# routine: a -52.5 grand_total rounds to a -52.0 rounded_total, leaving 0.5 pending.
		# if return_doc.payments:
		# 	settled_total = flt(
		# 		return_doc.rounded_total or return_doc.grand_total,
		# 		return_doc.precision("grand_total") or 2,
		# 	)
		# 	return_doc.payments[0].amount = -abs(settled_total)
		# 	for _p in return_doc.payments[1:]:
		# 		_p.amount = 0

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
					doc.delete()
					deleted += 1
			except Exception as e:
				frappe.logger().error(f"Error deleting draft invoice {name}: {e}")
		if deleted:
			frappe.logger().info(f"Cleared {deleted} draft invoice(s) for opening entry {opening_entry_name}")
		return deleted
	except Exception as e:
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
def submit_draft_invoice(invoice_id):
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

		invoice_doc.submit()

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
