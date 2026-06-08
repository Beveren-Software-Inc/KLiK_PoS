import frappe
from frappe import _
from frappe.utils import flt

from erpnext.stock.utils import get_stock_balance

from klik_pos.api.sales_invoice import (
    get_current_pos_opening_entry,
    get_reserved_qty_for_item_warehouse,
    get_reserved_stock_map,
)
from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions


def fetch_item_balance(item_code, warehouse):
    try:
        actual_qty = flt(get_stock_balance(item_code, warehouse))
        reserved_qty = get_reserved_qty_for_item_warehouse(item_code, warehouse)
        return flt(actual_qty - reserved_qty)
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error fetching balance for {item_code}",
        )
        return 0.0


def apply_queue_reservations_to_stock_map(stock_map, warehouse):
    """Subtract queued invoice reservations from raw stock map values."""
    if not stock_map or not warehouse:
        return stock_map

    reserved_map = get_reserved_stock_map(
        item_codes=list(stock_map.keys()),
        warehouse=warehouse,
    )

    for item_code in stock_map:
        reserved_qty = flt(reserved_map.get((item_code, warehouse), 0))
        stock_map[item_code] = flt(stock_map.get(item_code, 0) - reserved_qty)

    return stock_map


@frappe.whitelist(allow_guest=True)
def get_stock_updates():
    pos_doc = None

    try:
        current_opening = get_current_pos_opening_entry()

        if current_opening:
            opening_doc = frappe.get_list(
                "POS Opening Entry",
                filters={"name": current_opening},
                fields=["pos_profile"],
                limit=1,
            )

            if opening_doc:
                pos_doc = frappe.get_list(
                    "POS Profile",
                    filters={"name": opening_doc[0].pos_profile},
                    fields=["name", "warehouse", "hide_unavailable_items"],
                    limit=1,
                )

                if pos_doc:
                    pos_doc = pos_doc[0]
                    pos_doc.item_groups = frappe.get_list(
                        "POS Item Group",
                        filters={"parent": pos_doc.name},
                        fields=["item_group"],
                    )

    except Exception:
        pos_doc = None

    if not pos_doc:
        pos_doc = get_current_pos_profile()

    warehouse = pos_doc.warehouse
    hide_unavailable = pos_doc.get("hide_unavailable_items")

    try:
        if hide_unavailable:
            query = """
                SELECT DISTINCT i.name
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND IFNULL(i.is_sales_item, 1) = 1
                AND i.is_stock_item = 1
                AND b.warehouse = %s
                AND b.actual_qty > 0
            """

            params = [warehouse]

            if pos_doc.get("item_groups"):
                groups = [
                    d.item_group
                    for d in pos_doc.item_groups
                    if d.item_group
                ]

                if groups:
                    placeholders = ", ".join(["%s"] * len(groups))
                    query += f" AND i.item_group IN ({placeholders})"
                    params.extend(groups)

            query += " ORDER BY i.modified DESC"
            query = apply_sql_permissions(query)

            items = frappe.db.sql(
                query,
                tuple(params),
                as_dict=True,
            )

            item_codes = [item["name"] for item in items]

        else:
            filters = {"disabled": 0, "is_stock_item": 1, "is_sales_item": 1}

            if pos_doc.get("item_groups"):
                groups = [
                    d.item_group
                    for d in pos_doc.item_groups
                    if d.item_group
                ]

                if groups:
                    filters["item_group"] = ["in", groups]

            items = frappe.get_list(
                "Item",
                filters=filters,
                fields=["name"],
                order_by="modified desc",
            )

            item_codes = [item.name for item in items]

        return _fetch_batch_stock(item_codes, warehouse)

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Get Stock Updates Error",
        )
        return {}


@frappe.whitelist(allow_guest=True)
def get_item_stock(item_code):
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    try:
        balance = fetch_item_balance(item_code, warehouse)

        return {
            "item_code": item_code,
            "available": balance,
        }

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Get Item Stock Error for {item_code}",
        )
        return {
            "item_code": item_code,
            "available": 0.0,
        }


@frappe.whitelist(allow_guest=True)
def get_items_stock_batch(item_codes):
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse
    hide_unavailable = pos_doc.get("hide_unavailable_items")

    try:
        item_codes_list = [
            code.strip()
            for code in item_codes.split(",")
            if code.strip()
        ]

        all_stock = _fetch_batch_stock(item_codes_list, warehouse)

        if hide_unavailable:
            return {k: v for k, v in all_stock.items() if v > 0}

        return all_stock

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Get Items Stock Batch Error for {item_codes}",
        )
        return {}


def _fetch_batch_stock(item_codes, warehouse):
    if not item_codes or not warehouse:
        return {}

    stock_map = {code: 0.0 for code in item_codes}

    try:
        placeholders = ", ".join(["%s"] * len(item_codes))

        query = f"""
            SELECT b.item_code, b.actual_qty
            FROM `tabBin` b
            WHERE b.item_code IN ({placeholders})
            AND b.warehouse = %s
        """
        query = apply_sql_permissions(query)

        results = frappe.db.sql(
            query,
            (*item_codes, warehouse),
            as_dict=True,
        )

        for row in results:
            stock_map[row["item_code"]] = flt(row["actual_qty"])

        apply_queue_reservations_to_stock_map(stock_map, warehouse)

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Batch stock fetch error",
        )

        for item_code in item_codes:
            stock_map[item_code] = fetch_item_balance(
                item_code,
                warehouse,
            )

    return stock_map