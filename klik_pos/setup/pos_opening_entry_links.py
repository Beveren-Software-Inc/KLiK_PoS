import frappe


def ensure_pos_opening_entry_links():
	"""Ensure required Document Links exist in the POS Opening Entry DocType."""
	required_links = [
		{"link_doctype": "Sales Invoice", "link_fieldname": "custom_pos_opening_entry"},
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

	print("✅ POS Opening Entry Document Links verified/updated.")
