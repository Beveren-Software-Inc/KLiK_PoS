import json
import traceback

import frappe
from frappe import _
from frappe.utils import now_datetime, today

# Import for clearing cache and clearing draft invoices on close
from klik_pos.api.cache import clear_backend_cache
from klik_pos.api.sales_invoice import delete_draft_invoices_for_opening_entry
from klik_pos.klik_pos.utils import clear_pos_profile_cache, get_current_pos_profile


@frappe.whitelist()
def open_pos():
	"""Check if the current user has an open POS Opening Entry."""
	user = frappe.session.user

	# Look for any submitted POS Opening Entry with no linked closing entry for this user
	open_entry = frappe.db.exists(
		"POS Opening Entry",
		{
			"user": user,
			"docstatus": 1,
			"pos_closing_entry": None,
			"status": "Open",
		},
	)

	return True if open_entry else False


@frappe.whitelist()
def create_opening_entry():
	"""
	Create a POS Opening Entry with balance details only.
	"""
	try:
		data = frappe.local.form_dict
		if isinstance(data, str):
			data = json.loads(data)

		user = frappe.session.user

		selected_pos_profile = data.get("pos_profile")
		if selected_pos_profile:
			pos_profile = selected_pos_profile
		else:
			pos_profile = get_current_pos_profile().name if get_current_pos_profile() else None

		company = frappe.defaults.get_user_default("Company")

		if not company:
			frappe.throw(_("No default company found for user {0}").format(user))
		if not pos_profile:
			frappe.throw(_("POS Profile could not be determined"))

		balance_details = data.get("balance_details") or data.get("opening_balance", [])
		if not balance_details:
			frappe.throw(_("At least one balance detail (mode of payment) is required"))

		# Check if an open entry exists
		existing = frappe.db.exists(
			"POS Opening Entry",
			{
				"pos_profile": pos_profile,
				"user": user,
				"docstatus": 1,
				"pos_closing_entry": None,
			},
		)
		if existing:
			frappe.throw(
				_(
					"You already have an open POS Opening Entry for profile '{0}'. Please close the existing entry before creating a new one."
				).format(pos_profile)
			)

		# Create the POS Opening Entry
		doc = frappe.new_doc("POS Opening Entry")
		doc.user = user
		doc.company = company
		doc.pos_profile = pos_profile
		doc.posting_date = today()
		doc.set_posting_time = 1
		doc.period_start_date = now_datetime()

		for row in balance_details:
			doc.append(
				"balance_details",
				{
					"mode_of_payment": row.get("mode_of_payment"),
					"opening_amount": row.get("opening_amount"),
				},
			)

		doc.insert()
		doc.submit()

		# Clear POS profile cache after creating opening entry to ensure fresh data
		try:
			clear_pos_profile_cache(user=user)
			frappe.logger().info(
				f"🧹 POS Profile cache cleared after creating opening entry for user: {user}"
			)
		except Exception:
			# Do not block opening if cache clear fails; log and continue
			frappe.logger().warning(
				f"Failed to clear POS profile cache after opening entry: {frappe.get_traceback()}"
			)

		return {
			"name": doc.name,
			"message": _("POS Opening Entry created successfully."),
		}

	except Exception as e:
		# Log error with full traceback in Error Log
		frappe.log_error(message=traceback.format_exc(), title="POS Opening Entry Creation Failed")
		# Throw user-friendly message
		frappe.throw(_("Failed to create POS Opening Entry: {0}").format(str(e)))


def validate_opening_entry(doc, method):
	exists = frappe.db.exists(
		"POS Opening Entry",
		{
			"user": doc.user,
			"status": "Open",
		},
	)
	if exists:
		cashier_name = frappe.db.get_value("User", doc.user, "full_name") or doc.user
		frappe.throw(_("Cashier {0} already has an open entry: {1}").format(cashier_name, exists))


@frappe.whitelist()
def create_closing_entry():
	"""
	Create a POS Closing Entry for the current user's open POS Opening Entry.
	"""
	try:
		data = _parse_request_data()
		user = frappe.session.user
		frappe.logger().info(f"POS Closing Entry Data Received: {data}")

		opening_entry = _get_open_pos_entry(user)
		payment_data = _calculate_payment_reconciliation(opening_entry, data)

		doc = _create_and_submit_closing_doc(opening_entry, data, payment_data, user)

		return {
			"name": doc.name,
			"message": _("POS Closing Entry created successfully."),
		}

	except Exception as e:
		frappe.log_error(message=traceback.format_exc(), title="POS Closing Entry Creation Failed")
		frappe.throw(_("Failed to create POS Closing Entry: {0}").format(str(e)))


def _parse_request_data():
	"""Parse and normalize the incoming request data."""
	data = frappe.local.form_dict
	if isinstance(data, str):
		data = json.loads(data)

	# Normalize closing_balance format
	closing_balance_raw = data.get("closing_balance", {})
	closing_balance = {}

	if isinstance(closing_balance_raw, list):
		for item in closing_balance_raw:
			if isinstance(item, dict) and "mode_of_payment" in item and "closing_amount" in item:
				closing_balance[item["mode_of_payment"]] = item["closing_amount"]
	elif isinstance(closing_balance_raw, dict):
		closing_balance = closing_balance_raw

	data["closing_balance"] = closing_balance
	return data


def _get_open_pos_entry(user):
	"""Fetch and validate the open POS Opening Entry for the user."""
	open_entry = frappe.get_all(
		"POS Opening Entry",
		filters={"user": user, "docstatus": 1, "status": "Open"},
		fields=["name", "pos_profile", "company", "period_start_date"],
	)

	if not open_entry:
		frappe.throw(_("No open POS Opening Entry found for user."))

	return open_entry[0]


def _calculate_payment_reconciliation(opening_entry, data):
	"""
	Calculate payment reconciliation data including opening balances,
	sales amounts, and expected vs closing amounts.
	"""
	opening_entry_name = opening_entry.name
	opening_start = opening_entry.period_start_date
	opening_date = opening_start.date()
	opening_time = opening_start.time().strftime("%H:%M:%S")

	# Fetch opening balances
	opening_modes = frappe.get_all(
		"POS Opening Entry Detail",
		filters={"parent": opening_entry_name},
		fields=["mode_of_payment", "opening_amount"],
	)
	opening_balance_map = {row.mode_of_payment: row.opening_amount for row in opening_modes}

	# Aggregate sales by payment mode
	sales_data = frappe.db.sql(
		"""
		SELECT sip.mode_of_payment,
		       SUM(sip.amount) as total_amount,
		       COUNT(DISTINCT si.name) as transactions
		FROM `tabSales Invoice` si
		JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
		WHERE si.pos_profile = %s
		  AND si.docstatus = 1
		  AND si.posting_date = %s
		  AND si.posting_time >= %s
		  AND si.custom_pos_opening_entry IS NOT NULL
		  AND si.custom_pos_opening_entry != ''
		GROUP BY sip.mode_of_payment
		""",
		(opening_entry.pos_profile, opening_date, opening_time),
		as_dict=True,
	)
	sales_map = {row.mode_of_payment: row.total_amount for row in sales_data}

	# Build reconciliation entries
	closing_balance = data.get("closing_balance", {})
	reconciliation = []

	# Process modes with closing amounts
	for mode, closing_amount in closing_balance.items():
		opening_amount = opening_balance_map.get(mode, 0)
		sales_amount = sales_map.get(mode, 0)
		expected_amount = float(opening_amount) + float(sales_amount)
		difference = float(closing_amount) - float(expected_amount)

		reconciliation.append(
			{
				"mode_of_payment": mode,
				"opening_amount": opening_amount,
				"expected_amount": expected_amount,
				"closing_amount": closing_amount,
				"difference": difference,
			}
		)

	# Process modes without closing amounts (including all opening modes if no closing data)
	for mode, opening_amount in opening_balance_map.items():
		if mode not in closing_balance:
			sales_amount = sales_map.get(mode, 0)
			expected_amount = float(opening_amount) + float(sales_amount)
			difference = 0 - float(expected_amount)

			reconciliation.append(
				{
					"mode_of_payment": mode,
					"opening_amount": opening_amount,
					"expected_amount": expected_amount,
					"closing_amount": 0,
					"difference": difference,
				}
			)

	return reconciliation


def _calculate_closing_entry_totals(opening_entry_name):
	"""
	Calculate total_quantity, net_total, and grand_total from all Sales Invoices
	linked to the opening entry. This matches standard Frappe POS behavior.
	"""
	from frappe.utils import flt

	try:
		# Aggregate all totals in a single efficient SQL query
		aggregated = frappe.db.sql(
			"""
			SELECT
				COALESCE(SUM(si.net_total), 0) as net_total,
				COALESCE(SUM(si.grand_total), 0) as grand_total,
				COALESCE(SUM(sii.qty), 0) as total_quantity
			FROM `tabSales Invoice` si
			LEFT JOIN `tabSales Invoice Item` sii ON si.name = sii.parent
			WHERE si.custom_pos_opening_entry = %s
			  AND si.docstatus = 1
			""",
			(opening_entry_name,),
			as_dict=True,
		)

		if aggregated and len(aggregated) > 0:
			net_total = flt(aggregated[0].net_total or 0)
			grand_total = flt(aggregated[0].grand_total or 0)
			total_quantity = flt(aggregated[0].total_quantity or 0)
		else:
			net_total = grand_total = total_quantity = 0.0

		return {
			"total_quantity": total_quantity,
			"net_total": net_total,
			"grand_total": grand_total,
		}
	except Exception as e:
		frappe.logger().error(f"Error calculating closing entry totals: {frappe.get_traceback()}")
		frappe.log_error(
			message=f"Error calculating totals: {e!s}\n{traceback.format_exc()}",
			title="Closing Entry Totals Calculation Error",
		)
		# Return zeros on error to avoid blocking closing entry creation
		return {"total_quantity": 0.0, "net_total": 0.0, "grand_total": 0.0}


def _populate_sales_invoices_to_closing_entry(closing_doc, opening_entry_name):
	"""
	Populate the custom_sales_invoice child table with all Sales Invoices
	linked to the opening entry.
	"""
	try:
		if not closing_doc.meta.has_field("custom_sales_invoice"):
			return

		# Fetch all submitted Sales Invoices linked to this opening entry
		invoices = frappe.get_all(
			"Sales Invoice",
			filters={
				"custom_pos_opening_entry": opening_entry_name,
				"docstatus": 1,  # Only submitted invoices
			},
			fields=["name", "customer", "posting_date", "grand_total"],
			order_by="posting_date, posting_time",
		)

		# Append each invoice to the child table
		for invoice in invoices:
			closing_doc.append(
				"custom_sales_invoice",
				{
					"sales_invoice": invoice.name,
					"customer": invoice.customer,
					"posting_date": invoice.posting_date,
					"amount": invoice.grand_total,
				},
			)

		if invoices:
			frappe.logger().info(
				f"✅ Populated {len(invoices)} sales invoices to closing entry {closing_doc.name}"
			)
	except Exception as e:
		# Log error but don't block closing entry creation
		frappe.logger().error(f"Failed to populate sales invoices to closing entry: {frappe.get_traceback()}")
		frappe.log_error(
			message=f"Error populating sales invoices: {e!s}\n{traceback.format_exc()}",
			title="Sales Invoice Population Error",
		)


def _create_and_submit_closing_doc(opening_entry, data, payment_data, user):
	"""Create, populate, and submit the POS Closing Entry document."""
	doc = frappe.new_doc("POS Closing Entry")
	doc.user = user
	doc.company = opening_entry.company
	doc.pos_profile = opening_entry.pos_profile
	doc.period_start_date = opening_entry.period_start_date
	doc.period_end_date = now_datetime()
	doc.set_posting_time = 1
	doc.posting_date = today()
	doc.pos_opening_entry = opening_entry.name

	# Calculate totals from Sales Invoices linked to opening entry
	totals = _calculate_closing_entry_totals(opening_entry.name)

	# Set totals (use calculated values, fallback to frontend data if calculation fails)
	doc.total_quantity = totals.get("total_quantity") or data.get("total_quantity") or 0.0
	doc.net_total = totals.get("net_total") or data.get("net_total") or 0.0
	doc.total_amount = totals.get("grand_total") or data.get("total_amount") or 0.0
	doc.grand_total = totals.get("grand_total") or data.get("total_amount") or 0.0

	# Append payment reconciliation
	for payment in payment_data:
		doc.append("payment_reconciliation", payment)

	# Append taxes
	for tax in data.get("taxes", []):
		doc.append(
			"taxes",
			{
				"account_head": tax.get("account_head"),
				"rate": tax.get("rate"),
				"amount": tax.get("amount"),
			},
		)

	# Populate sales invoices linked to this opening entry
	_populate_sales_invoices_to_closing_entry(doc, opening_entry.name)

	# Submit and link back to opening entry
	doc.submit()
	frappe.db.set_value("POS Opening Entry", opening_entry.name, "pos_closing_entry", doc.name)

	# If POS Profile has "Clear draft invoices" enabled, delete all drafts for this session
	_clear_draft_invoices_on_close_if_enabled(opening_entry)

	# Clear POS profile cache for the current user to ensure fresh data on next session
	try:
		clear_pos_profile_cache(user=user)
	except Exception:
		# Do not block closing if cache clear fails; log and continue
		frappe.logger().warning("Failed to clear POS profile cache after closing entry", exc_info=True)

	return doc


def _clear_draft_invoices_on_close_if_enabled(opening_entry):
	"""If POS Profile has custom_clear_draft_invoices set, delete all draft invoices for this session."""
	try:
		pos_profile_name = opening_entry.get("pos_profile") if isinstance(opening_entry, dict) else getattr(opening_entry, "pos_profile", None)
		opening_entry_name = opening_entry.get("name") if isinstance(opening_entry, dict) else getattr(opening_entry, "name", None)
		if not pos_profile_name or not opening_entry_name:
			return
		# Check custom field (safe if field does not exist)
		clear_drafts = frappe.db.get_value("POS Profile", pos_profile_name, "custom_clear_draft_invoices")
		if clear_drafts:
			delete_draft_invoices_for_opening_entry(opening_entry_name)
	except Exception as e:
		frappe.logger().warning("Failed to clear draft invoices on close: %s", e, exc_info=True)
