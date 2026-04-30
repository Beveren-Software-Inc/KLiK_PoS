import frappe
from frappe import _
from klik_pos.klik_pos.utils import get_current_pos_profile
from ..sql_builder import apply_sql_permissions

@frappe.whitelist(allow_guest=True)
def get_item_groups_for_pos():
    try:
        pos_profile = get_current_pos_profile()
        hide_unavailable = pos_profile.get("hide_unavailable_items", 0)
        warehouse = pos_profile.get("warehouse")
        
        formatted_groups = []
        item_group_names = []

        if pos_profile.item_groups:
            item_group_names = [
                d.item_group for d in pos_profile.item_groups if d.item_group
            ]

            item_groups = frappe.get_list(
                "Item Group",
                filters={
                    "name": ["in", item_group_names],
                    "is_group": 0,
                    "exclude_from_pos": 0,
                },
                fields=["name", "item_group_name", "parent_item_group"],
            )
            
        else:
            item_groups = frappe.get_list(
                "Item Group",
                filters={"is_group": 0, "exclude_from_pos": 0},
                fields=["name", "item_group_name", "parent_item_group"],
                limit=100,
                order_by="modified desc",
            )

        for group in item_groups:
            item_count = _get_item_count_with_filters(
                item_group=group["name"],
                hide_unavailable=hide_unavailable,
                warehouse=warehouse
            )
            
            if item_count == 0:
                continue

            formatted_groups.append(
                {
                    "id": group["name"],
                    "name": group.get("item_group_name") or group["name"],
                    "parent": group.get("parent_item_group") or None,
                    "count": item_count,
                }
            )

        return formatted_groups

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Get Item Groups for POS Error {e!s}",
        )
        frappe.throw(_("Something went wrong while fetching item group data."))

def _get_item_count_with_filters(item_group=None, item_groups_list=None, hide_unavailable=False, warehouse=None):
    if hide_unavailable and warehouse:
        if item_group:
            sql_query = """
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND i.item_group = %s
                AND b.actual_qty > 0
                AND b.warehouse = %s
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, (item_group, warehouse), as_dict=True)[0].get("total", 0)
        elif item_groups_list:
            placeholders = ', '.join(['%s'] * len(item_groups_list))
            sql_query = f"""
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND i.item_group IN ({placeholders})
                AND b.actual_qty > 0
                AND b.warehouse = %s
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, item_groups_list + [warehouse], as_dict=True)[0].get("total", 0)
        else:
            sql_query = """
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND b.actual_qty > 0
                AND b.warehouse = %s
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, (warehouse,), as_dict=True)[0].get("total", 0)
            
    elif hide_unavailable:
        if item_group:
            sql_query = """
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND i.item_group = %s
                AND b.actual_qty > 0
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, (item_group,), as_dict=True)[0].get("total", 0)
        elif item_groups_list:
            placeholders = ', '.join(['%s'] * len(item_groups_list))
            sql_query = f"""
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND i.item_group IN ({placeholders})
                AND b.actual_qty > 0
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, item_groups_list, as_dict=True)[0].get("total", 0)
        else:
            sql_query = """
                SELECT COUNT(DISTINCT i.name) as total
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND b.actual_qty > 0
            """
            sql_query = apply_sql_permissions(sql_query)
            count = frappe.db.sql(sql_query, as_dict=True)[0].get("total", 0)
    else:
        filters = {
            "disabled": 0,
            "is_stock_item": 1,
        }
        
        if item_group:
            filters["item_group"] = item_group
        elif item_groups_list:
            filters["item_group"] = ["in", item_groups_list]
            
        count = frappe.db.count("Item", filters=filters)
    
    return count