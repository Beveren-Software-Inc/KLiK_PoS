import frappe 
from frappe import _
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist()
def get_payment_modes():
    try:
        pos_doc = get_current_pos_profile()
        payment_modes = frappe.get_all(
            "POS Payment Method",
            filters={"parent": pos_doc.name},
            fields=["mode_of_payment", "default", "allow_in_returns"]
        )

        for mode in payment_modes:
            payment_type = frappe.get_value("Mode of Payment", mode["mode_of_payment"], "type")
            mode["type"] = payment_type or "Default"

        return {
            "success": True,
            "pos_profile": pos_doc.name,
            "data": payment_modes
        }

    except Exception as e:
        frappe.log_error(title="Get Payment Modes Error", message=str(e))
        return {"success": False, "error": str(e)}
