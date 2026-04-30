import frappe
from frappe import _

from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions
from .item_price import fetch_item_price
from .item_stock import fetch_item_balance


@frappe.whitelist(allow_guest=True)
def get_item_by_barcode(barcode: str):
    try:
        pos_doc = get_current_pos_profile()
        warehouse = pos_doc.warehouse
        price_list = pos_doc.selling_price_list

        item_sql = """
            SELECT parent
            FROM `tabItem Barcode`
            WHERE barcode = %s
        """
        item_sql = apply_sql_permissions(item_sql)

        item_res = frappe.db.sql(
            item_sql,
            (barcode,),
            as_dict=True,
        )

        item_code = None

        if item_res:
            item_code = item_res[0].parent
        else:
            fallback_sql = """
                SELECT name
                FROM `tabItem`
                WHERE name = %s AND disabled = 0
            """
            fallback_sql = apply_sql_permissions(fallback_sql)

            fallback_res = frappe.db.sql(
                fallback_sql,
                (barcode,),
                as_dict=True,
            )

            if fallback_res:
                item_code = fallback_res[0].name

        if not item_code:
            frappe.throw(
                _("Item not found for barcode: {0}").format(barcode)
            )

        item_list = frappe.get_list(
            "Item",
            filters={"name": item_code},
            fields=["item_name", "description", "item_group", "image"],
            limit=1,
        )

        if not item_list:
            frappe.throw(
                _("Item details not found for: {0}").format(item_code)
            )

        item_data = item_list[0]

        balance = fetch_item_balance(item_code, warehouse)

        price_info = fetch_item_price(
            item_code,
            price_list=price_list,
        )

        return {
            "item_code": item_code,
            "item_name": item_data.item_name or item_code,
            "description": item_data.description or "",
            "item_group": item_data.item_group or "General",
            "price": price_info["price"],
            "currency": price_info["currency"],
            "currency_symbol": price_info["currency_symbol"],
            "available": balance,
            "image": item_data.image,
        }

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error fetching item by barcode: {barcode}",
        )
        frappe.throw(
            _("Error fetching item by barcode: {0}").format(str(e))
        )


@frappe.whitelist(allow_guest=True)
def get_item_by_identifier(code: str):
    try:
        if not code:
            frappe.throw(_("Identifier required"))

        pos_doc = get_current_pos_profile()
        warehouse = pos_doc.warehouse
        price_list = pos_doc.selling_price_list

        matched_type = None
        matched_value = None
        item_code = None

        barcode_sql = """
            SELECT parent AS item_code
            FROM `tabItem Barcode`
            WHERE barcode = %s
        """
        barcode_sql = apply_sql_permissions(barcode_sql)

        barcode_res = frappe.db.sql(
            barcode_sql,
            (code,),
            as_dict=True,
        )

        if barcode_res:
            item_code = barcode_res[0].item_code
            matched_type = "barcode"
            matched_value = code

        if not item_code:
            batch_sql = """
                SELECT item AS item_code
                FROM `tabBatch`
                WHERE batch_id = %s OR name = %s
            """
            batch_sql = apply_sql_permissions(batch_sql)

            batch_res = frappe.db.sql(
                batch_sql,
                (code, code),
                as_dict=True,
            )

            if batch_res:
                item_code = batch_res[0].item_code
                matched_type = "batch"
                matched_value = code

        if not item_code:
            serial_sql = """
                SELECT item_code
                FROM `tabSerial No`
                WHERE name = %s OR serial_no = %s
            """
            serial_sql = apply_sql_permissions(serial_sql)

            serial_res = frappe.db.sql(
                serial_sql,
                (code, code),
                as_dict=True,
            )

            if serial_res:
                item_code = serial_res[0].item_code
                matched_type = "serial"
                matched_value = code

        if not item_code:
            frappe.throw(
                _("Item not found for identifier: {0}").format(code)
            )

        item_list = frappe.get_list(
            "Item",
            filters={"name": item_code},
            fields=["item_name", "description", "item_group", "image"],
            limit=1,
        )

        if not item_list:
            frappe.throw(
                _("Item details not found for: {0}").format(item_code)
            )

        item_data = item_list[0]

        balance = fetch_item_balance(item_code, warehouse)

        price_info = fetch_item_price(
            item_code,
            price_list=price_list,
        )

        return {
            "item_code": item_code,
            "item_name": item_data.item_name or item_code,
            "description": item_data.description or "",
            "item_group": item_data.item_group or "General",
            "price": price_info["price"],
            "currency": price_info["currency"],
            "currency_symbol": price_info["currency_symbol"],
            "available": balance,
            "image": item_data.image,
            "matched_type": matched_type,
            "matched_value": matched_value,
        }

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error fetching item by identifier: {code}",
        )
        frappe.throw(
            _("Error fetching item by identifier: {0}").format(str(e))
        )