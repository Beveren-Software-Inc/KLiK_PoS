import frappe
from frappe import _
from frappe.utils import cint

from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions
from .item_price import fetch_item_price
from .item_stock import fetch_item_balance
from .item_listing import _fetch_product_bundle_map


def _include_service_items(pos_doc):
    return cint(getattr(pos_doc, "custom_enable_service_items", 0) or 0) == 1


def _validate_item_sales_eligibility(item_data, include_service_items):
    if not item_data:
        frappe.throw(_("Item details not found"))

    if cint(item_data.get("disabled") or 0) == 1:
        frappe.throw(_("Item is disabled."))

    if cint(item_data.get("is_sales_item") or 0) == 0:
        frappe.throw(_("Item is not allowed in sales."))

    is_stock_item = cint(item_data.get("is_stock_item") or 0) == 1
    is_product_bundle = cint(item_data.get("is_product_bundle") or 0) == 1
    is_variant_template = cint(item_data.get("has_variants") or 0) == 1
    if not is_stock_item and not is_product_bundle and not is_variant_template and not include_service_items:
        frappe.throw(_("Service items are disabled for this POS Profile."))

    return is_stock_item


@frappe.whitelist(allow_guest=True)
def get_item_by_barcode(barcode: str):
    try:
        pos_doc = get_current_pos_profile()
        warehouse = pos_doc.warehouse
        price_list = pos_doc.selling_price_list
        include_service_items = _include_service_items(pos_doc)

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

        item_data = frappe.db.get_value(
            "Item",
            item_code,
            ["item_name", "description", "item_group", "image", "disabled", "is_sales_item", "is_stock_item", "has_variants", "variant_of", "variant_based_on"],
            as_dict=True,
        )

        if not item_data:
            frappe.throw(
                _("Item details not found for: {0}").format(item_code)
            )

        item_data["is_product_bundle"] = 1 if frappe.db.exists("Product Bundle", {"new_item_code": item_code, "disabled": 0}) else 0
        is_product_bundle = cint(item_data.get("is_product_bundle") or 0) == 1
        is_variant_template = cint(item_data.get("has_variants") or 0) == 1
        is_stock_item = _validate_item_sales_eligibility(item_data, include_service_items)

        balance = fetch_item_balance(item_code, warehouse) if is_stock_item else 0
        bundle_items = _fetch_product_bundle_map([item_code], warehouse).get(item_code, []) if is_product_bundle else []
        if is_product_bundle:
            stock_component_limits = [
                int(component.get("available_bundle_qty") or 0)
                for component in bundle_items
                if component.get("is_stock_item")
            ]
            balance = min(stock_component_limits) if stock_component_limits else 0

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
            "is_stock_item": False if is_variant_template else True if is_product_bundle else is_stock_item,
            "is_product_bundle": is_product_bundle,
            "bundle_items": bundle_items,
            "is_variant_template": is_variant_template,
            "has_variants": is_variant_template,
            "variant_of": item_data.get("variant_of"),
            "variant_based_on": item_data.get("variant_based_on"),
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
        include_service_items = _include_service_items(pos_doc)

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

        item_data = frappe.db.get_value(
            "Item",
            item_code,
            ["item_name", "description", "item_group", "image", "disabled", "is_sales_item", "is_stock_item", "has_variants", "variant_of", "variant_based_on"],
            as_dict=True,
        )

        if not item_data:
            frappe.throw(
                _("Item details not found for: {0}").format(item_code)
            )

        item_data["is_product_bundle"] = 1 if frappe.db.exists("Product Bundle", {"new_item_code": item_code, "disabled": 0}) else 0
        is_product_bundle = cint(item_data.get("is_product_bundle") or 0) == 1
        is_variant_template = cint(item_data.get("has_variants") or 0) == 1
        is_stock_item = _validate_item_sales_eligibility(item_data, include_service_items)

        balance = fetch_item_balance(item_code, warehouse) if is_stock_item else 0
        bundle_items = _fetch_product_bundle_map([item_code], warehouse).get(item_code, []) if is_product_bundle else []
        if is_product_bundle:
            stock_component_limits = [
                int(component.get("available_bundle_qty") or 0)
                for component in bundle_items
                if component.get("is_stock_item")
            ]
            balance = min(stock_component_limits) if stock_component_limits else 0

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
            "is_stock_item": False if is_variant_template else True if is_product_bundle else is_stock_item,
            "is_product_bundle": is_product_bundle,
            "bundle_items": bundle_items,
            "is_variant_template": is_variant_template,
            "has_variants": is_variant_template,
            "variant_of": item_data.get("variant_of"),
            "variant_based_on": item_data.get("variant_based_on"),
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
