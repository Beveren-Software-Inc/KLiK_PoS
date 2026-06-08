import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    create_custom_fields(
        {
            "POS Profile": [
                {
                    "fieldname": "allow_price_list_switching",
                    "label": "Allow Price List Switching",
                    "fieldtype": "Check",
                    "insert_after": "allow_zero_rate_sales",
                    "description": "Allow cashiers to switch selling price lists in Klik POS.",
                    "default": "0",
                },
            ]
        },
        update=True,
    )
