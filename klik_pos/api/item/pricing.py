import json
import frappe
from frappe import _
from frappe.utils import flt

from erpnext.accounts.doctype.pricing_rule.pricing_rule import apply_pricing_rule
from klik_pos.klik_pos.utils import get_current_pos_profile
from ..sql_builder import apply_sql_permissions


@frappe.whitelist(allow_guest=True)
def get_cart_pricing(cart_items, customer=None):
    """
    Single API call to get all pricing information for cart items
    Returns: {
        items: [
            {
                item_code: str,
                price: float,
                original_price: float,
                discount_percentage: float,
                discount_amount: float,
                pricing_rules: str,
                has_pricing_rule: bool,
                free_item_data: list
            }
        ],
        total_discount: float,
        total_after_discount: float
    }
    """
    try:
        cart_items = _parse_cart_items(cart_items)
        if not cart_items:
            return {"items": [], "total_discount": 0, "total_after_discount": 0}

        context = _build_pricing_context(customer)
        erpnext_items = _prepare_erpnext_items(cart_items, context)

        if not erpnext_items:
            return {"items": cart_items, "total_discount": 0, "total_after_discount": 0}

        pricing_results = _apply_pricing_rules(erpnext_items, context)
        processed_items = _process_pricing_results(pricing_results, erpnext_items, cart_items, context)
        
        # Calculate totals
        total_original = sum(item.get("original_price", item.get("price", 0)) * item.get("quantity", 1) for item in processed_items)
        total_discounted = sum(item.get("price", 0) * item.get("quantity", 1) for item in processed_items)
        
        return {
            "items": processed_items,
            "total_discount": total_original - total_discounted,
            "total_after_discount": total_discounted
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error in get_cart_pricing: {e!s}")
        return {"items": cart_items, "total_discount": 0, "total_after_discount": 0}


def _parse_cart_items(cart_items):
    if isinstance(cart_items, str):
        return json.loads(cart_items)
    return cart_items


def _build_pricing_context(customer=None):
    pos_profile = get_current_pos_profile()
    company = pos_profile.company if pos_profile else frappe.defaults.get_user_default("Company")
    
    context = {
        "pos_profile": pos_profile,
        "company": company,
        "warehouse": pos_profile.warehouse if pos_profile else None,
        "price_list": _get_price_list(customer),
        "currency": frappe.get_cached_value("Company", company, "default_currency") or "SAR",
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


def _get_price_list(customer=None):
    if customer:
        customer_doc = frappe.get_list(
            "Customer",
            filters={"name": customer},
            fields=["default_price_list", "customer_group"],
            limit=1,
        )
        if customer_doc and customer_doc[0].get("default_price_list"):
            return customer_doc[0]["default_price_list"]
        
        if customer_doc and customer_doc[0].get("customer_group"):
            group_doc = frappe.get_list(
                "Customer Group",
                filters={"name": customer_doc[0]["customer_group"]},
                fields=["default_price_list"],
                limit=1,
            )
            if group_doc and group_doc[0].get("default_price_list"):
                return group_doc[0]["default_price_list"]

    pos_profile = get_current_pos_profile()
    if pos_profile and getattr(pos_profile, "selling_price_list", None):
        return pos_profile.selling_price_list

    price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")
    if price_list:
        return price_list

    return None


def _prepare_erpnext_items(cart_items, context):
    erpnext_items = []
    price_list = context.get("price_list")
    
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
        item_qty = item.get("quantity", 1)
        
        # Get base price
        base_price = _get_item_price(item_code, item_uom, price_list, context.get("customer"))
        
        if base_price <= 0:
            base_price = item.get("price", 0)

        conversion_factor = 1.0
        if item_uom != item_data.stock_uom:
            conv = _get_uom_conversion_factor(item_code, item_uom)
            if conv:
                conversion_factor = conv

        erpnext_items.append({
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
        })

    return erpnext_items


def _get_item_price(item_code, uom, price_list, customer=None):
    try:
        sql = """
            SELECT price_list_rate, currency
            FROM `tabItem Price`
            WHERE item_code = %s AND selling = 1
        """
        params = [item_code]
        
        if price_list:
            sql += " AND price_list = %s"
            params.append(price_list)
        
        if uom:
            sql += " AND uom = %s"
            params.append(uom)
        else:
            sql += " AND (uom = stock_uom OR uom IS NULL)"
        
        sql += " ORDER BY modified DESC LIMIT 1"
        sql = apply_sql_permissions(sql)
        
        result = frappe.db.sql(sql, tuple(params), as_dict=True)
        
        if result:
            return flt(result[0]["price_list_rate"])
        
        return 0
    except Exception:
        return 0


def _get_uom_conversion_factor(item_code, uom):
    try:
        sql = """
            SELECT conversion_factor
            FROM `tabUOM Conversion Detail`
            WHERE parent = %s AND uom = %s
            LIMIT 1
        """
        sql = apply_sql_permissions(sql)
        result = frappe.db.sql(sql, (item_code, uom), as_dict=True)
        return flt(result[0]["conversion_factor"]) if result else None
    except Exception:
        return None


def _apply_pricing_rules(erpnext_items, context):
    args = frappe._dict({
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
    })

    try:
        return apply_pricing_rule(args, doc=None)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Pricing Rule Error")
        return []


def _process_pricing_results(pricing_results, erpnext_items, cart_items, context):
    result_items = []
    cart_item_map = {(c.get("id") or c.get("item_code")): c for c in cart_items if (c.get("id") or c.get("item_code"))}

    for idx, pricing_result in enumerate(pricing_results):
        if idx >= len(erpnext_items):
            continue

        erpnext_item = erpnext_items[idx]
        item_code = erpnext_item.get("item_code")
        cart_item = cart_item_map.get(item_code)

        if not cart_item:
            continue

        original_price = erpnext_item.get("price_list_rate", cart_item.get("price", 0))
        
        if not pricing_result.get("pricing_rules") or not pricing_result.get("has_pricing_rule"):
            result_items.append({
                **cart_item,
                "price": original_price,
                "original_price": original_price,
                "discount_percentage": 0,
                "discount_amount": 0,
                "has_pricing_rule": 0,
            })
        else:
            discounted_price = _calculate_discounted_price(original_price, pricing_result)
            discount_percentage = pricing_result.get("discount_percentage", 0) or 0
            discount_amount = pricing_result.get("discount_amount", 0) or 0
            
            if discounted_price < original_price and discount_percentage == 0 and discount_amount == 0:
                discount_percentage = ((original_price - discounted_price) / original_price) * 100
                discount_amount = original_price - discounted_price
            
            result_items.append({
                **cart_item,
                "price": discounted_price,
                "original_price": original_price,
                "discount_percentage": discount_percentage,
                "discount_amount": discount_amount,
                "pricing_rules": pricing_result.get("pricing_rules", ""),
                "has_pricing_rule": 1,
                "free_item_data": pricing_result.get("free_item_data", []),
            })

    return result_items


def _calculate_discounted_price(original_price, pricing_result):
    rate = pricing_result.get("price_list_rate")
    if rate is not None and rate != original_price:
        return rate
    
    pct = pricing_result.get("discount_percentage", 0) or 0
    amt = pricing_result.get("discount_amount", 0) or 0
    
    if pct > 0:
        return original_price * (1 - pct / 100)
    
    if amt > 0:
        return max(0, original_price - amt)
    
    return original_price