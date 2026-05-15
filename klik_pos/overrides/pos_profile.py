import frappe
from frappe import _


def remove_duplicate_sales_persons(doc, method=None):
    seen = set()
    unique = []

    for row in doc.custom_sales_person:
        if row.sales_person not in seen:
            seen.add(row.sales_person)
            unique.append(row)
        else:
            frappe.msgprint(
                _("Duplicate Sales Person {0} removed.").format(row.sales_person),
                alert=True,
            )

    doc.custom_sales_person = unique
