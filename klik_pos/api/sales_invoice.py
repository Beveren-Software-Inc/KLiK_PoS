import frappe
from frappe import _
import json
import erpnext
from klik_pos.klik_pos.utils import get_current_pos_profile, get_user_default_company
from frappe.utils import flt

@frappe.whitelist(allow_guest=True)
def get_sales_invoices(limit=100, start=0):
    try:
        invoices = frappe.get_all(
            "Sales Invoice",
            filters={},  
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
                "custom_zatca_submit_status"
            ],
            order_by="modified desc",
            limit=limit,
            start=start
        )

        # Fetch full name for each owner
        for inv in invoices:
            full_name = frappe.db.get_value("User", inv["owner"], "full_name") or inv["owner"]
            inv["cashier_name"] = full_name
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

        return {
            "success": True,
            "data": {
                **invoice_data,
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



# @frappe.whitelist()
# def create_and_submit_invoice(data):
    
#     try:
#         customer, items, amount_paid, sales_and_tax_charges, mode_of_payment,business_type = parse_invoice_data(data)
#         doc = build_sales_invoice_doc(customer, items, amount_paid, sales_and_tax_charges,mode_of_payment,business_type, include_payments=True)
#         doc.base_paid_amount=amount_paid
#         doc.paid_amount=amount_paid
#         doc.outstanding_amount = 0
#         doc.save()
#         doc.submit()

#         return {
#             "success": True,
#             "invoice_name": doc.name,
#             "invoice": doc
#         }

#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
#         return {
#             "success": False,
#             "message": str(e)
#         }
        
@frappe.whitelist()
def create_and_submit_invoice(data):
    print("Data received in create_and_submit_invoice:", data)
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

        return {
            "success": True,
            "invoice_name": doc.name,
            "invoice": doc
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Submit Invoice Error")
        return {
            "success": False,
            "message": str(e)
        }
        
# @frappe.whitelist()
# def create_draft_invoice(data):
#     try:
#         customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type = parse_invoice_data(data)
#         doc = build_sales_invoice_doc(customer, items, amount_paid, sales_and_tax_charges, mode_of_payment,business_type, include_payments=True)
#         doc.insert(ignore_permissions=True)

#         return {
#             "success": True,
#             "invoice_name": doc.name,
#             "invoice": doc
#         }

#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(), "Draft Invoice Error")
#         return {
#             "success": False,
#             "message": str(e)
#         }
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


# def parse_invoice_data(data):
#     """Sanitize and extract customer and items from request payload."""
#     if isinstance(data, str):
#         data = json.loads(data)

#     print("My data", str(data))
#     customer = data.get("customer", {}).get("id")
#     items = data.get("items", [])
    
#     amount_paid = 0.0
#     sales_and_tax_charges = get_current_pos_profile().taxes_and_charges
#     business_type = data.get("businessType")
#     mode_of_payment = None
#     if data.get("amountPaid"):
#         amount_paid=data.get("amountPaid")
        
#     if data.get("paymentMethods"):
#         mode_of_payment=data.get("paymentMethods")
        
#     if data.get("SalesTaxCharges"):
#         sales_and_tax_charges=data.get("SalesTaxCharges")
    
#     if not customer or not items:
#         frappe.throw(_("Customer and items are required"))

#     return customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type
def parse_invoice_data(data):
    """Sanitize and extract customer and items from request payload including round-off."""
    if isinstance(data, str):
        data = json.loads(data)

    print("My data", str(data))
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

# def build_sales_invoice_doc(customer, items, amount_paid, sales_and_tax_charges, mode_of_payment,business_type, include_payments=False):
#     doc = frappe.new_doc("Sales Invoice")
#     doc.customer = customer
#     doc.due_date = frappe.utils.nowdate()
#     doc.custom_delivery_date = frappe.utils.nowdate()
#     doc.currency = get_customer_billing_currency(customer)
#     doc.is_pos = 1 if business_type=="B2C" else 0
#     doc.update_stock = 1

#     pos_profile = get_current_pos_profile()

#     # Set taxes and charges template
#     if sales_and_tax_charges:
#         doc.taxes_and_charges = sales_and_tax_charges
#     else:
#         doc.taxes_and_charges = pos_profile.taxes_and_charges

#     # Populate items
#     for item in items:
#         doc.append("items", {
#             "item_code": item.get("id"),
#             "qty": item.get("quantity"),
#             "rate": item.get("price"),
#             "income_account": get_income_accounts(item.get("id")),
#             "expense_account": get_expense_accounts(item.get("id"))
#         })

#     # If taxes_and_charges is set, populate taxes manually
#     if doc.taxes_and_charges:

#         tax_doc = get_tax_template(doc.taxes_and_charges)
#         if tax_doc:
#             for tax in tax_doc.taxes:
#                 doc.append("taxes", {
#                     "charge_type": tax.charge_type,
#                     "account_head": tax.account_head,
#                     "description": tax.description,
#                     "cost_center": tax.cost_center,
#                     "rate": tax.rate,
#                     "row_id": tax.row_id,
#                     "tax_amount": tax.tax_amount,
#                     "included_in_print_rate": tax.included_in_print_rate,
#                     # "add_deduct_tax": tax.add_deduct_tax,
#                     # "category": tax.category
#                 })

#     # Add payments if required
#     if include_payments and isinstance(mode_of_payment, list):
#         for payment in mode_of_payment:
#             doc.append("payments", {
#                 "mode_of_payment": payment["method"],
#                 "amount": payment["amount"]
#             })

#     return doc
def build_sales_invoice_doc(customer, items, amount_paid, sales_and_tax_charges, mode_of_payment, business_type, roundoff_amount=0.0, include_payments=False):
    doc = frappe.new_doc("Sales Invoice")
    doc.customer = customer
    doc.due_date = frappe.utils.nowdate()
    doc.custom_delivery_date = frappe.utils.nowdate()
    doc.currency = get_customer_billing_currency(customer)
    doc.is_pos = 1 if business_type == "B2C" else 0
    doc.update_stock = 1

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
        # doc.append("taxes", {
        #     "charge_type": "Actual",
        #     "account_head": roundoff_account,
        #     "description": "Round Off Adjustment",
        #     "tax_amount": flt(roundoff_amount),
        #     "base_tax_amount": flt(roundoff_amount * conversion_rate),
        #     "add_deduct_tax": "Add" if roundoff_amount > 0 else "Deduct",
        #     "category": "Total",
        #     "included_in_print_rate": 0,
        #     "cost_center": doc.cost_center or frappe.get_cached_value("Company", doc.company, "cost_center")
        # })

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
 
# def custom_calculate_totals_with_roundoff(self):
    
#     """Custom totals calculation that handles round-off amounts"""
#     # if self.doc.get("taxes"):
#     #     self.doc.grand_total = flt(self.doc.get("taxes")[-1].total) + flt(
#     #         self.doc.get("grand_total_diff")
#     #     )
#     # else:
#     self.doc.grand_total = 500

    # if self.doc.get("taxes"):
    #     self.doc.total_taxes_and_charges = flt(
    #         self.doc.grand_total - self.doc.net_total - flt(self.doc.get("grand_total_diff")),
    #         self.doc.precision("total_taxes_and_charges"),
    #     )
    # else:
    #     self.doc.total_taxes_and_charges = 0.0

    # # Apply Round-off Amount (similar to retention logic)
    # if (self.doc.doctype == "Sales Invoice" 
    #     and self.doc.custom_roundoff_account 
    #     and self.doc.custom_roundoff_amount):
    #     # Add round-off amount to grand total (can be negative for write-offs)
    #     self.doc.grand_total -= self.doc.custom_roundoff_amount
        
    #     # Create write-off entry for round-off amount
    #     self.create_roundoff_writeoff_entry()

    # self._set_in_company_currency(self.doc, ["total_taxes_and_charges", "rounding_adjustment"])
    # if self.doc.doctype in [
    #     "Quotation",
    #     "Sales Order", 
    #     "Delivery Note",
    #     "Sales Invoice",
    #     "POS Invoice",
    # ]:
    #     self.doc.base_grand_total = (
    #         flt(self.doc.grand_total * self.doc.conversion_rate, self.doc.precision("base_grand_total"))
    #         if self.doc.total_taxes_and_charges
    #         else self.doc.base_net_total
    #     )
        
    # else:
    #     self.doc.taxes_and_charges_added = self.doc.taxes_and_charges_deducted = 0.0
    #     for tax in self.doc.get("taxes"):
    #         if tax.category in ["Valuation and Total", "Total"]:
    #             if tax.add_deduct_tax == "Add":
    #                 self.doc.taxes_and_charges_added += flt(tax.tax_amount_after_discount_amount)
    #             else:
    #                 self.doc.taxes_and_charges_deducted += flt(tax.tax_amount_after_discount_amount)

    #     self.doc.round_floats_in(self.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"])

    #     self.doc.base_grand_total = (
    #         flt(self.doc.grand_total * self.doc.conversion_rate)
    #         if (self.doc.taxes_and_charges_added or self.doc.taxes_and_charges_deducted)
    #         else self.doc.base_net_total
    #     )

    #     self._set_in_company_currency(self.doc, ["taxes_and_charges_added", "taxes_and_charges_deducted"])

    # self.doc.round_floats_in(self.doc, ["grand_total", "base_grand_total"])
    # self.set_rounded_total()


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