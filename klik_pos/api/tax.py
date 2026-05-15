import frappe
from frappe import _

from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist(allow_guest=True)
def get_sales_tax_categories():
	try:
		tax_categories = frappe.get_all(
			"Sales Taxes and Charges Template",
			filters={"disabled": 0},
			fields=["name", "title"],
		)

		result = []
		for cat in tax_categories:
			tax_rows = frappe.get_all(
				"Sales Taxes and Charges",
				filters={"parent": cat.name},
				fields=["account_head", "charge_type", "rate", "included_in_print_rate"],
			)

			on_net_total_rows = [row for row in tax_rows if row.charge_type == "On Net Total"]
			tax_rate = sum(float(row.rate or 0) for row in on_net_total_rows)
			is_inclusive = any(bool(row.included_in_print_rate) for row in on_net_total_rows)

			result.append(
				{
					"id": cat.name,
					"name": cat.title or cat.name,
					"rate": float(tax_rate),
					"is_inclusive": bool(is_inclusive),
					"type": "inclusive" if is_inclusive else "exclusive",
					"tax_lines": [
						{
							"account_head": row.account_head,
							"charge_type": row.charge_type,
							"rate": float(row.rate or 0),
							"included_in_print_rate": bool(row.included_in_print_rate),
						}
						for row in tax_rows
					],
				}
			)

		default_template = None
		try:
			pos_doc = get_current_pos_profile()
			default_template = pos_doc.taxes_and_charges
		except Exception:
			pass

		return {"success": True, "data": result, "default": default_template}
	except Exception as e:
		frappe.log_error("Tax Fetch Failed", str(e))
		return {"success": False, "error": str(e)}


def get_default_sales_tax_charges():
	pos_doc = get_current_pos_profile()
	return pos_doc.taxes_and_charges
