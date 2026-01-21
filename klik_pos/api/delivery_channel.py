# Copyright (c) 2026, Beveren Sooftware Inc and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def get_delivery_channel_list():
	"""Get list of all Delivery Channels."""
	try:
		if not frappe.db.exists("DocType", "Delivery Channel"):
			frappe.throw("Delivery Channel doctype not found.")

		channels = frappe.get_all(
			"Delivery Channel",
			fields=["name", "delivery_via"],
			order_by="delivery_via asc",
		)
		return {"success": True, "data": channels}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching delivery channels")
		return {"success": False, "error": str(e)}

