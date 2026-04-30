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

    SalesPerson = Table("tabSales Person")
    Auth = Table("__Auth")

    existing = (
        frappe.qb.from_(SalesPerson)
        .inner_join(Auth)
        .on(Auth.name == SalesPerson.name)
        .select(SalesPerson.name, SalesPerson.sales_person_name)
        .where(Auth.doctype == "Sales Person")
        .where(Auth.fieldname == "pos_pin")
        .where(SalesPerson.name != doc.name)
    ).run(as_dict=True)

    for sp in existing:
        try:
            sp_doc = frappe.get_doc("Sales Person", sp.name)
            existing_pin = sp_doc.get_password("pos_pin")

            if existing_pin and str(existing_pin) == str(current_pin):
                frappe.throw(
                    _("This PIN is already in use. Please choose a different PIN.")
                )
        except Exception:
            continue
