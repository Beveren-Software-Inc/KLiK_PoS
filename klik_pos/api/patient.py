# Copyright (c) 2026, Beveren Sooftware Inc and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist()
def search_patients(search_query: str):
	"""
	Search for Patients by name, patient_id, or file_no.
	Returns a list of matching patients.
	"""
	try:
		# Check if Patient doctype exists (from healthcare app)
		if not frappe.db.exists("DocType", "Patient"):
			frappe.throw("Patient doctype not found. Please ensure the healthcare app is installed.")
		
		search_term = f"%{search_query}%"
		
		# Use frappe.get_all which handles field existence automatically
		# Search by patient_name (which should always exist)
		patients = frappe.get_all(
			"Patient",
			fields=["name", "patient_name"],
			filters={
				"patient_name": ["like", search_term]
			},
			or_filters=[
				["patient_name", "like", search_term],
			],
			order_by="patient_name asc",
			limit=50
		)
		
		# Try to add file_no if it exists (optional field)
		patient_meta = frappe.get_meta("Patient")
		has_file_no = any(f.fieldname == "file_no" for f in patient_meta.fields)
		
		if has_file_no:
			# Re-fetch with file_no field and add file_no to search
			patients = frappe.get_all(
				"Patient",
				fields=["name", "patient_name", "file_no"],
				filters={
					"patient_name": ["like", search_term]
				},
				or_filters=[
					["patient_name", "like", search_term],
					["file_no", "like", search_term],
				],
				order_by="patient_name asc",
				limit=50
			)
		
		return patients
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error searching Patients")
		frappe.throw(f"Failed to search Patients: {str(e)}")


@frappe.whitelist()
def get_pending_inpatient_medication_orders(patient: str):
	"""
	Get all pending Inpatient Medication Orders for a given Patient.
	Returns orders with their child table items (drug and dosage).
	"""
	try:
		# Check if Inpatient Medication Order doctype exists
		if not frappe.db.exists("DocType", "Inpatient Medication Order"):
			frappe.throw("Inpatient Medication Order doctype not found. Please ensure the healthcare app is installed.")
		
		# Get the doctype meta to check which fields exist
		order_meta = frappe.get_meta("Inpatient Medication Order")
		available_fields = [f.fieldname for f in order_meta.fields]
		
		# Build fields list based on what's available
		fields_to_fetch = ["name", "patient", "patient_name", "status"]
		order_by_field = None
		
		# Check if posting_date exists
		if "posting_date" in available_fields:
			fields_to_fetch.append("posting_date")
			order_by_field = "posting_date desc"
		elif "creation" in available_fields:
			# Fallback to creation date if posting_date doesn't exist
			fields_to_fetch.append("creation")
			order_by_field = "creation desc"
		
		# Fetch pending orders for the patient
		orders = frappe.get_all(
			"Inpatient Medication Order",
			fields=fields_to_fetch,
			filters={
				"patient": patient,
				"status": ["in", ["Pending", "Active"]]
			},
			order_by=order_by_field if order_by_field else "name desc"
		)
		
		# For each order, get the child table items
		for order in orders:
			order_doc = frappe.get_doc("Inpatient Medication Order", order.name)
			order["items"] = []
			
			# Get the doctype meta to find child tables
			order_meta = frappe.get_meta("Inpatient Medication Order")
			child_table_fields = []
			
			# Find all child table fields
			for field in order_meta.fields:
				if field.fieldtype == "Table":
					child_table_fields.append(field.fieldname)
			
			# Common fieldnames in healthcare (fallback if meta doesn't work)
			if not child_table_fields:
				child_table_fields = ["drug_prescription", "medication_orders", "items", "drugs", "drug_prescription_detail"]
			
			for fieldname in child_table_fields:
				if hasattr(order_doc, fieldname):
					child_table = getattr(order_doc, fieldname)
					if child_table and len(child_table) > 0:
						for item in child_table:
							# Get all available attributes
							item_dict = {}
							
							# Try different field names for drug/item_code
							if hasattr(item, "drug"):
								item_dict["drug"] = item.drug
							elif hasattr(item, "item_code"):
								item_dict["drug"] = item.item_code
							elif hasattr(item, "drug_code"):
								item_dict["drug"] = item.drug_code
							
							# Try different field names for drug_name
							if hasattr(item, "drug_name"):
								item_dict["drug_name"] = item.drug_name
							elif hasattr(item, "item_name"):
								item_dict["drug_name"] = item.item_name
							
							# Get dosage if available
							if hasattr(item, "dosage"):
								item_dict["dosage"] = item.dosage
							
							# Get other optional fields
							if hasattr(item, "dosage_form"):
								item_dict["dosage_form"] = item.dosage_form
							
							if hasattr(item, "period"):
								item_dict["period"] = item.period
							
							if hasattr(item, "quantity"):
								item_dict["quantity"] = item.quantity
							else:
								item_dict["quantity"] = 1
							
							# Only add if we have a drug/item_code
							if item_dict.get("drug"):
								order["items"].append(item_dict)
						
						if order["items"]:
							break  # Found items, no need to check other fields
		return orders
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching Inpatient Medication Orders")
		frappe.throw(f"Failed to fetch Inpatient Medication Orders: {str(e)}")
