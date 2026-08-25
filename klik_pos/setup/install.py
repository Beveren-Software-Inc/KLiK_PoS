import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


def before_install():
    """Remove custom fields and property setters added by the old POS extension."""
    custom_fields_to_remove = [
        "POS Profile-custom_require_sales_person",
        "POS Profile-custom_sales_person_pin_required",
        "Sales Person-pos_pin",
        "Customer-custom_is_walkin",
    ]

    for field_name in custom_fields_to_remove:
        if frappe.db.exists("Custom Field", field_name):
            frappe.delete_doc("Custom Field", field_name, ignore_permissions=True)


def ensure_sales_invoice_reserve_stock_field():
    """Create the custom reserve stock flag on Sales Invoice if it does not exist."""
    if frappe.db.exists("Custom Field", "Sales Invoice-reserve_stock"):
        return

    create_custom_field(
        "Sales Invoice",
        {
            "fieldname": "reserve_stock",
            "label": "Reserve Stock",
            "fieldtype": "Check",
            "insert_after": "is_pos",
            "default": "0",
            "read_only": 1,
            "hidden": 1,
            "module": "KLiK PoS",
            "description": "Reserve stock using ERPNext Stock Reservation Entry while the invoice is queued or pending submission.",
        },
        ignore_validate=True,
    )


def remove_deprecated_sales_invoice_checkout_request_field():
    """Remove metadata from the superseded wide-table checkout-key design."""
    field_name = "Sales Invoice-custom_checkout_request_id"
    if frappe.db.exists("Custom Field", field_name):
        frappe.delete_doc("Custom Field", field_name, ignore_permissions=True)


def ensure_stock_reservation_is_enabled():
    if not frappe.db.get_single_value("Stock Settings", "enable_stock_reservation"):
        frappe.db.set_value("Stock Settings", None, "enable_stock_reservation", 1)
