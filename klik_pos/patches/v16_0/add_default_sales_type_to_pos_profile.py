import frappe

FIELDNAME = "default_sales_type"

def execute():
    if frappe.db.has_column("POS Profile", FIELDNAME):
        frappe.db.sql(
            """
            UPDATE `tabPOS Profile`
            SET default_sales_type = 'Cash'
            WHERE IFNULL(default_sales_type, '') = ''
            """
        )
