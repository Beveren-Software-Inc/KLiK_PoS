import frappe
from frappe import _

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
