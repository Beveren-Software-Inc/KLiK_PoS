import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def ensure_payment_entry_pos_fields():
	"""Ensure Payment Entry can be linked back to the active POS Opening Entry."""
	custom_fields = {
		"Payment Entry": [
			{
				"fieldname": "custom_pos_opening_entry",
				"label": "POS Opening Entry",
				"fieldtype": "Link",
				"options": "POS Opening Entry",
				"insert_after": "mode_of_payment",
				"module": "KLiK PoS",
				"read_only": 1,
				"no_copy": 1,
			},
			{
				"fieldname": "custom_is_created_from_klik",
				"label": "Created From Klik POS",
				"fieldtype": "Check",
				"insert_after": "custom_pos_opening_entry",
				"module": "KLiK PoS",
				"read_only": 1,
				"no_copy": 1,
			},
		]
	}
	create_custom_fields(custom_fields, update=True)


def ensure_pos_opening_entry_links():
	"""Ensure required Document Links exist in the POS Opening Entry DocType."""
	ensure_payment_entry_pos_fields()

	required_links = [
		{"link_doctype": "Sales Invoice", "link_fieldname": "custom_pos_opening_entry"},
		{"link_doctype": "Payment Entry", "link_fieldname": "custom_pos_opening_entry"},
	]

	# Fetch existing links
	existing_links = frappe.get_all(
		"DocType Link", filters={"parent": "POS Opening Entry"}, fields=["link_doctype", "link_fieldname"]
	)

	existing_links_set = {(link["link_doctype"], link["link_fieldname"]) for link in existing_links}

	for link in required_links:
		if (link["link_doctype"], link["link_fieldname"]) not in existing_links_set:
			doc = frappe.get_doc(
				{
					"doctype": "DocType Link",
					"parent": "POS Opening Entry",
					"parentfield": "links",
					"parenttype": "DocType",
					"link_doctype": link["link_doctype"],
					"link_fieldname": link["link_fieldname"],
					"group": "POS",
				}
			)
			doc.insert(ignore_permissions=True)
			frappe.db.commit()
			frappe.msgprint(f"Added missing Document Link: {link['link_doctype']} to POS Opening Entry")
