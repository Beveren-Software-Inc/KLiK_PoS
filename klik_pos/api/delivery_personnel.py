# Copyright (c) 2026, Beveren Sooftware Inc and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def get_delivery_personnel_list(delivery_via: str | None = None):
	"""Get list of delivery personnel (optionally filtered by Delivery Channel)."""
	try:
		fields = ["name", "delivery_personnel"]
		filters: dict[str, object] = {}

		# Optional new field (added in this app)
		if frappe.db.has_column("Delivery Personnel", "delivery_via"):
			fields.append("delivery_via")
			if delivery_via:
				filters["delivery_via"] = delivery_via

		personnel = frappe.get_all(
			"Delivery Personnel",
			fields=fields,
			filters=filters,
			order_by="delivery_personnel asc",
		)
		return {"success": True, "data": personnel}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching delivery personnel")
		return {"success": False, "error": str(e)}
