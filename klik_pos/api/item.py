import frappe
from frappe import _
from erpnext.stock.utils import get_stock_balance
from klik_pos.klik_pos.utils import get_current_pos_profile

def pos_details():
    pos = get_current_pos_profile
    customer = pos.customer
    
    
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
    # limit=1000,
   
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
        pos_profile = get_current_pos_profile()

        formatted_groups = []
        total_item_count = frappe.db.count("Item", filters={"disabled": 0, "is_stock_item": 1})

        # Check if the POS Profile has child item groups
        if pos_profile.item_groups:
            item_group_names = [d.item_group for d in pos_profile.item_groups if d.item_group]

            item_groups = frappe.get_all(
                "Item Group",
                filters={"name": ["in", item_group_names], "is_group": 0},
                fields=["name", "item_group_name", "parent_item_group"],
            )
        else:
            # Fallback: fetch all leaf item groups
            item_groups = frappe.get_all(
                "Item Group",
                filters={"is_group": 0},
                fields=["name", "item_group_name", "parent_item_group"],
                limit=100,
                order_by="modified desc"
            )

        for group in item_groups:
            item_count = frappe.db.count("Item", filters={"item_group": group["name"]})

            formatted_groups.append({
                "id": group["name"],
                "name": group.get("item_group_name") or group["name"],
                "parent": group.get("parent_item_group") or None,
                "icon": "📦",
                "count": item_count,
            })

        return {
            "groups": formatted_groups,
            "total_items": total_item_count
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Item Groups for POS Error")
        frappe.throw(_("Something went wrong while fetching item group data."))

@frappe.whitelist()
def get_batch_nos_with_qty(item_code):
    """
    Returns a list of dicts with batch numbers and their actual quantities
    for a given item code and warehouse.
    """
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    if not item_code or not warehouse:
        return []
    # frappe.throw(str(item_code))
    # Query batches with quantity > 0 from tabBatch and tabBatch Stock (Bin-like)
    batch_qty_data = frappe.db.sql("""
        SELECT
            b.batch_id AS batch_id,
            bs.batch_qty AS qty
        FROM
            `tabBatch` b
        INNER JOIN
            `tabBatch` bs ON bs.batch_id = b.name
        WHERE
            b.item = %(item_code)s
            AND bs.batch_qty > 0
        ORDER BY
            b.batch_id ASC
    """, {
        "item_code": item_code,
        "warehouse": warehouse
    }, as_dict=True)
    return batch_qty_data
