import hashlib
import json

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate

from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions
from .item_price import fetch_item_price
from .item_stock import apply_queue_reservations_to_stock_map, fetch_item_balance
from .search_utils import build_item_search_conditions

MAX_ITEM_LIMIT = 100
MAX_SEARCH_LENGTH = 100
GET_ITEMS_RATE_LIMIT = 60
GET_ITEMS_RATE_WINDOW = 60


@frappe.whitelist()
def get_items(
    limit: int = MAX_ITEM_LIMIT,
    offset: int = 0,
    search: str | None = None,
    category: str | None = None,
    customer: str | None = None,
    price_list: str | None = None,
):
    _enforce_get_items_rate_limit()
    search = " ".join(str(search or "").strip().split())
    if len(search) > MAX_SEARCH_LENGTH:
        frappe.throw(_("Search text cannot exceed {0} characters.").format(MAX_SEARCH_LENGTH))

    try:
        limit = int(limit) if limit else MAX_ITEM_LIMIT
        offset = int(offset) if offset else 0
    except (ValueError, TypeError):
        limit = MAX_ITEM_LIMIT
        offset = 0

    limit = min(max(limit, 1), MAX_ITEM_LIMIT)
    offset = max(offset, 0)

    requested_price_list = price_list
    pos_doc, warehouse, pos_price_list, hide_unavailable = _get_pos_context()
    include_service_items = _include_service_items(pos_doc)
    
    price_list = requested_price_list or _get_priority_price_list(customer, pos_doc, pos_price_list)

    try:
        select_fields = (
            "i.name, i.item_name, i.description, i.item_group, i.image, "
            "i.stock_uom, i.sales_uom, i.has_batch_no, i.has_serial_no, "
            "i.is_stock_item, i.has_variants, i.variant_of, i.variant_based_on, "
            "CASE WHEN pb.name IS NULL THEN 0 ELSE 1 END AS is_product_bundle"
        )
        params_list = []
        count_params = []

        # Get allowed item groups from POS profile
        allowed_item_groups = []
        if getattr(pos_doc, "item_groups", None):
            allowed_item_groups = [d.item_group for d in pos_doc.item_groups if d.item_group]

        if hide_unavailable and include_service_items:
            join_clause = "LEFT JOIN `tabBin` b ON i.name = b.item_code"
            if warehouse:
                join_clause = "LEFT JOIN `tabBin` b ON i.name = b.item_code AND b.warehouse = %s"

            base_query = [
                f"SELECT DISTINCT {select_fields}",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                join_clause,
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
                "AND (i.has_variants = 1 OR pb.name IS NOT NULL OR i.is_stock_item = 0 OR b.actual_qty > 0)",
            ]
            count_query = [
                "SELECT COUNT(DISTINCT i.name) as total",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                join_clause,
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
                "AND (i.has_variants = 1 OR pb.name IS NOT NULL OR i.is_stock_item = 0 OR b.actual_qty > 0)",
            ]
            if warehouse:
                params_list.append(warehouse)
                count_params.append(warehouse)
        elif hide_unavailable:
            base_query = [
                f"SELECT DISTINCT {select_fields}",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                "LEFT JOIN `tabBin` b ON i.name = b.item_code",
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
                "AND (i.has_variants = 1 OR pb.name IS NOT NULL OR (i.is_stock_item = 1 AND b.actual_qty > 0))",
            ]
            count_query = [
                "SELECT COUNT(DISTINCT i.name) as total",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                "LEFT JOIN `tabBin` b ON i.name = b.item_code",
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
                "AND (i.has_variants = 1 OR pb.name IS NOT NULL OR (i.is_stock_item = 1 AND b.actual_qty > 0))",
            ]

            if warehouse:
                base_query.append("AND (i.has_variants = 1 OR pb.name IS NOT NULL OR b.warehouse = %s)")
                count_query.append("AND (i.has_variants = 1 OR pb.name IS NOT NULL OR b.warehouse = %s)")
                params_list.append(warehouse)
                count_params.append(warehouse)
        else:
            base_query = [
                f"SELECT DISTINCT {select_fields}",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
            ]
            count_query = [
                "SELECT COUNT(DISTINCT i.name) as total",
                "FROM `tabItem` i",
                "LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0",
                "WHERE i.disabled = 0",
                "AND IFNULL(i.is_sales_item, 1) = 1",
            ]

            if not include_service_items:
                base_query.append("AND (i.is_stock_item = 1 OR i.has_variants = 1 OR pb.name IS NOT NULL)")
                count_query.append("AND (i.is_stock_item = 1 OR i.has_variants = 1 OR pb.name IS NOT NULL)")

        # Apply item group filter from POS profile
        if allowed_item_groups:
            placeholders = ", ".join(["%s"] * len(allowed_item_groups))
            base_query.append(f"AND i.item_group IN ({placeholders})")
            count_query.append(f"AND i.item_group IN ({placeholders})")
            params_list.extend(allowed_item_groups)
            count_params.extend(allowed_item_groups)

        # Apply category filter from request
        if category and category != "all":
            base_query.append("AND i.item_group = %s")
            count_query.append("AND i.item_group = %s")
            params_list.append(category)
            count_params.append(category)

        enhanced_search = bool(getattr(pos_doc, "custom_enhanced_search", False))
        search_clauses, search_params = build_item_search_conditions(search, enhanced_search)
        base_query.extend(search_clauses)
        count_query.extend(search_clauses)
        params_list.extend(search_params)
        count_params.extend(search_params)
        # pass raw search string to category-count helper so it applies the same logic
        search_term = search or None

        count_sql = "\n".join(count_query)
        count_sql = apply_sql_permissions(count_sql)

        # Permission denied — user can't see any items, return empty
        if count_sql.strip().upper().startswith("SELECT 1 WHERE 1=0"):
            return {
                "items": [],
                "item_groups": [],
                "total_count": 0,
                "has_more": False,
                "limit": limit,
                "offset": offset,
            }

        # Validate placeholder count matches params AFTER sql rewrite
        placeholder_count = count_sql.count("%s")
        if placeholder_count != len(count_params):
            frappe.log_error(
                message=f"Count query placeholder mismatch. placeholders={placeholder_count}, params={len(count_params)}\nSQL:\n{count_sql}",
                title="Get Items Count Query Param Mismatch",
            )
            frappe.throw(_("Something went wrong while fetching item data."))

        total_result = frappe.db.sql(
            count_sql,
            tuple(count_params),
            as_dict=True,
        )

        total_available_count = total_result[0]["total"] if total_result else 0

        base_query.append("ORDER BY i.item_name ASC LIMIT %s OFFSET %s")
        params_list.extend([limit, offset])

        main_sql = "\n".join(base_query)
        main_sql = apply_sql_permissions(main_sql)

        placeholder_count = main_sql.count("%s")
        if placeholder_count != len(params_list):
            frappe.log_error(
                message=f"Main query placeholder mismatch. placeholders={placeholder_count}, params={len(params_list)}\nSQL:\n{main_sql}",
                title="Get Items Main Query Param Mismatch",
            )
            frappe.throw(_("Something went wrong while fetching item data."))

        items = frappe.db.sql(
            main_sql,
            tuple(params_list),
            as_dict=True,
        )

        item_groups_data = _get_item_groups_with_counts(
            pos_doc,
            warehouse,
            hide_unavailable,
            search_term,
            category,
            enhanced_search,
            include_service_items,
        )

        if not items:
            return {
                "items": [],
                "item_groups": item_groups_data,
                "total_count": 0,
                "has_more": False,
                "limit": limit,
                "offset": offset,
            }

        item_codes = [item["name"] for item in items]

        barcode_map = {}
        barcode_results = frappe.get_list(
            "Item Barcode",
            filters={"parent": ["in", item_codes]},
            fields=["parent", "barcode"],
            ignore_permissions=True,
        )

        for row in barcode_results:
            if row.parent not in barcode_map:
                barcode_map[row.parent] = row.barcode

        stock_map = _fetch_batch_stock(item_codes, warehouse)
        product_bundle_map = _fetch_product_bundle_map(item_codes, warehouse)
        variant_count_map = _fetch_variant_count_map(item_codes)
        current_date = frappe.utils.today()
        item_prices_map = _fetch_item_prices_map(item_codes, price_list, current_date)
        conversion_factor_map = _fetch_conversion_factors_map(item_codes)
        company_currency = (
            frappe.db.get_value("Company", pos_doc.company, "default_currency")
            or frappe.defaults.get_global_default("currency")
        )

        pending_items = []
        currencies = set()
        price_by_item = {}

        for item in items:
            item_code = item["name"]
            balance = stock_map.get(item_code, 0)
            is_stock_item = int(item.get("is_stock_item") or 0) == 1
            is_product_bundle = int(item.get("is_product_bundle") or 0) == 1
            is_variant_template = int(item.get("has_variants") or 0) == 1
            bundle_items = product_bundle_map.get(item_code, [])
            variant_count = variant_count_map.get(item_code, 0)

            if is_product_bundle:
                stock_component_limits = [
                    int(component.get("available_bundle_qty") or 0)
                    for component in bundle_items
                    if int(component.get("is_stock_item") or 0) == 1
                ]
                balance = min(stock_component_limits) if stock_component_limits else 0

            if hide_unavailable and not is_variant_template and (is_stock_item or is_product_bundle) and balance <= 0:
                continue

            item_prices = item_prices_map.get(item_code, [])

            stock_uom_price = next((d for d in item_prices if d.get("uom") == item.stock_uom), {})
            item_uom = item.stock_uom
            item_uom_price = stock_uom_price

            if item.sales_uom and item.sales_uom != item.stock_uom:
                item_uom = item.sales_uom
                sales_uom_price = next((d for d in item_prices if d.get("uom") == item.sales_uom), {})
                if sales_uom_price:
                    item_uom_price = sales_uom_price

            if item_prices and not item_uom_price:
                item_uom = item_prices[0].get("uom")
                item_uom_price = item_prices[0]
            
            conversion_factor = conversion_factor_map.get((item_code, item_uom), 1)
            
            if item.stock_uom != item_uom and conversion_factor:
                balance = balance // conversion_factor
            
            price = 0
            currency = company_currency
            
            if item_uom_price:
                price = flt(item_uom_price.get("price_list_rate", 0))
                currency = item_uom_price.get("currency") or currency
                
                if item_uom and item_uom != item_uom_price.get("uom") and conversion_factor:
                    price = price * conversion_factor
            
            price_by_item[item_code] = price

            pending_items.append(
                {
                    "id": item_code,
                    "name": item.item_name or item_code,
                    "description": item.description or "",
                    "category": item.item_group or "General",
                    "price": price,
                    "currency": currency,
                    "currency_symbol": "",
                    "available": variant_count if is_variant_template else balance if (is_stock_item or is_product_bundle) else 0,
                    "is_stock_item": False if is_variant_template else True if is_product_bundle else is_stock_item,
                    "is_product_bundle": is_product_bundle,
                    "bundle_items": bundle_items,
                    "is_variant_template": is_variant_template,
                    "has_variants": is_variant_template,
                    "variant_of": item.get("variant_of"),
                    "variant_based_on": item.get("variant_based_on"),
                    "variant_count": variant_count,
                    "image": item.image,
                    "sold": 0,
                    "preparationTime": 10,
                    "uom": item_uom,
                    "barcode": barcode_map.get(item_code),
                    "has_batch_no": item.has_batch_no,
                    "has_serial_no": item.has_serial_no,
                }
            )

            if currency:
                currencies.add(currency)

        currency_symbol_map = _fetch_currency_symbols_map(currencies)
        enriched_items = []
        for item in pending_items:
            item["currency_symbol"] = currency_symbol_map.get(item["currency"], item["currency"])
            enriched_items.append(item)

        tax_info_map = _fetch_item_tax_info_map(
            [item["id"] for item in enriched_items],
            pos_doc,
            current_date,
            customer,
            price_by_item,
        )
        for item in enriched_items:
            tax_info = tax_info_map.get(item["id"], _empty_tax_info())
            item["tax_info"] = tax_info
            item["price_with_vat"] = _get_expected_display_price(item["price"], tax_info)

        return {
            "items": enriched_items,
            "item_groups": item_groups_data,
            "total_count": len(enriched_items),
            "has_more": (offset + limit) < total_available_count,
            "limit": limit,
            "offset": offset,
        }

    except Exception as exc:
        _log_get_items_exception(
            exc,
            count_sql=locals().get("count_sql"),
            main_sql=locals().get("main_sql"),
            count_params=locals().get("count_params"),
            main_params=locals().get("params_list"),
            pos_doc=locals().get("pos_doc"),
            search=search,
        )
        frappe.throw(_("Something went wrong while fetching item data."))


def _enforce_get_items_rate_limit():
    """Limit catalogue requests per authenticated user/session using Redis."""
    user = getattr(frappe.session, "user", None)
    session_id = getattr(frappe.session, "sid", None)
    identity = user if user and user != "Guest" else session_id
    if not identity:
        frappe.throw(_("A valid authenticated session is required."), frappe.AuthenticationError)

    cache_key = frappe.cache.make_key(f"klik_pos:get_items:{identity}")
    if not frappe.cache.get(cache_key):
        frappe.cache.setex(cache_key, GET_ITEMS_RATE_WINDOW, 0)

    request_count = frappe.cache.incrby(cache_key, 1)
    if request_count > GET_ITEMS_RATE_LIMIT:
        frappe.throw(
            _("Too many product requests. Please try again shortly."),
            frappe.RateLimitExceededError,
        )


def _fetch_item_prices_map(item_codes, price_list, current_date):
    """Fetch all selling prices for the page in one query."""
    if not item_codes or not price_list:
        return {}

    placeholders = ", ".join(["%s"] * len(item_codes))
    query = f"""
        SELECT item_code, price_list_rate, currency, uom, batch_no, valid_from, valid_upto
        FROM `tabItem Price`
        WHERE price_list = %s
        AND item_code IN ({placeholders})
        AND selling = 1
        AND (valid_from <= %s OR valid_from IS NULL)
        AND (valid_upto >= %s OR valid_upto IS NULL)
        ORDER BY item_code, valid_from DESC
    """
    query = apply_sql_permissions(query)
    rows = frappe.db.sql(
        query,
        tuple([price_list, *item_codes, current_date, current_date]),
        as_dict=True,
    )

    result = {}
    for row in rows:
        result.setdefault(row.get("item_code"), []).append(row)
    return result


def _fetch_conversion_factors_map(item_codes):
    """Fetch UOM conversion factors for all items in one query."""
    if not item_codes:
        return {}

    placeholders = ", ".join(["%s"] * len(item_codes))
    query = f"""
        SELECT parent AS item_code, uom, conversion_factor
        FROM `tabUOM Conversion Detail`
        WHERE parent IN ({placeholders})
    """
    rows = frappe.db.sql(query, tuple(item_codes), as_dict=True)
    return {
        (row.get("item_code"), row.get("uom")): flt(row.get("conversion_factor") or 1)
        for row in rows
    }


def _fetch_currency_symbols_map(currencies):
    """Fetch symbols for all currencies used by the page in one query."""
    currencies = [currency for currency in currencies if currency]
    if not currencies:
        return {}

    rows = frappe.get_all(
        "Currency",
        filters={"name": ["in", currencies]},
        fields=["name", "symbol"],
        ignore_permissions=True,
    )
    return {row.get("name"): row.get("symbol") or row.get("name") for row in rows}


def _safe_query_params(params):
    """Keep diagnostics useful without recording raw request/search values."""
    safe = []
    for value in params or []:
        if isinstance(value, str):
            safe.append({"type": "str", "length": len(value)})
        else:
            safe.append(value)
    return safe


def _query_fingerprint(query):
    if not query:
        return None
    return hashlib.sha256(query.encode("utf-8")).hexdigest()[:16]


def _log_get_items_exception(exc, *, count_sql, main_sql, count_params, main_params, pos_doc, search):
    details = {
        "exception_type": type(exc).__name__,
        "exception_message": str(exc),
        "request_id": getattr(frappe.local, "request_id", None),
        "pos_profile": getattr(pos_doc, "name", None),
        "search_length": len(search or ""),
        "normalized_search_type": "empty" if not search else "text",
        "count_query_fingerprint": _query_fingerprint(count_sql),
        "main_query_fingerprint": _query_fingerprint(main_sql),
        "count_params": _safe_query_params(count_params),
        "main_params": _safe_query_params(main_params),
        "traceback": frappe.get_traceback(),
    }
    frappe.log_error(json.dumps(details, default=str, indent=2), "Get Items Error")


def _empty_tax_info():
    return {
        "has_vat": False,
        "is_inclusive": False,
        "total_tax_rate": 0,
        "item_tax_template": "",
        "source": "none",
        "tax_templates": [],
    }


def _fetch_item_tax_info_map(item_codes, pos_doc, current_date, customer=None, price_by_item=None):
    if not item_codes:
        return {}

    price_by_item = price_by_item or {}
    tax_rate_precision_default = frappe.db.get_default("float_precision")
    tax_rate_precision = cint(tax_rate_precision_default) if tax_rate_precision_default not in (None, "") else 3
    force_inclusive = cint(getattr(pos_doc, "is_tax_included_in_basic_rate", 0) or 0) == 1
    pos_tax_rows = _fetch_pos_sales_tax_rows(pos_doc)
    default_tax_lines = [
        {
            "account": row["account_head"],
            "rate": flt(row.get("rate") or 0, tax_rate_precision),
            "is_inclusive": force_inclusive or bool(row.get("included_in_print_rate")),
        }
        for row in pos_tax_rows
        if row.get("account_head") and flt(row.get("rate") or 0) > 0
    ]

    result = {
        item_code: _build_tax_info(default_tax_lines, "", "sales_taxes_template")
        for item_code in item_codes
    }

    item_tax_rows = _fetch_item_tax_rows(item_codes, current_date)
    if not item_tax_rows:
        return result

    customer_tax_category = _get_customer_tax_category(customer)
    selected_template_by_item = _select_item_tax_templates(
        item_tax_rows,
        customer_tax_category,
        price_by_item,
    )
    template_names = sorted({
        template
        for template in selected_template_by_item.values()
        if template
    })
    template_details = _fetch_item_tax_template_details(template_names)
    included_map = {row["account"]: row["is_inclusive"] for row in default_tax_lines}

    for item_code, template_name in selected_template_by_item.items():
        detail_rows = template_details.get(template_name, [])
        tax_lines = []
        for row in detail_rows:
            account = row.get("tax_type")
            if not account or cint(row.get("not_applicable") or 0):
                continue
            rate = flt(row.get("tax_rate") or 0, tax_rate_precision)
            if rate <= 0:
                continue
            tax_lines.append(
                {
                    "account": account,
                    "rate": rate,
                    "is_inclusive": force_inclusive or included_map.get(account, False),
                }
            )

        result[item_code] = _build_tax_info(tax_lines, template_name, "item_tax_template")

    return result


def _build_tax_info(tax_lines, item_tax_template="", source="none"):
    total_tax_rate = flt(sum(flt(row.get("rate") or 0) for row in tax_lines), 3)
    exclusive_tax_rate = flt(
        sum(flt(row.get("rate") or 0) for row in tax_lines if not row.get("is_inclusive")),
        3,
    )
    inclusive_tax_rate = flt(total_tax_rate - exclusive_tax_rate, 3)
    return {
        "has_vat": total_tax_rate > 0,
        "is_inclusive": any(bool(row.get("is_inclusive")) for row in tax_lines),
        "total_tax_rate": total_tax_rate,
        "exclusive_tax_rate": exclusive_tax_rate,
        "inclusive_tax_rate": inclusive_tax_rate,
        "item_tax_template": item_tax_template or "",
        "source": source if total_tax_rate > 0 else "none",
        "tax_templates": tax_lines,
    }


def _get_expected_display_price(price, tax_info):
    exclusive_tax_rate = flt((tax_info or {}).get("exclusive_tax_rate") or 0)
    if exclusive_tax_rate <= 0:
        return flt(price)

    return flt(price) * (1 + exclusive_tax_rate / 100)


def _fetch_pos_sales_tax_rows(pos_doc):
    taxes_and_charges = getattr(pos_doc, "taxes_and_charges", None)
    if not taxes_and_charges:
        return []

    try:
        return frappe.get_all(
            "Sales Taxes and Charges",
            filters={
                "parent": taxes_and_charges,
                "charge_type": "On Net Total",
            },
            fields=["account_head", "rate", "included_in_print_rate"],
            order_by="idx asc",
        )
    except Exception:
        return []


def _fetch_item_tax_rows(item_codes, current_date):
    try:
        return frappe.get_all(
            "Item Tax",
            filters={
                "parent": ["in", item_codes],
                "parenttype": "Item",
            },
            fields=[
                "parent",
                "item_tax_template",
                "tax_category",
                "valid_from",
                "minimum_net_rate",
                "maximum_net_rate",
            ],
            order_by="idx asc",
        )
    except Exception:
        return []


def _get_customer_tax_category(customer):
    if not customer:
        return None

    try:
        return frappe.db.get_value("Customer", customer, "tax_category")
    except Exception:
        return None


def _select_item_tax_templates(item_tax_rows, customer_tax_category=None, price_by_item=None):
    price_by_item = price_by_item or {}
    current_date = getdate(frappe.utils.today())
    selected = {}

    for row in item_tax_rows:
        item_code = row.get("parent")
        template = row.get("item_tax_template")
        if not item_code or not template:
            continue

        tax_category = row.get("tax_category")
        if tax_category and tax_category != customer_tax_category:
            continue

        valid_from = row.get("valid_from")
        if valid_from and getdate(valid_from) > current_date:
            continue

        price = flt(price_by_item.get(item_code) or 0)
        minimum_net_rate = flt(row.get("minimum_net_rate") or 0)
        maximum_net_rate = flt(row.get("maximum_net_rate") or 0)
        if minimum_net_rate and price and price < minimum_net_rate:
            continue
        if maximum_net_rate and price and price > maximum_net_rate:
            continue

        current_rank = selected.get(item_code, {}).get("rank", -1)
        rank = 1 if tax_category and tax_category == customer_tax_category else 0
        if rank >= current_rank:
            selected[item_code] = {"template": template, "rank": rank}

    return {item_code: data["template"] for item_code, data in selected.items()}


def _fetch_item_tax_template_details(template_names):
    if not template_names:
        return {}

    details = {}
    try:
        rows = frappe.get_all(
            "Item Tax Template Detail",
            filters={"parent": ["in", template_names]},
            fields=["parent", "tax_type", "tax_rate", "not_applicable"],
            order_by="idx asc",
        )
    except Exception:
        return details

    for row in rows:
        details.setdefault(row.get("parent"), []).append(row)

    return details

   
def _get_item_groups_with_counts(
    pos_doc,
    warehouse,
    hide_unavailable,
    search_term=None,
    selected_category=None,
    enhanced_search=False,
    include_service_items=False,
):
    try:
        item_groups = []

        def _prepare_sql_args(sql_query, query_params):
            """Return params tuple, or () if no placeholders. Returns None only on unrecoverable mismatch."""
            params = tuple(query_params) if query_params else ()
            placeholder_count = sql_query.count("%s")

            if placeholder_count == 0:
                return ()

            if placeholder_count != len(params):
                frappe.log_error(
                    message=f"Placeholder mismatch in item group query. placeholders={placeholder_count}, params={len(params)}\nSQL: {sql_query}",
                    title="Item Group Query Param Mismatch",
                )
                return None

            return params
        
        allowed_groups = []
        
        if getattr(pos_doc, "item_groups", None):
            allowed_groups = [d.item_group for d in pos_doc.item_groups if d.item_group]
        
        if not allowed_groups:
            group_query = """
                SELECT DISTINCT i.item_group
                FROM `tabItem` i
                LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0
                WHERE i.disabled = 0
                AND IFNULL(i.is_sales_item, 1) = 1
                AND i.item_group IS NOT NULL
                AND i.item_group != ''
            """
            if not include_service_items:
                group_query += " AND (i.is_stock_item = 1 OR i.has_variants = 1 OR pb.name IS NOT NULL)"
            
            if hide_unavailable and warehouse:
                group_query += " AND (i.has_variants = 1 OR pb.name IS NOT NULL OR EXISTS (SELECT 1 FROM `tabBin` b WHERE b.item_code = i.name AND b.warehouse = %s AND b.actual_qty > 0))"
                group_query_params = [warehouse]
            else:
                group_query_params = []
            
            if search_term:
                s_clauses, s_params = build_item_search_conditions(search_term, enhanced_search)
                group_query += " " + " ".join(s_clauses)
                group_query_params.extend(s_params)
            
            group_query = apply_sql_permissions(group_query)
            args = _prepare_sql_args(group_query, group_query_params)

            if args is None:
                return []
            
            group_results = frappe.db.sql(group_query, args, as_dict=True)
            allowed_groups = [row["item_group"] for row in group_results]
        
        if not allowed_groups:
            return []
        
        for group_name in allowed_groups:
            count_query = """
                SELECT COUNT(DISTINCT i.name) as item_count
                FROM `tabItem` i
                LEFT JOIN `tabProduct Bundle` pb ON pb.new_item_code = i.name AND pb.disabled = 0
                WHERE i.disabled = 0
                AND IFNULL(i.is_sales_item, 1) = 1
                AND i.item_group = %s
            """
            if not include_service_items:
                count_query += " AND (i.is_stock_item = 1 OR i.has_variants = 1 OR pb.name IS NOT NULL)"
            params = [group_name]
            
            if hide_unavailable and warehouse:
                count_query += " AND (i.has_variants = 1 OR pb.name IS NOT NULL OR EXISTS (SELECT 1 FROM `tabBin` b WHERE b.item_code = i.name AND b.warehouse = %s AND b.actual_qty > 0))"
                params.append(warehouse)
            
            if search_term:
                s_clauses, s_params = build_item_search_conditions(search_term, enhanced_search)
                count_query += " " + " ".join(s_clauses)
                params.extend(s_params)
            
            count_sql = apply_sql_permissions(count_query)
            args = _prepare_sql_args(count_sql, params)

            if args is None:
                continue
            
            result = frappe.db.sql(count_sql, args, as_dict=True)
            item_count = result[0]["item_count"] if result else 0
            
            if item_count > 0:
                try:
                    group_doc = frappe.get_doc("Item Group", group_name)
                    
                    item_groups.append({
                        "id": group_name,
                        "name": group_doc.item_group_name,
                        "name_en": group_doc.get("item_group_name"),
                        "name_ar": group_doc.get("item_group_name_ar"),
                        "parent_group": group_doc.parent_item_group,
                        "is_group": group_doc.is_group,
                        "image": group_doc.image,
                        "count": item_count,
                        "custom_icon": group_doc.get("custom_icon"),
                        "custom_color": group_doc.get("custom_color"),
                    })
                except Exception:
                    item_groups.append({
                        "id": group_name,
                        "name": group_name,
                        "count": item_count,
                    })
        
        return item_groups
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Item Groups With Counts Error")
        return []
   

def _get_pos_context():
    pos_doc = get_current_pos_profile()
    if not pos_doc or not getattr(pos_doc, "name", None):
        frappe.throw(_("A valid POS Profile is required to load items."))

    warehouse = getattr(pos_doc, "warehouse", None)
    if not warehouse:
        frappe.throw(_("POS Profile {0} has no warehouse configured.").format(pos_doc.name))

    return (
        pos_doc,
        warehouse,
        getattr(pos_doc, "selling_price_list", None),
        getattr(pos_doc, "hide_unavailable_items", False),
    )


def _get_priority_price_list(customer=None, pos_profile=None, default_price_list=None):
    try:
        if customer:
            try:
                customer_doc = frappe.get_doc("Customer", customer)
                if customer_doc.default_price_list:
                    return customer_doc.default_price_list
            except Exception:
                pass
            
            try:
                customer_doc = frappe.get_doc("Customer", customer)
                if customer_doc.customer_group:
                    customer_group_doc = frappe.get_doc("Customer Group", customer_doc.customer_group)
                    if getattr(customer_group_doc, "default_price_list", None):
                        return customer_group_doc.default_price_list
            except Exception:
                pass
    except Exception as e:
        frappe.logger().warning(f"Error getting customer-based price list: {e}")
    
    if pos_profile and getattr(pos_profile, "selling_price_list", None):
        return pos_profile.selling_price_list
    
    try:
        selling_settings_price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")
        if selling_settings_price_list:
            return selling_settings_price_list
    except Exception:
        pass
    
    if default_price_list:
        return default_price_list
    
    return None


def _include_service_items(pos_doc):
    return cint(getattr(pos_doc, "custom_enable_service_items", 0) or 0) == 1


def _fetch_batch_stock(item_codes, warehouse):
    if not item_codes or not warehouse:
        return {}

    stock_map = {code: 0 for code in item_codes}

    try:
        placeholders = ", ".join(["%s"] * len(item_codes))

        stock_sql = f"""
            SELECT item_code, actual_qty
            FROM `tabBin`
            WHERE item_code IN ({placeholders}) AND warehouse = %s
        """
        stock_sql = apply_sql_permissions(stock_sql)

        results = frappe.db.sql(
            stock_sql,
            (*item_codes, warehouse),
            as_dict=True,
        )

        for row in results:
            stock_map[row["item_code"]] = flt(row["actual_qty"])

        apply_queue_reservations_to_stock_map(stock_map, warehouse)

    except Exception:
        for code in item_codes:
            stock_map[code] = fetch_item_balance(code, warehouse)

    return stock_map


def _fetch_product_bundle_map(item_codes, warehouse):
    if not item_codes:
        return {}

    try:
        placeholders = ", ".join(["%s"] * len(item_codes))
        bundle_sql = f"""
            SELECT
                pb.new_item_code AS bundle_item_code,
                pbi.item_code,
                pbi.qty,
                pbi.uom,
                pbi.description,
                i.item_name,
                i.is_stock_item,
                i.has_batch_no,
                i.has_serial_no
            FROM `tabProduct Bundle` pb
            INNER JOIN `tabProduct Bundle Item` pbi ON pbi.parent = pb.name
            INNER JOIN `tabItem` i ON i.name = pbi.item_code
            WHERE pb.disabled = 0
            AND pb.new_item_code IN ({placeholders})
            ORDER BY pb.new_item_code, pbi.idx
        """
        bundle_sql = apply_sql_permissions(bundle_sql)
        rows = frappe.db.sql(bundle_sql, tuple(item_codes), as_dict=True)
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Fetch Product Bundle Map Error")
        return {}

    component_codes = sorted({row.item_code for row in rows if row.get("item_code")})
    component_stock_map = _fetch_batch_stock(component_codes, warehouse) if component_codes else {}
    bundle_map = {}

    for row in rows:
        required_qty = flt(row.get("qty") or 0)
        available_qty = flt(component_stock_map.get(row.item_code, 0))
        available_bundle_qty = (
            int(available_qty // required_qty)
            if int(row.get("is_stock_item") or 0) == 1 and required_qty > 0
            else 0
        )

        bundle_map.setdefault(row.bundle_item_code, []).append(
            {
                "item_code": row.item_code,
                "item_name": row.item_name or row.item_code,
                "qty": required_qty,
                "uom": row.uom or "",
                "description": row.description or "",
                "is_stock_item": int(row.get("is_stock_item") or 0) == 1,
                "has_batch_no": int(row.get("has_batch_no") or 0) == 1,
                "has_serial_no": int(row.get("has_serial_no") or 0) == 1,
                "available": available_qty,
                "available_bundle_qty": available_bundle_qty,
            }
        )

    return bundle_map


def _fetch_variant_count_map(item_codes):
    if not item_codes:
        return {}

    try:
        placeholders = ", ".join(["%s"] * len(item_codes))
        count_sql = f"""
            SELECT variant_of, COUNT(*) AS variant_count
            FROM `tabItem`
            WHERE disabled = 0
            AND IFNULL(is_sales_item, 1) = 1
            AND variant_of IN ({placeholders})
            GROUP BY variant_of
        """
        count_sql = apply_sql_permissions(count_sql)
        rows = frappe.db.sql(count_sql, tuple(item_codes), as_dict=True)
        return {row.variant_of: int(row.variant_count or 0) for row in rows}
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Fetch Variant Count Map Error")
        return {}
