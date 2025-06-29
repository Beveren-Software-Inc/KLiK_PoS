import frappe

from erpnext.stock.utils import get_stock_balance

@frappe.whitelist(allow_guest=True)
def get_item_balance(item_code: str, warehouse: str):
    if not item_code or not warehouse:
        frappe.throw("Both Item Code and Warehouse are required")

    try:
        balance = get_stock_balance(item_code, warehouse)
        return {
            "item_code": item_code,
            "warehouse": warehouse,
            "balance": balance
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Item Balance Error")
        frappe.throw(f"Error getting stock balance: {e}")
        
        
@frappe.whitelist(allow_guest=True)
def get_item_price(item_code: str, price_list: str = "Standard Selling"):
    if not item_code:
        frappe.throw("Item Code is required")

    try:
        price_doc = frappe.get_value(
            "Item Price",
            {
                "item_code": item_code,
                "price_list": price_list,
                "selling": 1,
            },
            ["price_list_rate", "currency"],
            as_dict=True
        )

        if not price_doc:
            return {
                "item_code": item_code,
                "price_list": price_list,
                "price": None,
                "currency": None,
                "message": "No price found for this item"
            }

        return {
            "item_code": item_code,
            "price_list": price_list,
            "price": price_doc.price_list_rate,
            "currency": price_doc.currency
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Item Price Error")
        frappe.throw(f"Error getting item price: {e}")

