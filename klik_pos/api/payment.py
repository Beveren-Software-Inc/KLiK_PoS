import frappe
from frappe import _
from frappe.utils import flt, nowdate

from klik_pos.api.sales_invoice import get_current_pos_opening_entry
from klik_pos.klik_pos.utils import get_current_pos_profile
from klik_pos.api.sql_builder import apply_sql_permissions


def _doctype_has_field(doctype, fieldname):
	return frappe.get_meta(doctype).has_field(fieldname)


def _get_company_currency(company):
	return frappe.db.get_value("Company", company, "default_currency")


def _get_account_currency(account, fallback_currency):
	return frappe.db.get_value("Account", account, "account_currency") or fallback_currency


def _get_customer_receivable_account(customer, company):
	try:
		from erpnext.accounts.party import get_party_account

		return get_party_account("Customer", customer, company)
	except Exception:
		return frappe.db.get_value("Company", company, "default_receivable_account")


def _get_mode_of_payment_account(mode_of_payment, company):
	mode_doc = frappe.get_doc("Mode of Payment", mode_of_payment)
	for row in mode_doc.accounts:
		if row.company == company and row.default_account:
			return row.default_account

	company_doc = frappe.get_doc("Company", company)
	if getattr(mode_doc, "type", None) == "Bank":
		return company_doc.default_bank_account
	return company_doc.default_cash_account


def _validate_pos_payment_mode(pos_profile, mode_of_payment):
	allowed = frappe.db.exists(
		"POS Payment Method",
		{"parent": pos_profile.name, "mode_of_payment": mode_of_payment},
	)
	if not allowed:
		frappe.throw(
			_("Mode of Payment {0} is not configured for POS Profile {1}.").format(
				frappe.bold(mode_of_payment),
				frappe.bold(pos_profile.name),
			)
		)


@frappe.whitelist()
def create_customer_payment_entry(
	customer,
	amount,
	mode_of_payment,
	sales_invoice=None,
	allocated_amount=None,
	reference_no=None,
	reference_date=None,
	remarks=None,
):
	"""Receive a standalone customer payment from Klik POS."""
	try:
		if not customer:
			frappe.throw(_("Customer is required."))
		if not frappe.db.exists("Customer", customer):
			frappe.throw(_("Customer {0} does not exist.").format(frappe.bold(customer)))

		amount = flt(amount)
		if amount <= 0:
			frappe.throw(_("Payment amount must be greater than zero."))
		if not mode_of_payment:
			frappe.throw(_("Mode of Payment is required."))

		invoice_doc = None
		if sales_invoice:
			invoice_doc = frappe.get_doc("Sales Invoice", sales_invoice)
			if invoice_doc.docstatus != 1:
				frappe.throw(_("Only submitted Sales Invoices can receive payments."))
			if invoice_doc.customer != customer:
				frappe.throw(_("Sales Invoice {0} does not belong to customer {1}.").format(sales_invoice, customer))
			if flt(invoice_doc.outstanding_amount) <= 0:
				frappe.throw(_("Sales Invoice {0} has no outstanding amount.").format(sales_invoice))

		opening_entry = get_current_pos_opening_entry()
		if not opening_entry:
			frappe.throw(_("Open a POS Opening Entry before receiving customer payments."))

		opening_doc = frappe.get_doc("POS Opening Entry", opening_entry)
		pos_profile = frappe.get_doc("POS Profile", opening_doc.pos_profile)
		_validate_pos_payment_mode(pos_profile, mode_of_payment)

		company = pos_profile.company
		company_currency = _get_company_currency(company)
		party_account = _get_customer_receivable_account(customer, company)
		paid_to = _get_mode_of_payment_account(mode_of_payment, company)

		if not party_account:
			frappe.throw(_("Default receivable account is not configured for company {0}.").format(company))
		if not paid_to:
			frappe.throw(_("Default account is not configured for Mode of Payment {0}.").format(mode_of_payment))

		party_account_currency = _get_account_currency(party_account, company_currency)
		paid_to_account_currency = _get_account_currency(paid_to, company_currency)

		payment_entry = frappe.new_doc("Payment Entry")
		payment_entry.payment_type = "Receive"
		payment_entry.party_type = "Customer"
		payment_entry.party = customer
		payment_entry.company = company
		payment_entry.posting_date = nowdate()
		payment_entry.mode_of_payment = mode_of_payment
		payment_entry.party_account = party_account
		payment_entry.paid_from = party_account
		payment_entry.paid_to = paid_to
		payment_entry.paid_amount = amount
		payment_entry.received_amount = amount
		payment_entry.source_exchange_rate = 1
		payment_entry.target_exchange_rate = 1
		payment_entry.paid_from_account_currency = party_account_currency
		payment_entry.paid_to_account_currency = paid_to_account_currency

		if invoice_doc:
			allocated_amount = flt(allocated_amount or amount)
			if allocated_amount <= 0:
				frappe.throw(_("Allocated amount must be greater than zero."))
			if allocated_amount > flt(invoice_doc.outstanding_amount) + 0.00001:
				frappe.throw(
					_("Allocated amount cannot exceed outstanding amount {0}.").format(
						frappe.bold(flt(invoice_doc.outstanding_amount))
					)
				)
			if allocated_amount > amount + 0.00001:
				frappe.throw(_("Allocated amount cannot exceed payment amount."))

			payment_entry.append(
				"references",
				{
					"reference_doctype": "Sales Invoice",
					"reference_name": invoice_doc.name,
					"total_amount": invoice_doc.grand_total,
					"outstanding_amount": invoice_doc.outstanding_amount,
					"allocated_amount": allocated_amount,
				},
			)

		if reference_no:
			payment_entry.reference_no = reference_no
			payment_entry.reference_date = reference_date or nowdate()

		payment_entry.remarks = remarks or (
			_("Customer payment received from Klik POS for invoice {0}.").format(invoice_doc.name)
			if invoice_doc
			else _("Customer payment received from Klik POS.")
		)

		if _doctype_has_field("Payment Entry", "custom_pos_opening_entry"):
			payment_entry.custom_pos_opening_entry = opening_entry
		if _doctype_has_field("Payment Entry", "custom_is_created_from_klik"):
			payment_entry.custom_is_created_from_klik = 1

		payment_entry.insert(ignore_permissions=True)
		payment_entry.submit()

		return {
			"success": True,
			"name": payment_entry.name,
			"customer": customer,
			"amount": amount,
			"mode_of_payment": mode_of_payment,
			"sales_invoice": invoice_doc.name if invoice_doc else None,
			"allocated_amount": allocated_amount if invoice_doc else None,
			"opening_entry": opening_entry,
			"posting_date": payment_entry.posting_date,
		}
	except Exception as e:
		frappe.log_error(
			title="Create Customer Payment Entry Error",
			message=frappe.get_traceback(),
		)
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_outstanding_sales_invoices(limit=100, start=0, search=""):
	"""Return submitted Sales Invoices with outstanding customer balance."""
	try:
		limit = min(int(limit or 100), 500)
		start = int(start or 0)

		pos_profile = get_current_pos_profile()
		conditions = [
			"si.docstatus = 1",
			"si.is_return = 0",
			"si.outstanding_amount > 0",
		]
		params = []

		if pos_profile:
			conditions.append("si.company = %s")
			params.append(pos_profile.company)

		if search and search.strip():
			search_term = f"%{search.strip()}%"
			conditions.append("(si.name LIKE %s OR si.customer LIKE %s OR si.customer_name LIKE %s)")
			params.extend([search_term, search_term, search_term])

		where_clause = " AND ".join(conditions)

		count_sql = apply_sql_permissions(f"""
			SELECT COUNT(si.name) AS total
			FROM `tabSales Invoice` si
			WHERE {where_clause}
		""")
		total_rows = frappe.db.sql(count_sql, tuple(params), as_dict=True)
		total_count = total_rows[0].total if total_rows else 0

		data_sql = apply_sql_permissions(f"""
			SELECT
				si.name,
				si.posting_date,
				si.due_date,
				si.customer,
				si.customer_name,
				si.company,
				si.currency,
				si.grand_total,
				si.rounded_total,
				si.paid_amount,
				si.outstanding_amount,
				si.status
			FROM `tabSales Invoice` si
			WHERE {where_clause}
			ORDER BY si.posting_date DESC, si.modified DESC
			LIMIT %s OFFSET %s
		""")
		invoices = frappe.db.sql(data_sql, (*params, limit, start), as_dict=True)

		return {
			"success": True,
			"data": invoices,
			"total_count": total_count,
			"start": start,
			"limit": limit,
		}
	except Exception as e:
		frappe.log_error(
			title="Get Outstanding Sales Invoices Error",
			message=frappe.get_traceback(),
		)
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_unallocated_customer_payment_entries(limit=100, start=0, search=""):
	"""Return submitted customer Payment Entries with unallocated amount."""
	try:
		limit = min(int(limit or 100), 500)
		start = int(start or 0)

		pos_profile = get_current_pos_profile()
		conditions = [
			"pe.docstatus = 1",
			"pe.payment_type = 'Receive'",
			"pe.party_type = 'Customer'",
			"pe.unallocated_amount > 0",
		]
		params = []

		if pos_profile:
			conditions.append("pe.company = %s")
			params.append(pos_profile.company)

		if search and search.strip():
			search_term = f"%{search.strip()}%"
			conditions.append("(pe.name LIKE %s OR pe.party LIKE %s OR c.customer_name LIKE %s)")
			params.extend([search_term, search_term, search_term])

		where_clause = " AND ".join(conditions)

		count_sql = apply_sql_permissions(f"""
			SELECT COUNT(pe.name) AS total
			FROM `tabPayment Entry` pe
			LEFT JOIN `tabCustomer` c ON c.name = pe.party
			WHERE {where_clause}
		""")
		total_rows = frappe.db.sql(count_sql, tuple(params), as_dict=True)
		total_count = total_rows[0].total if total_rows else 0

		data_sql = apply_sql_permissions(f"""
			SELECT
				pe.name,
				pe.posting_date,
				pe.party AS customer,
				c.customer_name,
				pe.company,
				pe.mode_of_payment,
				pe.paid_amount,
				pe.unallocated_amount,
				pe.paid_from_account_currency AS currency,
				pe.reference_no,
				pe.remarks
			FROM `tabPayment Entry` pe
			LEFT JOIN `tabCustomer` c ON c.name = pe.party
			WHERE {where_clause}
			ORDER BY pe.posting_date DESC, pe.modified DESC
			LIMIT %s OFFSET %s
		""")
		payments = frappe.db.sql(data_sql, (*params, limit, start), as_dict=True)

		return {
			"success": True,
			"data": payments,
			"total_count": total_count,
			"start": start,
			"limit": limit,
		}
	except Exception as e:
		frappe.log_error(
			title="Get Unallocated Customer Payment Entries Error",
			message=frappe.get_traceback(),
		)
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def reconcile_payment_entry_with_invoice(payment_entry, sales_invoice, allocated_amount=None):
	"""Allocate an unallocated customer Payment Entry against an outstanding Sales Invoice."""
	try:
		if not payment_entry or not sales_invoice:
			frappe.throw(_("Payment Entry and Sales Invoice are required."))

		pe = frappe.get_doc("Payment Entry", payment_entry)
		si = frappe.get_doc("Sales Invoice", sales_invoice)

		if pe.docstatus != 1:
			frappe.throw(_("Payment Entry {0} must be submitted.").format(payment_entry))
		if si.docstatus != 1:
			frappe.throw(_("Sales Invoice {0} must be submitted.").format(sales_invoice))
		if pe.payment_type != "Receive" or pe.party_type != "Customer":
			frappe.throw(_("Only customer receive Payment Entries can be reconciled from POS."))
		if pe.party != si.customer:
			frappe.throw(_("Payment Entry and Sales Invoice must belong to the same customer."))
		if pe.company != si.company:
			frappe.throw(_("Payment Entry and Sales Invoice must belong to the same company."))

		unallocated_amount = flt(pe.unallocated_amount)
		outstanding_amount = flt(si.outstanding_amount)
		allocated_amount = flt(allocated_amount or min(unallocated_amount, outstanding_amount))

		if unallocated_amount <= 0:
			frappe.throw(_("Payment Entry {0} has no unallocated amount.").format(payment_entry))
		if outstanding_amount <= 0:
			frappe.throw(_("Sales Invoice {0} has no outstanding amount.").format(sales_invoice))
		if allocated_amount <= 0:
			frappe.throw(_("Allocated amount must be greater than zero."))
		if allocated_amount > unallocated_amount + 0.00001:
			frappe.throw(_("Allocated amount cannot exceed payment unallocated amount."))
		if allocated_amount > outstanding_amount + 0.00001:
			frappe.throw(_("Allocated amount cannot exceed invoice outstanding amount."))

		party_account = pe.party_account or _get_customer_receivable_account(pe.party, pe.company)
		invoice_party_account = getattr(si, "debit_to", None) or party_account
		reconciliation = frappe.new_doc("Payment Reconciliation")
		reconciliation.company = pe.company
		reconciliation.party_type = "Customer"
		reconciliation.party = pe.party
		reconciliation.receivable_payable_account = invoice_party_account

		payment_row = {
			"reference_type": "Payment Entry",
			"reference_name": pe.name,
			"posting_date": pe.posting_date,
			"amount": unallocated_amount,
			"currency": pe.paid_from_account_currency,
			"exchange_rate": pe.source_exchange_rate or 1,
			"cost_center": getattr(pe, "cost_center", None),
			"remarks": pe.remarks,
		}
		invoice_row = {
			"invoice_type": "Sales Invoice",
			"invoice_number": si.name,
			"invoice_date": si.posting_date,
			"amount": si.grand_total,
			"currency": si.currency,
			"outstanding_amount": outstanding_amount,
			"exchange_rate": si.conversion_rate or 1,
		}

		reconciliation.append("payments", payment_row)
		reconciliation.append("invoices", invoice_row)
		reconciliation.allocate_entries(
			frappe._dict(
				{
					"payments": [frappe._dict(payment_row)],
					"invoices": [frappe._dict(invoice_row)],
				}
			)
		)
		for row in reconciliation.get("allocation"):
			row.allocated_amount = allocated_amount
		reconciliation.reconcile()

		from erpnext.accounts.utils import update_voucher_outstanding

		update_voucher_outstanding("Sales Invoice", si.name, invoice_party_account, "Customer", si.customer)
		si.reload()
		if flt(si.outstanding_amount) == outstanding_amount:
			update_voucher_outstanding("Sales Invoice", si.name, None, "Customer", si.customer)
		update_voucher_outstanding("Payment Entry", pe.name, party_account, "Customer", pe.party)
		frappe.db.commit()

		si.reload()
		pe.reload()

		return {
			"success": True,
			"payment_entry": pe.name,
			"sales_invoice": si.name,
			"allocated_amount": allocated_amount,
			"invoice_outstanding_amount": flt(si.outstanding_amount),
			"payment_unallocated_amount": flt(pe.unallocated_amount),
		}
	except Exception as e:
		frappe.log_error(
			title="Reconcile Payment Entry With Invoice Error",
			message=frappe.get_traceback(),
		)
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_payment_modes():
	try:
		# Get pos_profile from query params if provided, otherwise use current profile
		pos_profile = frappe.form_dict.get("pos_profile")

		if pos_profile:
			pos_doc = frappe.get_doc("POS Profile", pos_profile)
		else:
			pos_doc = get_current_pos_profile()
		payment_modes = frappe.get_all(
			"POS Payment Method",
			filters={"parent": pos_doc.name},
			fields=["mode_of_payment", "default", "allow_in_returns", "idx"],
			order_by="idx asc",
		)

		for mode in payment_modes:
			payment_type = frappe.get_value("Mode of Payment", mode["mode_of_payment"], "type")
			mode["type"] = payment_type or "Default"

		return {"success": True, "pos_profile": pos_doc.name, "data": payment_modes}

	except Exception as e:
		frappe.log_error(title="Get Payment Modes Error", message=str(e))
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_all_mode_of_payment():
	try:
		mode_of_payments = frappe.get_all(
			"Mode of Payment",
			filters={"enabled": 1},
			fields=["name", "type", "enabled"],
		)
		return mode_of_payments
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Fetch Mode of Payment Error")
		return {"success": False, "message": str(e)}


@frappe.whitelist()
def get_opening_entry_payment_summary():
	"""
	Get payment summary for the current POS opening entry.
	Admins see all transactions for the day, regular users see only their opening entry.
	"""
	try:
		opening_doc = _get_opening_document()
		if not opening_doc:
			return _error_response("No open POS Opening Entry found.")

		opening_info = _extract_opening_info(opening_doc)
		is_admin = _check_admin_privileges()

		sales_data = _fetch_sales_data(
			opening_info["profile"], opening_info["entry_name"], opening_info["date"], is_admin
		)

		payment_summary = _build_payment_summary(opening_info["modes"], sales_data)

		return _success_response(opening_info, payment_summary)

	except Exception as e:
		frappe.log_error(
			title="Get Opening Entry Payment Summary Error",
			message=frappe.get_traceback(),
		)
		return _error_response(str(e))


def _get_opening_document():
	"""Retrieve the current POS opening entry document."""
	current_opening_entry = get_current_pos_opening_entry()
	if not current_opening_entry:
		return None
	return frappe.get_doc("POS Opening Entry", current_opening_entry)


def _extract_opening_info(opening_doc):
	"""Extract and format opening entry information."""
	opening_start = opening_doc.period_start_date

	modes = frappe.get_all(
		"POS Opening Entry Detail",
		filters={"parent": opening_doc.name},
		fields=["mode_of_payment", "opening_amount"],
	)

	return {
		"profile": opening_doc.pos_profile,
		"entry_name": opening_doc.name,
		"date": opening_start.date(),
		"time": opening_start.time().strftime("%H:%M:%S"),
		"modes": modes,
	}


def _check_admin_privileges():
	"""Check if current user has administrative privileges."""
	user_roles = frappe.get_roles(frappe.session.user)
	admin_roles = {"Administrator", "Sales Manager", "System Manager"}
	return bool(admin_roles & set(user_roles))


def _fetch_sales_data(pos_profile, opening_entry_name, opening_date, is_admin):
	"""Fetch aggregated sales payment data based on user privileges."""
	if is_admin:
		frappe.logger().info(
			f"Admin user {frappe.session.user} - aggregating all invoices for date: {opening_date}"
		)
		return _fetch_daily_sales_data(pos_profile, opening_date)

	frappe.logger().info(f"Aggregating payments for POS opening entry: {opening_entry_name}")
	return _fetch_opening_sales_data(opening_entry_name)


def _fetch_daily_sales_data(pos_profile, opening_date):
	"""Fetch all sales data for the day (admin view)."""
	rows = frappe.db.sql(
		"""
        SELECT
            sip.mode_of_payment,
            SUM(sip.amount) as total_amount,
            COUNT(DISTINCT si.name) as transactions
        FROM `tabSales Invoice` si
        JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
        WHERE si.pos_profile = %s
          AND si.docstatus = 1
          AND si.posting_date = %s
          AND si.custom_pos_opening_entry IS NOT NULL
          AND si.custom_pos_opening_entry != ''
        GROUP BY sip.mode_of_payment
        """,
		(pos_profile, opening_date),
		as_dict=True,
	)
	return _merge_payment_entry_rows(rows, _fetch_daily_payment_entry_data(opening_date))


def _fetch_opening_sales_data(opening_entry_name):
	"""Fetch sales data for specific opening entry (regular user view)."""
	rows = frappe.db.sql(
		"""
        SELECT
            sip.mode_of_payment,
            SUM(sip.amount) as total_amount,
            COUNT(DISTINCT si.name) as transactions
        FROM `tabSales Invoice` si
        JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
        WHERE si.custom_pos_opening_entry = %s
          AND si.docstatus = 1
        GROUP BY sip.mode_of_payment
        """,
		(opening_entry_name,),
		as_dict=True,
	)
	return _merge_payment_entry_rows(rows, _fetch_opening_payment_entry_data(opening_entry_name))


def _fetch_daily_payment_entry_data(opening_date):
	if not frappe.db.has_column("Payment Entry", "custom_pos_opening_entry"):
		return []

	return frappe.db.sql(
		"""
        SELECT
            pe.mode_of_payment,
            SUM(pe.paid_amount) as total_amount,
            COUNT(pe.name) as transactions
        FROM `tabPayment Entry` pe
        WHERE pe.payment_type = 'Receive'
          AND pe.party_type = 'Customer'
          AND pe.docstatus = 1
          AND pe.posting_date = %s
          AND pe.custom_pos_opening_entry IS NOT NULL
          AND pe.custom_pos_opening_entry != ''
        GROUP BY pe.mode_of_payment
        """,
		(opening_date,),
		as_dict=True,
	)


def _fetch_opening_payment_entry_data(opening_entry_name):
	if not frappe.db.has_column("Payment Entry", "custom_pos_opening_entry"):
		return []

	return frappe.db.sql(
		"""
        SELECT
            pe.mode_of_payment,
            SUM(pe.paid_amount) as total_amount,
            COUNT(pe.name) as transactions
        FROM `tabPayment Entry` pe
        WHERE pe.payment_type = 'Receive'
          AND pe.party_type = 'Customer'
          AND pe.docstatus = 1
          AND pe.custom_pos_opening_entry = %s
        GROUP BY pe.mode_of_payment
        """,
		(opening_entry_name,),
		as_dict=True,
	)


def _merge_payment_entry_rows(sales_rows, payment_entry_rows):
	summary = {}
	for row in list(sales_rows or []) + list(payment_entry_rows or []):
		mode = row.get("mode_of_payment")
		if not mode:
			continue
		if mode not in summary:
			summary[mode] = {"mode_of_payment": mode, "total_amount": 0.0, "transactions": 0}
		summary[mode]["total_amount"] += flt(row.get("total_amount") or 0)
		summary[mode]["transactions"] += int(row.get("transactions") or 0)

	return list(summary.values())


def _build_payment_summary(opening_modes, sales_data):
	"""Build payment summary by merging opening balances with sales data."""
	sales_map = {row.mode_of_payment: row for row in sales_data}

	summary = []
	for mode in opening_modes:
		mop = mode.mode_of_payment
		sales_info = sales_map.get(mop, {})

		summary.append(
			{
				"name": mop,
				"openingAmount": float(mode.opening_amount or 0.0),
				"amount": float(sales_info.get("total_amount", 0.0)),
				"transactions": int(sales_info.get("transactions", 0)),
			}
		)

	return summary


def _success_response(opening_info, payment_summary):
	"""Build success response."""
	return {
		"success": True,
		"pos_profile": opening_info["profile"],
		"opening_entry": opening_info["entry_name"],
		"date": str(opening_info["date"]),
		"time": opening_info["time"],
		"data": payment_summary,
	}


def _error_response(error_message):
	"""Build error response."""
	return {
		"success": False,
		"error": error_message,
	}
