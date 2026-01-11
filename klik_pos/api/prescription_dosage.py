# Copyright (c) 2026, Beveren Sooftware Inc and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def get_prescription_dosages():
	"""
	Fetch all Prescription Dosage records from the healthcare app.
	Returns a list of dosage records with name and dosage fields.
	"""
	print("🔍 API called: get_prescription_dosages")
	try:
		# Check if Prescription Dosage doctype exists (from healthcare app)
		doctype_exists = frappe.db.exists("DocType", "Prescription Dosage")
		print(f"🔍 Prescription Dosage doctype exists: {doctype_exists}")
		
		if not doctype_exists:
			error_msg = "Prescription Dosage doctype not found. Please ensure the healthcare app is installed."
			print(f"❌ {error_msg}")
			frappe.throw(error_msg)
		
		# Fetch all prescription dosages
		print("🔍 Fetching prescription dosages from database...")
		dosages = frappe.get_all(
			"Prescription Dosage",
			fields=["name", "dosage"],
			filters={},
			order_by="dosage asc"
		)
		print(f"✅ Found {len(dosages)} prescription dosages: {str(dosages)}")
		return dosages
	except Exception as e:
		error_traceback = frappe.get_traceback()
		print(f"❌ Error in get_prescription_dosages: {str(e)}")
		print(f"❌ Traceback: {error_traceback}")
		frappe.log_error(error_traceback, "Error fetching Prescription Dosages")
		frappe.throw(f"Failed to fetch Prescription Dosages: {str(e)}")
