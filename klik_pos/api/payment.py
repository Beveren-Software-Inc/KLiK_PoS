import frappe 
from frappe import _


@frappe.whitelist(allow_guest=True)
def get_payment_modes(pos_profile):
    try:
        if not pos_profile:
            return {"success": False, "error": "POS Profile is required"}

        payment_modes = frappe.get_all(
            "POS Payment Method",
            filters={"parent": pos_profile},
            fields=["mode_of_payment", "default", "allow_in_returns"]
        )

        for mode in payment_modes:
            mop_doc = frappe.get_value("Mode of Payment", mode["mode_of_payment"], "type")
            mode["type"] = mop_doc or "Default"

        return {"success": True, "data": payment_modes}
    
    except Exception as e:
        frappe.log_error(title="Get Payment Modes Error", message=str(e))
        return {"success": False, "error": str(e)}
