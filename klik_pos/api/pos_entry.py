import json
import traceback

import frappe
from frappe import _
from frappe.utils import now_datetime, today

from klik_pos.klik_pos.utils import get_current_pos_profile


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

	# Set totals
	doc.total_quantity = data.get("total_quantity")
	doc.net_total = data.get("net_total")
	doc.total_amount = data.get("total_amount")

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

	# Submit and link back to opening entry
	doc.submit()
	frappe.db.set_value("POS Opening Entry", opening_entry.name, "pos_closing_entry", doc.name)

	return doc
