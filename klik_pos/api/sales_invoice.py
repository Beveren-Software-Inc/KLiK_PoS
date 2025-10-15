import json

import erpnext
import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from frappe import _
from frappe.utils import flt

from klik_pos.klik_pos.utils import get_current_pos_profile, get_user_default_company


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
def get_sales_invoices(limit=100, start=0, search=""):
	try:
		# Get current user's POS opening entry
		current_opening_entry = get_current_pos_opening_entry()

		# Check if user has administrative privileges
		user_roles = frappe.get_roles(frappe.session.user)
		is_admin_user = any(
			role in ["Administrator", "Sales Manager", "System Manager"] for role in user_roles
		)

		# Base filters
		filters = {}

		if is_admin_user:
			frappe.logger().info(
				f"Admin user {frappe.session.user} with roles {user_roles} - showing all invoices"
			)
		elif current_opening_entry:
			filters["custom_pos_opening_entry"] = current_opening_entry
			frappe.logger().info(f"Filtering invoices by POS opening entry: {current_opening_entry}")
		else:
			frappe.logger().info("No active POS opening entry found, showing all invoices")

		# Add search filter if provided
		if search and search.strip():
			search_term = search.strip()

		sales_invoice_meta = frappe.get_meta("Sales Invoice")
		has_zatca_status = any(
			df.fieldname == "custom_zatca_submit_status" for df in sales_invoice_meta.fields
		)

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

		# Get total count first
		if search and search.strip():
			search_term = search.strip()
			base_conditions = []

			# Add role-based filtering
			if is_admin_user:
				pass
			elif current_opening_entry:
				base_conditions.append(f"custom_pos_opening_entry = '{current_opening_entry}'")

			# Build search conditions
			search_conditions = [
				f"name LIKE '%{search_term}%'",
				f"customer_name LIKE '%{search_term}%'",
				f"customer LIKE '%{search_term}%'",
			]

			# Combine base conditions with search
			where_clause = ""
			if base_conditions:
				where_clause = (
					f"WHERE ({' AND '.join(base_conditions)}) AND ({' OR '.join(search_conditions)})"
				)
			else:
				where_clause = f"WHERE {' OR '.join(search_conditions)}"

			# Get total count with search
			count_query = f"""
				SELECT COUNT(*) as total
				FROM `tabSales Invoice`
				{where_clause}
			"""
			total_count = frappe.db.sql(count_query, as_dict=True)[0]["total"]

			# Get invoices with search
			fields_str = ", ".join([f"`{field}`" for field in fields])
			if has_zatca_status:
				fields_str += ", `custom_zatca_submit_status`"

			query = f"""
				SELECT {fields_str}
				FROM `tabSales Invoice`
				{where_clause}
				ORDER BY modified DESC
				LIMIT {limit} OFFSET {start}
			"""
			invoices = frappe.db.sql(query, as_dict=True)
		else:
			total_count = frappe.db.count("Sales Invoice", filters=filters)

			invoices = frappe.get_all(
				"Sales Invoice",
				filters=filters,
				fields=fields,
				order_by="modified desc",
				limit=limit,
				start=start,
			)

		# Fetch full name for each owner and add item details with return quantities
		for inv in invoices:
			full_name = frappe.db.get_value("User", inv["owner"], "full_name") or inv["owner"]
			inv["cashier_name"] = full_name

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

			# Get items with return quantities
			invoice_doc = frappe.get_doc("Sales Invoice", inv["name"])
			items = []
			for item in invoice_doc.items:
				returned_data = returned_qty(invoice_doc.customer, invoice_doc.name, item.item_code)
				returned_qty_value = returned_data.get("total_returned_qty", 0)
				available_qty = item.qty - returned_qty_value

				items.append(
					{
						"item_code": item.item_code,
						"item_name": item.item_name,
						"qty": item.qty,
						"rate": item.rate,
						"amount": item.amount,
						"description": item.description,
						"returned_qty": returned_qty_value,
						"available_qty": available_qty,
					}
				)
			inv["items"] = items

			# Get all payment methods from payment child table with amounts
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
					# Get payment entries for this invoice
					payment_entries = frappe.get_all(
						"Payment Entry Reference",
						filters={"reference_name": invoice_doc.name, "reference_doctype": "Sales Invoice"},
						fields=["parent", "allocated_amount"],
						parent_doctype="Payment Entry",
					)

					for pe_ref in payment_entries:
						payment_entry = frappe.get_doc("Payment Entry", pe_ref.parent)
						if payment_entry.docstatus == 1:  # Only submitted payment entries
							payment_methods.append(
								{
									"mode_of_payment": payment_entry.mode_of_payment,
									"amount": pe_ref.allocated_amount,
								}
							)

			inv["payment_methods"] = payment_methods
			# Keep backward compatibility - show first payment method or combined display
			if len(payment_methods) == 0:
				inv["mode_of_payment"] = "-"
			elif len(payment_methods) == 1:
				inv["mode_of_payment"] = payment_methods[0]["mode_of_payment"]
			else:
				# Show combined payment methods like "Cash/Credit Card"
				inv["mode_of_payment"] = "/".join([pm["mode_of_payment"] for pm in payment_methods])

		return {"success": True, "data": invoices, "total_count": total_count}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching sales invoices")
		return {"success": False, "error": str(e)}


@frappe.whitelist(allow_guest=True)
def get_invoice_details(invoice_id):
	try:
		invoice = frappe.get_doc("Sales Invoice", invoice_id)
		invoice_data = invoice.as_dict()

		items = []
		for item in invoice.items:
			# Get returned quantity for this item
			returned_data = returned_qty(invoice.customer, invoice.name, item.item_code)
			returned_qty_value = returned_data.get("total_returned_qty", 0)
			available_qty = item.qty - returned_qty_value

			items.append(
				{
					"item_code": item.item_code,
					"item_name": item.item_name,
					"qty": item.qty,
					"rate": item.rate,
					"amount": item.amount,
					"description": item.description,
					"returned_qty": returned_qty_value,
					"available_qty": available_qty,
				}
			)

		# Get full company address doc
		company_address_doc = None
		if invoice.company_address:
			company_address_doc = frappe.get_doc("Address", invoice.company_address).as_dict()

		# Get full customer address doc
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

		# Format posting_time from timedelta to HH:MM:SS
		if invoice_data.get("posting_time"):
			if hasattr(invoice_data["posting_time"], "total_seconds"):
				total_seconds = int(invoice_data["posting_time"].total_seconds())
				hours = total_seconds // 3600
				minutes = (total_seconds % 3600) // 60
				seconds = total_seconds % 60
				invoice_data["posting_time"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
			else:
				invoice_data["posting_time"] = str(invoice_data["posting_time"])

		# Get cashier full name from document owner
		cashier_name = frappe.db.get_value(
			"User", invoice_data.get("owner"), "full_name"
		) or invoice_data.get("owner")
		invoice_data["cashier_name"] = cashier_name

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

			# Get address information from customer_address_doc
			if customer_address_doc:
				customer_address_line1 = customer_address_doc.get("address_line1", "")
				customer_city = customer_address_doc.get("city", "")
				customer_state = customer_address_doc.get("state", "")
				customer_pincode = customer_address_doc.get("pincode", "")
				customer_country = customer_address_doc.get("country", "")

		return {
			"success": True,
			"data": {
				**invoice_data,
				"items": items,
				"company_address_doc": company_address_doc,
				"customer_address_doc": customer_address_doc,
				"customer_email": customer_email,
				"customer_mobile_no": customer_mobile_no,
				"customer_address_line1": customer_address_line1,
				"customer_city": customer_city,
				"customer_state": customer_state,
				"customer_pincode": customer_pincode,
				"customer_country": customer_country,
			},
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error fetching invoice {invoice_id}")
		return {"success": False, "error": str(e)}


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
		)

		doc.base_paid_amount = amount_paid
		doc.paid_amount = amount_paid
		doc.outstanding_amount = 0

		# Debug: Print document fields before save
		frappe.log_error(
			f"Invoice doc fields: company={doc.company}, currency={doc.currency}, conversion_rate={doc.conversion_rate}",
			"Invoice Debug",
		)

		# Save and submit in one transaction
		doc.save(ignore_permissions=True)
		doc.submit()

		payment_entry = None
		should_create_payment_entry = False

		if business_type == "B2B":
			should_create_payment_entry = True
		elif business_type == "B2B & B2C":
			# For B2B & B2C, only create payment entry for company customers
			customer_doc = frappe.get_doc("Customer", customer)
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

		# Return invoice data for print preview
		return {
			"success": True,
			"invoice_name": doc.name,
			"invoice_id": doc.name,
			"invoice": doc,
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
):
	doc = frappe.new_doc("Sales Invoice")
	doc.customer = customer
	doc.due_date = frappe.utils.nowdate()
	doc.custom_delivery_date = frappe.utils.nowdate()

	# Set company and currency from POS Profile
	# Prefer the POS Profile from the current open POS Opening Entry (active session)
	selected_pos_profile_name = None
	try:
		current_opening_entry = get_current_pos_opening_entry()
		if current_opening_entry:
			opening_doc = frappe.get_doc("POS Opening Entry", current_opening_entry)
			selected_pos_profile_name = opening_doc.pos_profile
	except Exception:
		# Fallback handled below
		pass

	if selected_pos_profile_name:
		pos_profile = frappe.get_doc("POS Profile", selected_pos_profile_name)
	else:
		pos_profile = get_current_pos_profile()

	doc.pos_profile = pos_profile.name  # Set the POS profile on the invoice
	doc.company = pos_profile.company
	doc.currency = get_customer_billing_currency(customer)
	doc.conversion_rate = 1.0  # Set conversion rate to 1 for same currency

	# Determine if this should be a POS invoice based on business type and customer type
	if business_type == "B2C":
		doc.is_pos = 1
	elif business_type == "B2B":
		doc.is_pos = 0
	elif business_type == "B2B & B2C":
		customer_doc = frappe.get_doc("Customer", customer)
		if customer_doc.customer_type == "Individual":
			doc.is_pos = 1
		else:
			doc.is_pos = 0
	else:
		doc.is_pos = 0

	doc.update_stock = 1
	doc.warehouse = pos_profile.warehouse

	# Set additional required fields
	doc.posting_date = frappe.utils.nowdate()
	doc.posting_time = frappe.utils.nowtime()
	doc.set_posting_time = 1

	# Set the current POS opening entry
	current_opening_entry = get_current_pos_opening_entry()
	if current_opening_entry:
		doc.custom_pos_opening_entry = current_opening_entry

	# Set round-off fields only if roundoff_amount is not zero
	if roundoff_amount != 0:
		doc.custom_roundoff_amount = flt(abs(roundoff_amount))
		doc.custom_roundoff_account = get_writeoff_account()
		conversion_rate = doc.conversion_rate or 1
		doc.custom_base_roundoff_amount = flt(abs(roundoff_amount) * conversion_rate)

	# Set taxes and charges template
	if sales_and_tax_charges:
		doc.taxes_and_charges = sales_and_tax_charges
	else:
		doc.taxes_and_charges = pos_profile.taxes_and_charges

	# Populate items
	for item in items:
		income_account = get_income_accounts(item.get("id"))
		expense_account = get_expense_accounts(item.get("id"))

		# Ensure we have valid accounts
		if not income_account:
			frappe.throw(
				f"Income account not found for item {item.get('id')}. Please check item defaults or company settings."
			)
		if not expense_account:
			frappe.throw(
				f"Expense account not found for item {item.get('id')}. Please check item defaults or company settings."
			)

		# Check if item has batch tracking
		item_doc = frappe.get_doc("Item", item.get("id"))
		has_batch_no = item_doc.has_batch_no

		# Prepare item data
		item_data = {
			"item_code": item.get("id"),
			"qty": item.get("quantity"),
			"rate": item.get("price"),
			"income_account": income_account,
			"expense_account": expense_account,
			"warehouse": pos_profile.warehouse,
			"cost_center": pos_profile.cost_center,
		}

		# Handle UOM if provided
		selected_uom = item.get("uom")
		if selected_uom and selected_uom != "Nos":
			item_data["uom"] = selected_uom

		# Handle batch information if item has batch tracking
		if has_batch_no:
			batch_number = item.get("batchNumber")
			if batch_number:
				item_data["use_serial_batch_fields"] = 1
				item_data["batch_no"] = batch_number

		# Handle serial number if provided
		serial_number = item.get("serialNumber")
		if serial_number:
			item_data["use_serial_batch_fields"] = 1
			item_data["serial_no"] = serial_number

		doc.append("items", item_data)

	# If taxes_and_charges is set, populate taxes manually
	if doc.taxes_and_charges:
		tax_doc = get_tax_template(doc.taxes_and_charges)
		if tax_doc:
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

	if roundoff_amount != 0:
		conversion_rate = doc.conversion_rate or 1

	# Add payments if required
	if include_payments and isinstance(mode_of_payment, list):
		for payment in mode_of_payment:
			doc.append(
				"payments",
				{"mode_of_payment": payment["method"], "amount": payment["amount"]},
			)

	return doc


def get_tax_template(template_name):
	"""
	Custom helper function to fetch Sales Taxes and Charges Template.
	Returns the full template document or raises an error if not found.
	"""
	if not template_name:
		return None

	try:
		return frappe.get_doc("Sales Taxes and Charges Template", template_name)
	except frappe.DoesNotExistError:
		frappe.throw(f"Tax Template '{template_name}' not found")


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
	try:
		pos_profile = get_current_pos_profile()
		company = pos_profile.company
		company_doc = frappe.get_doc("Company", company)
		return company_doc.default_income_account
	except Exception as e:
		frappe.log_error(
			f"Error fetching income account for {item_code}: {e!s}",
			"Income Account Error",
		)

		return None


def get_expense_accounts(item_code):
	try:
		pos_profile = get_current_pos_profile()
		company = pos_profile.company
		company_doc = frappe.get_doc("Company", company)
		return company_doc.default_expense_account
	except Exception as e:
		frappe.log_error(
			f"Error fetching expense account for {item_code}: {e!s}",
			"Expense Account Error",
		)
		return None


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

		return_doc.save()

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
					# For returns, record refund as positive amount on payment row
					return_doc.payments[0].amount = desired_payment
					for _p in return_doc.payments[1:]:
						_p.amount = 0
				else:
					return_doc.append(
						"payments",
						{"mode_of_payment": "Cash", "amount": desired_payment},
					)
			# Sync totals fields
			return_doc.paid_amount = desired_payment
			return_doc.base_paid_amount = desired_payment * (return_doc.conversion_rate or 1)
			return_doc.outstanding_amount = 0
			return_doc.save()

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


# @frappe.whitelist()
# def sync_return_payments_before_save(doc, method):
# 	"""Ensure return invoice payments match original invoice's paid amount when round-off is present.
# 	Runs just before submit to avoid validation errors like
# 	"Total payments amount can't be greater than X".
# 	"""
# 	try:
# 		# Only for returns with explicit round-off
# 		if not getattr(doc, "is_return", 0):
# 			return
# 		if not getattr(doc, "custom_roundoff_amount", 0):
# 			return

# 		# Get the original invoice to check its paid amount
# 		original_invoice_name = getattr(doc, "return_against", None)
# 		if not original_invoice_name:
# 			return

# 		original_invoice = frappe.get_doc("Sales Invoice", original_invoice_name)
# 		original_paid_amount = original_invoice.paid_amount or 0

# 		if original_paid_amount <= 0:
# 			return

# 		# Use the original invoice's paid amount as the desired payment
# 		desired_payment = abs(flt(original_paid_amount, doc.precision("grand_total")))

# 		# On returns, store refund as positive payment row
# 		if getattr(doc, "payments", None) and len(doc.payments) > 0:
# 			doc.payments[0].amount = -desired_payment
# 			for _p in doc.payments[1:]:
# 				_p.amount = 0
# 		else:
# 			doc.append("payments", {"mode_of_payment": "Cash", "amount": desired_payment})

# 		# Sync totals
# 		doc.paid_amount = -desired_payment
# 		doc.base_paid_amount = -(desired_payment * (doc.conversion_rate or 1))
# 		doc.outstanding_amount = 0
# 	except Exception:
# 		# Do not block submit; validation will still catch inconsistencies
# 		frappe.log_error(frappe.get_traceback(), "sync_return_payments_before_submit error")


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
	return {"total_returned_qty": float(total)}


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
	conditions = ["si.docstatus = 1", "si.is_return = 0"]
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

		for invoice in invoices:
			items = frappe.get_all(
				"Sales Invoice Item",
				filters={"parent": invoice.name},
				fields=["item_code", "item_name", "qty", "rate", "amount"],
			)

			# Calculate returned quantities for each item
			for item in items:
				returned_data = returned_qty(customer, invoice.name, item.item_code)
				item.returned_qty = returned_data.get("total_returned_qty", 0)
				item.available_qty = item.qty - item.returned_qty

			invoice.items = items

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

		# No custom roundoff mirroring for now

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

		return_doc.save()
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
