import frappe
from frappe import _
import json
import erpnext
from klik_pos.klik_pos.utils import get_current_pos_profile, get_user_default_company
from frappe.utils import flt

def get_current_pos_opening_entry():
    """
    Get the current active POS Opening Entry for the current user and POS profile.
    Returns the opening entry name or None if not found.
    """
    try:
        user = frappe.session.user
        pos_profile = get_current_pos_profile()

        if not pos_profile:
            return None

        # Look for a submitted POS Opening Entry with no linked closing entry
        open_entry = frappe.db.exists("POS Opening Entry", {
            "pos_profile": pos_profile.name,
            "user": user,
            "docstatus": 1,  # Submitted
            "pos_closing_entry": None
        })

        return open_entry
    except Exception as e:
        frappe.log_error(f"Error getting current POS opening entry: {str(e)}")
        return None

@frappe.whitelist(allow_guest=True)
def get_sales_invoices(limit=100, start=0):
    try:
                # Get current user's POS opening entry
        current_opening_entry = get_current_pos_opening_entry()

        # Check if user has administrative privileges
        user_roles = frappe.get_roles(frappe.session.user)
        is_admin_user = any(role in ["Administrator", "Sales Manager", "System Manager"] for role in user_roles)

        # Base filters
        filters = {}

        # If user has administrative privileges, show all invoices
        if is_admin_user:
            frappe.logger().info(f"Admin user {frappe.session.user} with roles {user_roles} - showing all invoices")
        # If user has an active POS opening entry, filter by it
        elif current_opening_entry:
            filters["custom_pos_opening_entry"] = current_opening_entry
            frappe.logger().info(f"Filtering invoices by POS opening entry: {current_opening_entry}")
        else:
            frappe.logger().info("No active POS opening entry found, showing all invoices")

        invoices = frappe.get_all(
            "Sales Invoice",
            filters=filters,
            fields=[
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
                "custom_zatca_submit_status",
                "custom_pos_opening_entry",
                "currency"
            ],
            order_by="modified desc",
            limit=limit,
            start=start
        )

        # Fetch full name for each owner and add item details with return quantities
        for inv in invoices:
            full_name = frappe.db.get_value("User", inv["owner"], "full_name") or inv["owner"]
            inv["cashier_name"] = full_name

            # Format posting_time from timedelta to HH:MM:SS
            if inv.get("posting_time"):
                if hasattr(inv["posting_time"], 'total_seconds'):
                    # It's a timedelta object
                    total_seconds = int(inv["posting_time"].total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    seconds = total_seconds % 60
                    inv["posting_time"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                else:
                    # It's already a string, keep as is
                    inv["posting_time"] = str(inv["posting_time"])

            # Get items with return quantities for this invoice
            invoice_doc = frappe.get_doc("Sales Invoice", inv["name"])
            items = []
            for item in invoice_doc.items:
                # Get returned quantity for this item
                returned_data = returned_qty(invoice_doc.customer, invoice_doc.name, item.item_code)
                returned_qty_value = returned_data.get("total_returned_qty", 0)
                available_qty = item.qty - returned_qty_value

                items.append({
                    "item_code": item.item_code,
                    "item_name": item.item_name,
                    "qty": item.qty,
                    "rate": item.rate,
                    "amount": item.amount,
                    "description": item.description,
                    "returned_qty": returned_qty_value,
                    "available_qty": available_qty
                })

            inv["items"] = items
        return {
            "success": True,
            "data": invoices
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error fetching sales invoices")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist(allow_guest=True)
def get_invoice_details(invoice_id):
    try:
        invoice = frappe.get_doc("Sales Invoice", invoice_id)
        invoice_data = invoice.as_dict()

        # Get items explicitly with return quantities
        items = []
        for item in invoice.items:
            # Get returned quantity for this item
            returned_data = returned_qty(invoice.customer, invoice.name, item.item_code)
            returned_qty_value = returned_data.get("total_returned_qty", 0)
            available_qty = item.qty - returned_qty_value

            items.append({
                "item_code": item.item_code,
                "item_name": item.item_name,
                "qty": item.qty,
                "rate": item.rate,
                "amount": item.amount,
                "description": item.description,
                "returned_qty": returned_qty_value,
                "available_qty": available_qty
            })

        # Get full company address doc
        company_address_doc = None
        if invoice.company_address:
            company_address_doc = frappe.get_doc("Address", invoice.company_address).as_dict()

        # Get full customer address doc
        customer_address_doc = None
        if invoice.customer_address:
            customer_address_doc = frappe.get_doc("Address", invoice.customer_address).as_dict()
        else:
            # fallback to primary address linked to customer
            primary_address = frappe.db.get_value(
                "Dynamic Link",
                {
                    "link_doctype": "Customer",
                    "link_name": invoice.customer,
                    "parenttype": "Address"
                },
                "parent"
            )
            if primary_address:
                customer_address_doc = frappe.get_doc("Address", primary_address).as_dict()

        # Format posting_time from timedelta to HH:MM:SS
        if invoice_data.get("posting_time"):
            if hasattr(invoice_data["posting_time"], 'total_seconds'):
                # It's a timedelta object
                total_seconds = int(invoice_data["posting_time"].total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                seconds = total_seconds % 60
                invoice_data["posting_time"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            else:
                # It's already a string, keep as is
                invoice_data["posting_time"] = str(invoice_data["posting_time"])

        return {
            "success": True,
            "data": {
                **invoice_data,
                "items": items,
                "company_address_doc": company_address_doc,
                "customer_address_doc": customer_address_doc
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error fetching invoice {invoice_id}")
        return {
            "success": False,
            "error": str(e)
        }



@frappe.whitelist()
def create_and_submit_invoice(data):
    try:
        customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type, roundoff_amount = parse_invoice_data(data)
        doc = build_sales_invoice_doc(
            customer, items, amount_paid, sales_and_tax_charges,
            mode_of_payment, business_type, roundoff_amount,
            include_payments=True
        )

        doc.base_paid_amount = amount_paid
        doc.paid_amount = amount_paid
        doc.outstanding_amount = 0
        doc.save()
        doc.submit()
        payment_entry = None
        if business_type == "B2B" and mode_of_payment and amount_paid > 0:
            payment_entry = create_payment_entry(doc, mode_of_payment, amount_paid)

        return {
            "success": True,
            "invoice_name": doc.name,
            "invoice": doc,
            "payment_entry": payment_entry.name if payment_entry else None
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
        return {
            "success": False,
            "message": str(e)
        }

@frappe.whitelist()
def create_draft_invoice(data):
    try:
        customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type, roundoff_amount = parse_invoice_data(data)
        doc = build_sales_invoice_doc(
            customer, items, amount_paid, sales_and_tax_charges,
            mode_of_payment, business_type, roundoff_amount,
            include_payments=True
        )
        doc.insert(ignore_permissions=True)

        return {
            "success": True,
            "invoice_name": doc.name,
            "invoice": doc
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Draft Invoice Error")
        return {
            "success": False,
            "message": str(e)
        }


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
    roundoff_account = None
    if roundoff_amount != 0:
        roundoff_account = get_writeoff_account()

    if data.get("amountPaid"):
        amount_paid = data.get("amountPaid")

    if data.get("paymentMethods"):
        mode_of_payment = data.get("paymentMethods")

    if data.get("SalesTaxCharges"):
        sales_and_tax_charges = data.get("SalesTaxCharges")

    if not customer or not items:
        frappe.throw(_("Customer and items are required"))

    return customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type, roundoff_amount


def build_sales_invoice_doc(customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type, roundoff_amount=0.0, include_payments=False):
    doc = frappe.new_doc("Sales Invoice")
    doc.customer = customer
    doc.due_date = frappe.utils.nowdate()
    doc.custom_delivery_date = frappe.utils.nowdate()
    doc.currency = get_customer_billing_currency(customer)
    doc.is_pos = 1 if business_type == "B2C" else 0
    doc.update_stock = 1

    # Set the current POS opening entry
    current_opening_entry = get_current_pos_opening_entry()
    if current_opening_entry:
        doc.custom_pos_opening_entry = current_opening_entry

    pos_profile = get_current_pos_profile()

    # Set round-off fields only if roundoff_amount is not zero
    if roundoff_amount != 0:
        doc.custom_roundoff_amount = flt(abs(roundoff_amount))
        doc.custom_roundoff_account = get_writeoff_account()
        # Set base round-off amount (conversion_rate defaults to 1 if not set)
        conversion_rate = doc.conversion_rate or 1
        doc.custom_base_roundoff_amount = flt(abs(roundoff_amount) * conversion_rate)

    # Set taxes and charges template
    if sales_and_tax_charges:
        doc.taxes_and_charges = sales_and_tax_charges
    else:
        doc.taxes_and_charges = pos_profile.taxes_and_charges

    # Populate items
    for item in items:
        doc.append("items", {
            "item_code": item.get("id"),
            "qty": item.get("quantity"),
            "rate": item.get("price"),
            "income_account": get_income_accounts(item.get("id")),
            "expense_account": get_expense_accounts(item.get("id"))
        })

    # If taxes_and_charges is set, populate taxes manually
    if doc.taxes_and_charges:
        tax_doc = get_tax_template(doc.taxes_and_charges)
        if tax_doc:
            for tax in tax_doc.taxes:
                doc.append("taxes", {
                    "charge_type": tax.charge_type,
                    "account_head": tax.account_head,
                    "description": tax.description,
                    "cost_center": tax.cost_center,
                    "rate": tax.rate,
                    "row_id": tax.row_id,
                    "tax_amount": tax.tax_amount,
                    "included_in_print_rate": tax.included_in_print_rate,
                })

    # Add round-off entry to taxes if present and not zero
    if roundoff_amount != 0:
        conversion_rate = doc.conversion_rate or 1

    # Add payments if required
    if include_payments and isinstance(mode_of_payment, list):
        for payment in mode_of_payment:
            doc.append("payments", {
                "mode_of_payment": payment["method"],
                "amount": payment["amount"]
            })

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
    customer_doc = frappe.get_doc("Customer", customer)
    return customer_doc.default_currency

def get_income_accounts(item_code):
    company = get_user_default_company()
    try:
        item_doc = frappe.get_doc("Item", item_code)
        item_defaults = item_doc.get("item_defaults")

        if item_defaults:
            for default in item_defaults:
                if default.get("company") == company:
                    this_company = frappe.get_doc("Company", company)
                    income_account = this_company.default_income_account
                    return income_account

        return None

    except Exception as e:
        frappe.log_error(f"Error fetching income account for {item_code} and {company}: {str(e)[:140]}", "Income Account Fetch Error")
        return None

def get_expense_accounts(item_code):
    company = get_user_default_company()
    try:
        item_doc = frappe.get_doc("Item", item_code)
        item_defaults = item_doc.item_defaults

        if item_defaults:
            for default in item_defaults:
                if default.get("company") == company:
                    this_company = frappe.get_doc("Company", company)
                    expense_account = this_company.default_expense_account
                    return expense_account

        return None

    except Exception as e:
        frappe.log_error(f"Error fetching expense account for {item_code}: {str(e)[:140]}", "Expense Account Fetch Error")
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
        return_doc = get_mapped_doc("Sales Invoice", invoice_name, {
            "Sales Invoice": {
                "doctype": "Sales Invoice",
                "field_map": {
                    "name": "return_against"
                },
                "validation": {
                    "docstatus": ["=", 1]
                }
            },
            "Sales Invoice Item": {
                "doctype": "Sales Invoice Item",
                "field_map": {
                    "name": "prevdoc_detail_docname"
                },
            }
        })

        return_doc.is_return = 1
        return_doc.posting_date = frappe.utils.nowdate()

        for item in return_doc.items:
            item.qty = -abs(item.qty)

        return_doc.payments = []
        for p in original_invoice.payments:
            return_doc.append("payments", {
                "mode_of_payment": p.mode_of_payment,
                "amount": -abs(p.amount),
                "account": p.account,
            })

        return_doc.save()
        return_doc.submit()

        return {
            "success": True,
            "return_invoice": return_doc.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Return Invoice Error")
        return {
            "success": False,
            "message": str(e)
        }


# Add this function to handle round-off amount calculation and write-off
def set_base_roundoff_amount(doc, method):
    """Set base round-off amount based on conversion rate"""
    if not doc.custom_roundoff_amount:
        return
    if not doc.conversion_rate:
        frappe.throw(_('Please set Exchange Rate First'))
    doc.custom_base_roundoff_amount = doc.conversion_rate * doc.custom_roundoff_amount

def set_grand_total_with_roundoff(doc, method):
    """Modify grand total calculation to include round-off amount"""
    from erpnext.controllers.taxes_and_totals import calculate_taxes_and_totals

    if not doc.doctype == 'Sales Invoice':
        return
    if not doc.custom_roundoff_account or not doc.custom_roundoff_amount:
        return

    # Monkey Patch calculate_totals method to include round-off
    calculate_taxes_and_totals.calculate_totals = custom_calculate_totals

def custom_calculate_totals(self):
	if self.doc.get("taxes"):
		self.doc.grand_total = flt(self.doc.get("taxes")[-1].total) + flt(
			self.doc.get("grand_total_diff")
		)
	else:
		self.doc.grand_total = flt(self.doc.net_total)

	if self.doc.get("taxes"):
		self.doc.total_taxes_and_charges = flt(
			self.doc.grand_total - self.doc.net_total - flt(self.doc.get("grand_total_diff")),
			self.doc.precision("total_taxes_and_charges"),
		)
	else:
		self.doc.total_taxes_and_charges = 0.0

	# Make Grand Total Less Retention
	if (self.doc.doctype == "Sales Invoice"
		and self.doc.custom_roundoff_account
        and self.doc.custom_roundoff_amount):
		self.doc.grand_total -= self.doc.custom_roundoff_amount

	self._set_in_company_currency(self.doc, ["total_taxes_and_charges", "rounding_adjustment"])

	if self.doc.doctype in [
		"Quotation",
		"Sales Order",
		"Delivery Note",
		"Sales Invoice",
		"POS Invoice",
	]:
		self.doc.base_grand_total = (
			flt(self.doc.grand_total * self.doc.conversion_rate, self.doc.precision("base_grand_total"))
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

	self.set_rounded_total()


def create_roundoff_writeoff_entry(self):
    """Create a write-off entry for round-off amount"""
    if not self.doc.custom_roundoff_amount or not self.doc.custom_roundoff_account:
        return

    # Add round-off entry as a separate line item or tax entry
    roundoff_entry = {
        "charge_type": "Actual",
        "account_head": self.doc.custom_roundoff_account,
        "description": "Round Off Adjustment",
        "tax_amount": self.doc.custom_roundoff_amount,
        "base_tax_amount": self.doc.custom_base_roundoff_amount or (self.doc.custom_roundoff_amount * self.doc.conversion_rate),
        "add_deduct_tax": "Add" if self.doc.custom_roundoff_amount > 0 else "Deduct",
        "category": "Total",
        "included_in_print_rate": 0,
        "cost_center": self.doc.cost_center or frappe.get_cached_value("Company", self.doc.company, "cost_center")
    }

    # Add to taxes table
    self.doc.append("taxes", roundoff_entry)



def get_writeoff_account():
    pos_profile = get_current_pos_profile()
    if pos_profile.write_off_account:
        return pos_profile.write_off_account


# Copyright (c) 2025, Beveren Software Inc and contributors
# For license information, please see license.txt

from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice

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
			gl_entries.append(
				self.get_gl_dict(
					{
						"account": self.custom_roundoff_account,
						"party_type": "Customer",
						"party": self.customer,
						"due_date": self.due_date,
						"against": against_voucher,
						"debit": self.custom_base_roundoff_amount,
						"debit_in_account_currency": self.custom_base_roundoff_amount
						if self.party_account_currency == self.company_currency
						else self.custom_roundoff_amount,
						"against_voucher": against_voucher,
						"against_voucher_type": self.doctype,
						"cost_center": self.cost_center if self.cost_center else "Main - " + frappe.db.get_value("Company", self.company, "abbr"),
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

        # Get default accounts
        company_doc = frappe.get_doc("Company", company)

        # Set party account (Customer's receivable account)
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

            # Add reference to Sales Invoice
            payment_entry.append("references", {
                "reference_doctype": "Sales Invoice",
                "reference_name": sales_invoice.name,
                "allocated_amount": amount_paid
            })

        else:
            payment_entry.paid_to = company_doc.default_cash_account
            payment_entry.mode_of_payment = "Cash"

            # Add reference to Sales Invoice
            payment_entry.append("references", {
                "reference_doctype": "Sales Invoice",
                "reference_name": sales_invoice.name,
                "allocated_amount": amount_paid
            })

        payment_entry.paid_from_account_currency = sales_invoice.currency
        payment_entry.paid_to_account_currency = sales_invoice.currency

        payment_entry.save()
        payment_entry.submit()

        return payment_entry

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error creating payment entry for invoice {sales_invoice.name}")
        frappe.throw(f"Failed to create payment entry: {str(e)}")

def get_customer_receivable_account(customer, company):
    """Get customer's receivable account using ERPNext utility"""
    try:
        from erpnext.accounts.party import get_party_account
        return get_party_account("Customer", customer, company)
    except Exception as e:
        frappe.log_error(f"Error getting receivable account for customer {customer}: {str(e)}")
        return frappe.db.get_value("Company", company, "default_receivable_account")


# @frappe.whitelist()
# def returned_qty(customer, sales_invoice, item):
#     """Get total returned quantity for a specific item from a specific invoice for a customer"""
#     values = {
#         'customer': customer,
#         'sales_invoice': sales_invoice,
#         'item': item
#     }

#     total_returned = frappe.db.sql("""
#         SELECT
#             `tabCredit Details`.sales_invoice,
#             `tabSales Invoice`.customer,
#             SUM(`tabCredit Details`.qtr) AS total_returned_qty
#         FROM
#             `tabSales Invoice`
#         JOIN
#             `tabCredit Details` ON `tabSales Invoice`.name = `tabCredit Details`.parent
#         WHERE
#             `tabSales Invoice`.customer = %(customer)s
#             AND `tabCredit Details`.sales_invoice = %(sales_invoice)s
#             AND `tabCredit Details`.item = %(item)s
#             AND `tabSales Invoice`.docstatus = 1
#             AND `tabSales Invoice`.status != 'Cancelled'
#         GROUP BY
#             `tabCredit Details`.sales_invoice, `tabSales Invoice`.customer
#     """, values=values, as_dict=True)

#     if not total_returned:
#         return {'total_returned_qty': 0}

#     return total_returned[0]
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

    # Add logic for returned quantities dynamically in SQL
    conditions.append("""
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
    """)

    # Construct query
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
            "status": ["!=", "Cancelled"]
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
                "status"
            ],
            order_by="posting_date desc"
        )

        # Get items for each invoice with returned quantities
        for invoice in invoices:
            items = frappe.get_all(
                "Sales Invoice Item",
                filters={"parent": invoice.name},
                fields=[
                    "item_code",
                    "item_name",
                    "qty",
                    "rate",
                    "amount"
                ]
            )

            # Calculate returned quantities for each item
            for item in items:
                returned_data = returned_qty(customer, invoice.name, item.item_code)
                item.returned_qty = returned_data.get("total_returned_qty", 0)
                item.available_qty = item.qty - item.returned_qty

            invoice.items = items

        return {
            "success": True,
            "data": invoices
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error fetching customer invoices for return")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def create_partial_return(invoice_name, return_items):
    """Create a partial return for selected items from an invoice"""
    try:
        # Handle parameter formats
        if isinstance(return_items, str):
            return_items = json.loads(return_items)

        original_invoice = frappe.get_doc("Sales Invoice", invoice_name)

        if original_invoice.docstatus != 1:
            frappe.throw("Only submitted invoices can be returned.")

        if original_invoice.is_return:
            frappe.throw("This invoice is already a return.")

        # Create return invoice using the same approach as return_sales_invoice
        return_doc = get_mapped_doc("Sales Invoice", invoice_name, {
            "Sales Invoice": {
                "doctype": "Sales Invoice",
                "field_map": {
                    "name": "return_against"
                },
                "validation": {
                    "docstatus": ["=", 1]
                }
            },
            "Sales Invoice Item": {
                "doctype": "Sales Invoice Item",
                "field_map": {
                    "name": "prevdoc_detail_docname"
                },
            }
        })

        return_doc.is_return = 1
        return_doc.posting_date = frappe.utils.nowdate()
        return_doc.custom_delivery_date = frappe.utils.nowdate()

        # Set the current POS opening entry
        current_opening_entry = get_current_pos_opening_entry()
        if current_opening_entry:
            return_doc.custom_pos_opening_entry = current_opening_entry

        # Filter items to only include selected ones with return quantities
        filtered_items = []
        for return_item in return_items:
            if return_item.get("return_qty", 0) > 0:
                # Find the corresponding item in the mapped doc
                for item in return_doc.items:
                    if item.item_code == return_item["item_code"]:
                        item.qty = -abs(return_item["return_qty"])
                        filtered_items.append(item)
                        break

        # Replace items with only the selected ones
        return_doc.items = filtered_items

        # Clear existing payments and recalculate based on returned items
        return_doc.payments = []

        # Calculate total returned amount (should be positive for calculation)
        total_returned_amount = sum(abs(item.qty * item.rate) for item in return_doc.items)
        total_original_amount = sum(abs(item.qty * item.rate) for item in original_invoice.items)

        if total_original_amount > 0 and total_returned_amount > 0:
            proportion = total_returned_amount / total_original_amount
            for payment in original_invoice.payments:
                # Ensure the amount is negative for returns
                payment_amount = -abs(payment.amount * proportion)
                return_doc.append("payments", {
                    "mode_of_payment": payment.mode_of_payment,
                    "amount": payment_amount,
                    "account": payment.account,
                })
        else:
            # If no items to return, don't add any payments
            pass

        return_doc.save()
        return_doc.submit()

        return {
            "success": True,
            "return_invoice": return_doc.name,
            "message": f"Partial return created successfully: {return_doc.name}"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Partial Return Error")
        return {
            "success": False,
            "message": str(e)
        }


@frappe.whitelist()
def create_multi_invoice_return(return_data):
    """Create multiple return invoices for items from different invoices"""
    try:
        if isinstance(return_data, str):
            return_data = json.loads(return_data)


        customer = return_data.get("customer")
        invoice_returns = return_data.get("invoice_returns", [])

      
        created_returns = []

        for i, invoice_return in enumerate(invoice_returns):
            invoice_name = invoice_return.get("invoice_name")
            return_items = invoice_return.get("return_items", [])


            if return_items:
                # Call create_partial_return with separate parameters
                result = create_partial_return(invoice_name, return_items)
                if result.get("success"):
                    created_returns.append(result.get("return_invoice"))
                else:
                    frappe.log_error(f"Failed to create return for {invoice_name}: {result.get('message')}")
                    # Continue with other invoices even if one fails

        return {
            "success": True,
            "created_returns": created_returns,
            "message": f"Created {len(created_returns)} return invoices successfully"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Multi Invoice Return Error")
        return {
            "success": False,
            "message": str(e)
        }
