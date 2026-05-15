import frappe
from frappe import _
from frappe.query_builder import Table


def validate_unique_pos_pin(doc, method=None):
    """
    Validate that pos_pin is unique before saving
    """
    if not doc.pos_pin:
        return

    current_pin = doc.get_password("pos_pin")
    if not current_pin:
        return

    # Validate PIN format: must be 4 digits
    pin_str = str(current_pin).strip()

    if not pin_str.isdigit():
        frappe.throw(_("POS PIN must contain only numbers"))

    if len(pin_str) != 4:
        frappe.throw(_("POS PIN must be exactly 4 digits"))
