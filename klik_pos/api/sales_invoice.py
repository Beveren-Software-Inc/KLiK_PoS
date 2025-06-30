import frappe
from frappe import _
import json
from klik_pos.klik_pos.utils import get_current_pos_profile

@frappe.whitelist(allow_guest=True)
def get_sales_invoices(limit=100, start=0):
    try:
        invoices = frappe.get_all(
            "Sales Invoice",
            filters={"docstatus": ["!=", 2]},  
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

        return {
            "success": True,
            "data": invoice_data
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
        customer, items = parse_invoice_data(data)
        doc = build_sales_invoice_doc(customer, items, include_payments=True)
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
        
@frappe.whitelist()
def create_draft_invoice(data):
    try:
        customer, items = parse_invoice_data(data)
        doc = build_sales_invoice_doc(customer, items, include_payments=False)
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
    """Sanitize and extract customer and items from request payload."""
    if isinstance(data, str):
        data = json.loads(data)

    customer = data.get("customer", {}).get("id")
    items = data.get("items", [])

    if not customer or not items:
        frappe.throw(_("Customer and items are required"))

    return customer, items

def build_sales_invoice_doc(customer, items, include_payments=False):
    doc = frappe.new_doc("Sales Invoice")
    doc.customer = customer
    doc.due_date = frappe.utils.nowdate()
    doc.custom_delivery_date = frappe.utils.nowdate()
    doc.is_pos = 1
    doc.currency = get_customer_billing_currency(customer)

    pos_profile = get_current_pos_profile()
    if pos_profile:
        doc.sales_and_taxes_charges = pos_profile.taxes_and_charges

    for item in items:
        doc.append("items", {
            "item_code": item.get("id"),
            "qty": item.get("quantity"),
            "rate": item.get("price"),
            "income_account": get_income_accounts(item.get("id")),
            "expense_account": get_expense_accounts(item.get("id"))
        })

    if include_payments:
        doc.append("payments", {
            "mode_of_payment": "Petty Cash Saad"
        })

    return doc

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
    
def get_user_default_company():
    user = frappe.session.user
    return frappe.defaults.get_user_default(user, "Company")

