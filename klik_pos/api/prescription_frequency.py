import frappe


@frappe.whitelist()
def get_prescription_frequencies():
	"""
	Fetch all Prescription Frequency records from the healthcare app.
	Returns a list of frequency records with at least the `name` field.
	"""
	try:
		# Check if Prescription Frequency doctype exists (from healthcare app)
		if not frappe.db.exists("DocType", "Prescription Frequency"):
			frappe.throw(
				"Prescription Frequency doctype not found. Please ensure the healthcare app is installed."
			)

		meta = frappe.get_meta("Prescription Frequency")
		available_fields = {f.fieldname for f in meta.fields}

		fields = ["name"]
		order_by = "name asc"

		# Common frequency fieldnames (if present)
		if "frequency" in available_fields:
			fields.append("frequency")
			order_by = "frequency asc"
		elif "prescription_frequency" in available_fields:
			fields.append("prescription_frequency")
			order_by = "prescription_frequency asc"

		return frappe.get_all("Prescription Frequency", fields=fields, filters={}, order_by=order_by)

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching Prescription Frequencies")
		frappe.throw(f"Failed to fetch Prescription Frequencies: {str(e)}")

