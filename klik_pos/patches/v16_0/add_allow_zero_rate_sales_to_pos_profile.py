import frappe

FIELDNAME = "allow_zero_rate_sales"

def execute():
    if frappe.db.has_column("POS Profile", FIELDNAME):
        frappe.db.sql(
            """
            UPDATE `tabPOS Profile`
            SET allow_zero_rate_sales = 0
            WHERE allow_zero_rate_sales IS NULL
            """
        )
