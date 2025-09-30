import frappe
from frappe import _
import random
import string
from erpnext.stock.utils import get_stock_balance
from klik_pos.klik_pos.utils import get_current_pos_profile
from erpnext.stock.doctype.batch.batch import get_batch_qty


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

    """Get item price from Item Price doctype. If price_list is null, get latest price without price_list filter."""
    try:
        # If price_list is null or empty, get latest price without price_list filter
        if not price_list or price_list.strip() == "":
            price_doc = frappe.get_value(
                "Item Price",
                {
                    "item_code": item_code,
                    "selling": 1,
                },
                ["price_list_rate", "currency"],
                as_dict=True,
                order_by="modified desc"
            )

            if price_doc:
                symbol = frappe.db.get_value("Currency", price_doc.currency, "symbol") or price_doc.currency
                return {
                    "price": price_doc.price_list_rate,
                    "currency": price_doc.currency,
                    "currency_symbol": symbol
                }
            else:
                # Fallback to item's default price if no price found
                item_doc = frappe.get_doc("Item", item_code)
                default_currency = frappe.get_value("Company", frappe.defaults.get_user_default("Company"), "default_currency") or "SAR"
                default_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency

                return {
                    "price": item_doc.valuation_rate or 0,
                    "currency": default_currency,
                    "currency_symbol": default_symbol
                }

        # Normal price list lookup
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
            # Fallback to item's default price if no price list entry found
            item_doc = frappe.get_doc("Item", item_code)
            default_currency = frappe.get_value("Company", frappe.defaults.get_user_default("Company"), "default_currency") or "SAR"
            default_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency
            return {
                "price": item_doc.valuation_rate or 0,
                "currency": default_currency,
                "currency_symbol": default_symbol
            }

    except Exception:
        frappe.log_error(frappe.get_traceback(), f"Error fetching price for {item_code}")
        return {
            "price": 0,
            "currency": "SAR",
            "currency_symbol": "SAR"
        }

@frappe.whitelist(allow_guest=True)
def get_item_by_barcode(barcode: str):
    """Get item details by barcode."""
    try:
        pos_doc = get_current_pos_profile()
        warehouse = pos_doc.warehouse
        price_list = pos_doc.selling_price_list

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
            "image": item_doc.image
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error fetching item by barcode: {barcode}")
        frappe.throw(_("Error fetching item by barcode: {0}").format(str(e)))

@frappe.whitelist(allow_guest=True)
def get_items_with_balance_and_price():
    """
    Get items with balance and price - optimized with early filtering for unavailable items
    """
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse
    price_list = pos_doc.selling_price_list
    hide_unavailable = getattr(pos_doc, 'hide_unavailable_items', False)

    try:
        # Build base query with early stock filtering if hide_unavailable is enabled
        if hide_unavailable:
            # Use SQL join to filter out unavailable items early
            base_query = """
                SELECT DISTINCT i.name, i.item_name, i.description, i.item_group, i.image, i.stock_uom
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND b.warehouse = %(warehouse)s
                AND b.actual_qty > 0
            """

            # Add item group filter if specified in POS profile
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    placeholders = ', '.join(['%s'] * len(item_group_names))
                    base_query += f" AND i.item_group IN ({placeholders})"

            base_query += " ORDER BY i.modified DESC"

            # Execute query with parameters
            params = {'warehouse': warehouse}
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    params.update({f'group_{i}': group for i, group in enumerate(item_group_names)})

            items = frappe.db.sql(base_query, params, as_dict=True)
        else:
            # Original logic for when hide_unavailable is disabled
            # Use SQL to get items with barcode information
            base_query = """
                SELECT DISTINCT i.name, i.item_name, i.description, i.item_group, i.image, i.stock_uom
                FROM `tabItem` i
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
            """

            # Add item group filter if specified in POS profile
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    placeholders = ', '.join(['%s'] * len(item_group_names))
                    base_query += f" AND i.item_group IN ({placeholders})"

            base_query += " ORDER BY i.modified DESC"

            # Execute query with parameters
            params = {}
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    params.update({f'group_{i}': group for i, group in enumerate(item_group_names)})

            items = frappe.db.sql(base_query, params, as_dict=True)

        # Get barcodes for all items in a separate query
        item_codes = [item["name"] for item in items]
        barcode_map = {}
        if item_codes:
            barcode_results = frappe.db.sql("""
                SELECT parent, barcode
                FROM `tabItem Barcode`
                WHERE parent IN %s
            """, (item_codes,), as_dict=True)

            for barcode_row in barcode_results:
                item_code = barcode_row["parent"]
                if item_code not in barcode_map:
                    barcode_map[item_code] = barcode_row["barcode"]  # Get first barcode

        enriched_items = []
        for item in items:
            # Get balance (already filtered if hide_unavailable is True)
            balance = fetch_item_balance(item["name"], warehouse)

            # Skip items with no stock if hide_unavailable is enabled
            if hide_unavailable and balance <= 0:
                continue

            # Get price info only for available items
            price_info = fetch_item_price(item["name"], price_list)

            # Get barcode from the map
            primary_barcode = barcode_map.get(item["name"])

            enriched_items.append({
                "id": item["name"],
                "name": item.get("item_name") or item["name"],
                "description": item.get("description", ""),
                "category": item.get("item_group", "General"),
                "price": price_info["price"],
                "currency": price_info["currency"],
                "currency_symbol": price_info["currency_symbol"],
                "available": balance,
                "image": item.get("image"),
                "sold": 0,
                "preparationTime": 10,
                "uom": item.get("stock_uom", "Nos"),
                "barcode": primary_barcode
            })
        return enriched_items

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Get Combined Item Data Error")
        frappe.throw(_("Something went wrong while fetching item data."))



@frappe.whitelist(allow_guest=True)
def get_stock_updates():
    """Get only stock updates for all items - lightweight endpoint with early filtering."""
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse
    hide_unavailable = getattr(pos_doc, 'hide_unavailable_items', False)

    try:
        if hide_unavailable:
            # Use SQL to get only items with stock > 0
            base_query = """
                SELECT DISTINCT i.name
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND b.warehouse = %(warehouse)s
                AND b.actual_qty > 0
            """

            # Add item group filter if specified in POS profile
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    placeholders = ', '.join(['%s'] * len(item_group_names))
                    base_query += f" AND i.item_group IN ({placeholders})"

            base_query += " ORDER BY i.modified DESC"

            # Execute query
            params = {'warehouse': warehouse}
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    params.update({f'group_{i}': group for i, group in enumerate(item_group_names)})

            items = frappe.db.sql(base_query, params, as_dict=True)
            item_codes = [item["name"] for item in items]
        else:
            # Original logic for when hide_unavailable is disabled
            filters = {"disabled": 0, "is_stock_item": 1}
            if pos_doc.item_groups:
                item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
                if item_group_names:
                    filters["item_group"] = ["in", item_group_names]

            items = frappe.get_all(
                "Item",
                filters=filters,
                fields=["name"],
                order_by="modified desc"
            )
            item_codes = [item["name"] for item in items]

        # Optimized: Use batch processing with smaller chunks
        stock_updates = {}

        # Process in chunks of 100 to avoid memory issues
        chunk_size = 100
        for i in range(0, len(item_codes), chunk_size):
            chunk = item_codes[i:i + chunk_size]
            for item_code in chunk:
                try:
                    balance = get_stock_balance(item_code, warehouse) or 0
                    # Only include items with stock if hide_unavailable is enabled
                    if not hide_unavailable or balance > 0:
                        stock_updates[item_code] = balance
                except Exception:
                    if not hide_unavailable:
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
    """Get stock for multiple specific items - optimized batch update with early filtering."""
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse
    hide_unavailable = getattr(pos_doc, 'hide_unavailable_items', False)

    try:
        # Parse the comma-separated item codes
        item_codes_list = [code.strip() for code in item_codes.split(',') if code.strip()]

        stock_updates = {}
        for item_code in item_codes_list:
            balance = fetch_item_balance(item_code, warehouse)
            # Only include items with stock if hide_unavailable is enabled
            if not hide_unavailable or balance > 0:
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
                fields=["name", "item_group_name"],
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

    # Get all batches for the item
    batches = frappe.get_all("Batch",
        filters={"item": item_code},
        fields=["name", "batch_id", "expiry_date"]
    )

    batch_qty_data = []
    for b in batches:
        qty = get_batch_qty(batch_no=b.name, warehouse=warehouse)
        if qty > 0:
            batch_qty_data.append({
                "batch_id": b.batch_id,
                "qty": qty
            })

    return batch_qty_data


@frappe.whitelist()
def get_item_uoms_and_prices(item_code):
    """
    Returns a list of UOMs and their prices for a given item code.
    Returns UOMs from Item UOM table and prices from Item Price doctype.
    """
    if not item_code:
        return {}

    try:
        # Get item document to check base UOM and conversion rates
        item_doc = frappe.get_doc("Item", item_code)

        # Get all UOMs for this item from Item UOM child table
        uom_data = []

        # Add base UOM
        uom_data.append({
            "uom": item_doc.stock_uom,
            "conversion_factor": 1.0,
            "price": 0.0
        })

        # Add additional UOMs from Item UOM child table
        for uom_row in item_doc.get("uoms", []):
            uom_data.append({
                "uom": uom_row.uom,
                "conversion_factor": uom_row.conversion_factor,
                "price": 0.0
            })

        # Get prices for each UOM from Item Price doctype
        for uom_info in uom_data:
            price_list_rate = frappe.db.get_value(
                "Item Price",
                {
                    "item_code": item_code,
                    "uom": uom_info["uom"],
                    "selling": 1
                },
                "price_list_rate"
            )

            if price_list_rate:
                uom_info["price"] = float(price_list_rate)
            else:
                # If no specific price found for this UOM, calculate from base price using conversion factor
                base_price = frappe.db.get_value(
                    "Item Price",
                    {
                        "item_code": item_code,
                        "uom": item_doc.stock_uom,
                        "selling": 1
                    },
                    "price_list_rate"
                )

                if base_price:
                    # Convert price based on UOM conversion factor
                    converted_price = float(base_price) * uom_info["conversion_factor"]
                    uom_info["price"] = converted_price
                else:
                    # Use valuation rate if no price list rate found
                    valuation_rate = frappe.db.get_value("Item", item_code, "valuation_rate") or 0
                    converted_price = float(valuation_rate) * uom_info["conversion_factor"]
                    uom_info["price"] = converted_price

        return {
            "base_uom": item_doc.stock_uom,
            "uoms": uom_data
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Get Item UOMs Error for {item_code}")
        return {"base_uom": "Nos", "uoms": [{"uom": "Nos", "conversion_factor": 1.0, "price": 0.0}]}


# @frappe.whitelist()
# def create_random_items():
#     created = 0
#     for i in range(500):
#         item_code = "ITM-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
#         item_name = "Random Item " + str(i+1)

#         item = frappe.get_doc({
#             "doctype": "Item",
#             "item_code": item_code,
#             "item_name": item_name,
#             "item_group": "All Item Groups",
#             "stock_uom": "Nos",
#             "is_stock_item": 1,
#         })

#         try:
#             item.insert(ignore_permissions=True)
#             created += 1
#         except Exception as e:
#             frappe.log_error(f"Error creating item {item_code}: {str(e)}")

#     frappe.db.commit()
#     return f"{created} random items created successfully!"
