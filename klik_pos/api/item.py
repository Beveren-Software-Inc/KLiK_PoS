import frappe
from frappe import _
from erpnext.stock.utils import get_stock_balance
from klik_pos.klik_pos.utils import get_current_pos_profile

def fetch_item_balance(item_code: str, warehouse: str) -> float:
    """Get stock balance of an item from a warehouse."""
    try:
        return get_stock_balance(item_code, warehouse) or 0
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Error fetching balance for {item_code}")
        return 0

def fetch_item_price(item_code: str, price_list: str) -> dict:
    """Get item price from Item Price doctype."""
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
        return {
            "price": price_doc.price_list_rate if price_doc else 0,
            "currency": price_doc.currency if price_doc else "SAR"
        }
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Error fetching price for {item_code}")
        return {
            "price": 0,
            "currency": "SAR"
        }

@frappe.whitelist(allow_guest=True)
def get_items_with_balance_and_price(price_list: str = "Standard Selling"):
    pos_doc = get_current_pos_profile()
    warehouse=pos_doc.warehouse
   
    try:
        items = frappe.get_all(
    "Item",
    filters={"disabled": 0, "is_stock_item": 1},
    fields=["name", "item_name", "description", "item_group", "image"],
    limit=50,
   
    order_by="modified desc"
)
        enriched_items = []
        for item in items:
            balance = fetch_item_balance(item["name"], warehouse)
            price_info = fetch_item_price(item["name"], price_list)

            enriched_items.append({
                "id": item["name"],
                "name": item.get("item_name") or item["name"],
                "description": item.get("description", ""),
                "category": item.get("item_group", "General"),
                "price": price_info["price"],
                "currency": price_info["currency"],
                "available": balance,
                "image": item.get("image") or "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop",
                "sold": 0,
                "preparationTime": 10
            })
        
        return enriched_items

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Combined Item Data Error")
        frappe.throw(_("Something went wrong while fetching item data."))


@frappe.whitelist(allow_guest=True)
def get_item_groups_for_pos():
    try:
        item_groups = frappe.get_all(
            "Item Group",
            filters={"is_group": 0},  
            fields=["name", "item_group_name", "parent_item_group"],
            limit=100,
            order_by="modified desc"
        )

        # Prepare a clean response
        formatted_groups = []
        for group in item_groups:
            formatted_groups.append({
                "id": group["name"],
                "name": group.get("item_group_name") or group["name"],
                "parent": group.get("parent_item_group") or None,
                "icon": "📦", 
                "count": 1
            })

        return formatted_groups

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Item Groups for POS Error")
        frappe.throw(_("Something went wrong while fetching item group data."))
