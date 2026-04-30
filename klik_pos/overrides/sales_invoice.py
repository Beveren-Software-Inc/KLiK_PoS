import frappe
from frappe import _


def validate_sales_person_on_submit(doc, method=None):
    """
    Check if Sales Person is required for POS transactions and validate before submitting the Sales Invoice
    """
    if not doc.is_pos:
        return

    if not doc.pos_profile:
        return

    require_sales_person = frappe.db.get_value(
        "POS Profile",
        doc.pos_profile,
        "custom_sales_person_pin_required",
    )

    # If setting is enabled, check Sales Team table
    if require_sales_person:
        if not doc.sales_team or len(doc.sales_team) == 0:
            frappe.throw(
                _(
                    "Sales person is mandatory to complete this sale. Please enter your POS PIN"
                )
            )
