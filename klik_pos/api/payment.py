import frappe
from frappe import _

@frappe.whitelist()
def get_payment_modes(pos_profile):
    try:
        if not pos_profile:
            return {"success": False, "error": "POS Profile is required"}

        payment_modes = frappe.get_all("POS Payment Method",
            filters={"parent": pos_profile},
            fields=["mode_of_payment", "default", "account", "type", "custom_currency"]
        )

        return {"success": True, "data": payment_modes}
    except Exception as e:
        frappe.log_error(title="Get Payment Modes Error", message=str(e))
        return {"success": False, "error": str(e)}
