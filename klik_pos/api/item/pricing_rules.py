import json
import traceback

import frappe
from frappe import _
from frappe.utils import flt

from erpnext.accounts.doctype.pricing_rule.pricing_rule import apply_pricing_rule

from klik_pos.klik_pos.utils import get_current_pos_profile

from .item_price import (
    fetch_item_price,
    _get_uom_conversion_factor,
    get_price_list_with_customer_priority,
)
from ..sql_builder import apply_sql_permissions


@frappe.whitelist(allow_guest=True)
def apply_pricing_rules_to_cart(cart_items, customer=None):
    try:
        cart_items = _parse_cart_items(cart_items)
        if not cart_items:
            return []

        context = _build_pricing_context(customer)
        erpnext_items = _prepare_erpnext_items(cart_items, context)

        if not erpnext_items:
            return []

        pricing_results = _apply_pricing_rules(erpnext_items, context)
        return _process_pricing_results(pricing_results, erpnext_items, cart_items, context)

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error applying pricing rules to cart: {e!s}",
        )
        return cart_items


def _parse_cart_items(cart_items):
    if isinstance(cart_items, str):
        return json.loads(cart_items)
    return cart_items


def _build_pricing_context(customer=None):
    pos_profile = get_current_pos_profile()
    company = pos_profile.company if pos_profile else frappe.defaults.get_user_default("Company")
    resolved_price_list = get_price_list_with_customer_priority(customer)

    context = {
        "pos_profile": pos_profile,
        "company": company,
        "warehouse": pos_profile.warehouse if pos_profile else None,
        "price_list": resolved_price_list,
        "currency": frappe.get_cached_value("Company", company, "default_currency") or "KES",
        "customer": customer,
        "customer_group": None,
        "territory": None,
    }

    if customer:
        customer_doc = frappe.get_list(
            "Customer",
            filters={"name": customer},
            fields=["customer_group", "territory"],
            limit=1,
        )
        if customer_doc:
            context["customer_group"] = customer_doc[0].customer_group
            context["territory"] = customer_doc[0].territory

    return context


def _prepare_erpnext_items(cart_items, context):
    erpnext_items = []

    for item in cart_items:
        item_code = item.get("id") or item.get("item_code")
        if not item_code:
            continue

        item_data = frappe.get_list(
            "Item",
            filters={"name": item_code},
            fields=["item_group", "brand", "stock_uom"],
            limit=1,
        )
        if not item_data:
            continue

        item_data = item_data[0]
        item_uom = item.get("uom") or item_data.stock_uom
        price_list = context.get("price_list")

        direct_price_sql = """
            SELECT price_list_rate
            FROM `tabItem Price`
            WHERE item_code = %s AND uom = %s AND selling = 1
            AND (price_list = %s OR %s IS NULL)
            ORDER BY modified DESC LIMIT 1
        """
        direct_price_sql = apply_sql_permissions(direct_price_sql)

        direct_price = frappe.db.sql(
            direct_price_sql,
            (item_code, item_uom, price_list, price_list),
        )

        if direct_price:
            base_price = float(direct_price[0][0])
        else:
            base_price_info = fetch_item_price(
                item_code,
                price_list=price_list,
                customer=context.get("customer"),
                uom=item_data.stock_uom,
            )
            base_uom_price = base_price_info.get("price", 0) or item.get("price", 0)

            if item_uom != item_data.stock_uom:
                conv = _get_uom_conversion_factor(item_code, item_uom)
                base_price = float(base_uom_price) * conv if conv else base_uom_price
            else:
                base_price = base_uom_price

        if base_price <= 0:
            base_price = item.get("price", 0)

        item_qty = item.get("quantity", 1)
        conversion_factor = 1.0

        if item_uom != item_data.stock_uom:
            conv = _get_uom_conversion_factor(item_code, item_uom)
            if conv:
                conversion_factor = conv

        erpnext_items.append(
            {
                "doctype": "Sales Invoice Item",
                "name": "",
                "item_code": item_code,
                "item_group": item_data.item_group,
                "brand": item_data.brand or "",
                "qty": item_qty,
                "stock_qty": item_qty * conversion_factor,
                "price_list_rate": base_price,
                "uom": item_uom,
                "conversion_factor": conversion_factor,
            }
        )

    return erpnext_items


def _apply_pricing_rules(erpnext_items, context):
    args = frappe._dict(
        {
            "items": erpnext_items,
            "company": context["company"],
            "currency": context["currency"],
            "transaction_date": frappe.utils.today(),
            "transaction_type": "selling",
            "conversion_rate": 1.0,
            "plc_conversion_rate": 1.0,
            "customer": context.get("customer"),
            "customer_group": context.get("customer_group"),
            "territory": context.get("territory"),
            "price_list": context.get("price_list"),
            "warehouse": context.get("warehouse"),
        }
    )

    try:
        return apply_pricing_rule(args, doc=None)
    except Exception:
        frappe.log_error(
            f"Error in apply_pricing_rule: {traceback.format_exc()}",
            "Pricing Rule Error",
        )
        return []


def _process_pricing_results(pricing_results, erpnext_items, cart_items, context):
    result_items = []
    cart_item_map = {
        (c.get("id") or c.get("item_code")): c
        for c in cart_items
        if (c.get("id") or c.get("item_code"))
    }

    for idx, pricing_result in enumerate(pricing_results):
        if idx >= len(erpnext_items):
            continue

        erpnext_item = erpnext_items[idx]
        item_code = erpnext_item.get("item_code")
        cart_item = cart_item_map.get(item_code)

        if not cart_item:
            continue

        if not bool(pricing_result.get("pricing_rules") and pricing_result.get("has_pricing_rule")):
            result_items.extend(
                _handle_no_pricing_rule(erpnext_item, [cart_item], context)
            )
        else:
            result_items.append(
                _calculate_discounted_price(cart_item, pricing_result, context)
            )

    processed_codes = {
        (item.get("id") or item.get("item_code"))
        for item in result_items
    }

    for cart_item in cart_items:
        code = cart_item.get("id") or cart_item.get("item_code")
        if code and code not in processed_codes:
            result_items.append(cart_item)

    return result_items


def _handle_no_pricing_rule(erpnext_item, cart_items, context):
    item_code = erpnext_item.get("item_code")
    results = []

    for cart_item in cart_items:
        code = cart_item.get("id") or cart_item.get("item_code")
        if code != item_code:
            continue

        item_uom = cart_item.get("uom")
        price_list = context.get("price_list")

        direct_price_sql = """
            SELECT price_list_rate
            FROM `tabItem Price`
            WHERE item_code = %s AND uom = %s AND selling = 1
            AND (price_list = %s OR %s IS NULL)
            ORDER BY modified DESC LIMIT 1
        """
        direct_price_sql = apply_sql_permissions(direct_price_sql)

        direct_price = frappe.db.sql(
            direct_price_sql,
            (code, item_uom, price_list, price_list),
        )

        if direct_price:
            original_price = float(direct_price[0][0])
        else:
            original_price = cart_item.get("price", 0)

        results.append(
            {
                **cart_item,
                "price": original_price,
                "original_price": original_price,
            }
        )

    return results


def _calculate_discounted_price(cart_item, pricing_result, context):
    item_code = cart_item.get("id") or cart_item.get("item_code")
    item_uom = cart_item.get("uom")
    price_list = context.get("price_list")

    direct_price_sql = """
        SELECT price_list_rate
        FROM `tabItem Price`
        WHERE item_code = %s AND uom = %s AND selling = 1
        AND (price_list = %s OR %s IS NULL)
        ORDER BY modified DESC LIMIT 1
    """
    direct_price_sql = apply_sql_permissions(direct_price_sql)

    direct_price = frappe.db.sql(
        direct_price_sql,
        (item_code, item_uom, price_list, price_list),
    )

    original_price = float(direct_price[0][0]) if direct_price else cart_item.get("price", 0)

    pricing_result_rate = pricing_result.get("price_list_rate")
    discount_percentage = pricing_result.get("discount_percentage", 0) or 0
    discount_amount = pricing_result.get("discount_amount", 0) or 0

    if pricing_result_rate is not None and original_price > 0:
        if (
            abs(pricing_result_rate - original_price)
            / max(pricing_result_rate, original_price)
        ) > 0.5:
            if pricing_result_rate < original_price:
                effective_discount = (
                    discount_percentage
                    or ((original_price - pricing_result_rate) / original_price) * 100
                )
                final_price = (
                    original_price * (1 - effective_discount / 100)
                    if effective_discount > 0
                    else (original_price - discount_amount)
                )
            else:
                final_price = (
                    original_price * (1 - discount_percentage / 100)
                    if discount_percentage > 0
                    else (original_price - discount_amount)
                )

            return {
                **cart_item,
                "price": final_price,
                "original_price": original_price,
                "discount_percentage": discount_percentage
                or ((original_price - final_price) / original_price * 100),
                "discount_amount": discount_amount
                or (original_price - final_price),
                "pricing_rules": pricing_result.get("pricing_rules", ""),
                "has_pricing_rule": 1,
                "free_item_data": pricing_result.get("free_item_data", []),
            }

    final_price = _apply_discount_logic(original_price, pricing_result)

    return {
        **cart_item,
        "price": final_price,
        "original_price": original_price,
        "discount_percentage": discount_percentage,
        "discount_amount": discount_amount,
        "pricing_rules": pricing_result.get("pricing_rules", ""),
        "has_pricing_rule": pricing_result.get("has_pricing_rule", 0),
        "free_item_data": pricing_result.get("free_item_data", []),
    }


def _apply_discount_logic(original_price, pricing_result):
    rule_for = pricing_result.get("pricing_rule_for", "")
    pct = pricing_result.get("discount_percentage", 0) or 0
    amt = pricing_result.get("discount_amount", 0) or 0
    rate = pricing_result.get("price_list_rate")

    if rate is not None:
        if rule_for == "Rate" or rate != original_price:
            return rate

    if rule_for == "Discount Percentage" and pct > 0:
        return original_price * (1 - pct / 100)

    if rule_for == "Discount Amount" and amt > 0:
        return max(0, original_price - amt)

    if pct > 0:
        return original_price * (1 - pct / 100)

    if amt > 0:
        return max(0, original_price - amt)

    return original_price