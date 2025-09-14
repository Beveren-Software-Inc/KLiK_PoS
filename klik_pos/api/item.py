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
        if price_doc:
            symbol = frappe.db.get_value("Currency", price_doc.currency, "symbol") or price_doc.currency
            return {
                "price": price_doc.price_list_rate,
                "currency": price_doc.currency,
                "currency_symbol": symbol
            }
        else:
            default_currency = "SAR"
            default_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency
            return {
                "price": 0,
                "currency": default_currency,
                "currency_symbol": default_symbol
            }


    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Error fetching price for {item_code}")
        return {
            "price": 0,
            "currency": "SAR"
        }

@frappe.whitelist(allow_guest=True)
def get_item_by_barcode(barcode: str):
    """Get item details by barcode."""
    try:
        pos_doc = get_current_pos_profile()
        warehouse = pos_doc.warehouse
        price_list = "Standard Selling"

        item_code = frappe.db.sql("""
            SELECT parent
            FROM `tabItem Barcode`
            WHERE barcode = %s
        """, barcode, as_dict=True)

        if not item_code:
            item_code = frappe.db.sql("""
                SELECT name
                FROM `tabItem`
                WHERE name = %s AND disabled = 0
            """, barcode, as_dict=True)

        if not item_code:
            frappe.throw(_("Item not found for barcode: {0}").format(barcode))

        item_name = item_code[0].parent or item_code[0].name

        item_doc = frappe.get_doc("Item", item_name)

        balance = fetch_item_balance(item_name, warehouse)
        price_info = fetch_item_price(item_name, price_list)

        return {
            "item_code": item_name,
            "item_name": item_doc.item_name or item_name,
            "description": item_doc.description or "",
            "item_group": item_doc.item_group or "General",
            "price": price_info["price"],
            "currency": price_info["currency"],
            "currency_symbol": price_info["currency_symbol"],
            "available": balance,
            "image": item_doc.image or "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error fetching item by barcode: {barcode}")
        frappe.throw(_("Error fetching item by barcode: {0}").format(str(e)))

@frappe.whitelist(allow_guest=True)
def get_items_with_balance_and_price(price_list: str = "Standard Selling"):
    """
    Get items with balance and price - optimized version with caching support
    """
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    try:
        # If POS Profile has item groups → only use those
        filters = {"disabled": 0, "is_stock_item": 1}
        if pos_doc.item_groups:
            item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
            if item_group_names:
                filters["item_group"] = ["in", item_group_names]

        items = frappe.get_all(
            "Item",
            filters=filters,
            fields=["name", "item_name", "description", "item_group", "image", "stock_uom"],
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
                "currency_symbol": price_info["currency_symbol"],
                "available": balance,
                "image": item.get("image") or "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop",
                "sold": 0,
                "preparationTime": 10,
                "uom": item.get("stock_uom", "Nos")
            })

        return enriched_items

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Get Combined Item Data Error")
        frappe.throw(_("Something went wrong while fetching item data."))



@frappe.whitelist(allow_guest=True)
def get_stock_updates():
    """Get only stock updates for all items - lightweight endpoint for real-time updates."""
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    try:
        # If POS Profile has item groups → only use those
        filters = {"disabled": 0, "is_stock_item": 1}
        if pos_doc.item_groups:
            item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
            if item_group_names:
                filters["item_group"] = ["in", item_group_names]

        # Get only item codes - much faster query
        items = frappe.get_all(
            "Item",
            filters=filters,
            fields=["name"],
            order_by="modified desc"
        )

        # Optimized: Use batch processing with smaller chunks
        stock_updates = {}
        item_codes = [item["name"] for item in items]

        # Process in chunks of 100 to avoid memory issues
        chunk_size = 100
        for i in range(0, len(item_codes), chunk_size):
            chunk = item_codes[i:i + chunk_size]
            for item_code in chunk:
                try:
                    balance = get_stock_balance(item_code, warehouse) or 0
                    stock_updates[item_code] = balance
                except Exception:
                    stock_updates[item_code] = 0

        return stock_updates

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Get Stock Updates Error")
        return {}

@frappe.whitelist(allow_guest=True)
def get_item_stock(item_code: str):
    """Get stock for a specific item - for individual updates."""
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    try:
        balance = fetch_item_balance(item_code, warehouse)
        return {"item_code": item_code, "available": balance}
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Get Item Stock Error for {item_code}")
        return {"item_code": item_code, "available": 0}

@frappe.whitelist(allow_guest=True)
def get_items_stock_batch(item_codes: str):
    """Get stock for multiple specific items - optimized batch update."""
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    try:
        # Parse the comma-separated item codes
        item_codes_list = [code.strip() for code in item_codes.split(',') if code.strip()]

        stock_updates = {}
        for item_code in item_codes_list:
            balance = fetch_item_balance(item_code, warehouse)
            stock_updates[item_code] = balance

        return stock_updates
    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Get Items Stock Batch Error for {item_codes}")
        return {}

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


import random
import string

@frappe.whitelist()
def create_random_items():
    created = 0
    for i in range(500):
        item_code = "ITM-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        item_name = "Random Item " + str(i+1)

        item = frappe.get_doc({
            "doctype": "Item",
            "item_code": item_code,
            "item_name": item_name,
            "item_group": "All Item Groups",   # make sure exists
            "stock_uom": "Nos",               # make sure exists
            "is_stock_item": 1,
        })

        try:
            item.insert(ignore_permissions=True)
            created += 1
        except Exception as e:
            frappe.log_error(f"Error creating item {item_code}: {str(e)}")

    frappe.db.commit()
    return f"{created} random items created successfully!"
