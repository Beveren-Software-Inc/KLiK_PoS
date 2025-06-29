# klik_pos/api/tax.py
import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_sales_tax_categories():
    try:
        tax_categories = frappe.get_all(
            "Sales Taxes and Charges Template",
            filters={"disabled": 0},
            fields=["name", "title"]
        )

        result = []

        for cat in tax_categories:
            # Optional: Compute tax rate (assuming 'Sales Taxes and Charges' child table exists)
            tax_rate = frappe.db.get_value("Sales Taxes and Charges", {"parent": cat.name}, "rate") or 0.0
            result.append({
                "id": cat.name,
                "name": cat.title or cat.name,
                "rate": float(tax_rate)
            })

        return {"success": True, "data": result}
    except Exception as e:
        frappe.log_error("Tax Fetch Failed", str(e))
        return {"success": False, "error": str(e)}
