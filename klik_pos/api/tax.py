

import frappe
from frappe import _

from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist(allow_guest=True)
def get_sales_tax_categories():
    try:
        tax_categories = frappe.get_all(
            "Sales Taxes and Charges Template",
            filters={"disabled": 0},
            fields=["name", "title"]
        )

        result = []
        for cat in tax_categories:
            # Get the first tax entry to determine rate and type
            tax_entry = frappe.db.get_value(
                "Sales Taxes and Charges", 
                {"parent": cat.name}, 
                ["rate", "included_in_print_rate"], 
                as_dict=True
            )
            
            tax_rate = tax_entry.get("rate", 0.0) if tax_entry else 0.0
            is_inclusive = tax_entry.get("included_in_print_rate", 0) if tax_entry else 0
            
            result.append({
                "id": cat.name,
                "name": cat.title or cat.name,
                "rate": float(tax_rate),
                "is_inclusive": bool(is_inclusive),
                "type": "inclusive" if is_inclusive else "exclusive"
            })

        default_template = None
        try:
            pos_doc = get_current_pos_profile()
            default_template = pos_doc.taxes_and_charges
        except Exception:
            pass

        return {
            "success": True,
            "data": result,
            "default": default_template
        }
    except Exception as e:
        frappe.log_error("Tax Fetch Failed", str(e))
        return {"success": False, "error": str(e)}


def get_default_sales_tax_charges():
    pos_doc = get_current_pos_profile()
    return pos_doc.taxes_and_charges