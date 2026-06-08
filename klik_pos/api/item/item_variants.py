import frappe
from frappe import _
from frappe.utils import cint, flt

from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions
from .item_listing import _fetch_batch_stock, _get_priority_price_list
from .item_price import fetch_item_price


@frappe.whitelist()
def get_template_variants(template_item_code: str, customer: str | None = None):
    if not template_item_code:
        frappe.throw(_("Template item is required."))

    template = frappe.db.get_value(
        "Item",
        template_item_code,
        [
            "name",
            "item_name",
            "description",
            "item_group",
            "image",
            "stock_uom",
            "sales_uom",
            "has_variants",
            "variant_based_on",
        ],
        as_dict=True,
    )

    if not template:
        frappe.throw(_("Template item {0} was not found.").format(template_item_code))

    if cint(template.has_variants) != 1:
        frappe.throw(_("Item {0} is not a variant template.").format(template_item_code))

    pos_doc, warehouse, default_price_list = _get_variant_pos_context()
    price_list = _get_priority_price_list(customer, pos_doc, default_price_list)

    variants = _get_template_variant_rows(template_item_code)
    variant_codes = [variant.name for variant in variants]
    stock_map = _fetch_batch_stock(variant_codes, warehouse) if variant_codes else {}
    attribute_map = _get_variant_attribute_map(variant_codes)

    options = _build_attribute_options(template_item_code, variants, attribute_map)
    enriched_variants = []

    for variant in variants:
        item_code = variant.name
        is_stock_item = cint(variant.is_stock_item) == 1
        price_info = fetch_item_price(item_code, price_list=price_list)
        item_uom = variant.sales_uom or variant.stock_uom

        enriched_variants.append(
            {
                "id": item_code,
                "item_code": item_code,
                "name": variant.item_name or item_code,
                "description": variant.description or template.description or "",
                "category": variant.item_group or template.item_group or "General",
                "price": flt(price_info.get("price") or 0),
                "currency": price_info.get("currency"),
                "currency_symbol": price_info.get("currency_symbol"),
                "available": flt(stock_map.get(item_code, 0)) if is_stock_item else 0,
                "is_stock_item": is_stock_item,
                "image": variant.image or template.image,
                "sold": 0,
                "uom": item_uom,
                "barcode": variant.barcode,
                "has_batch_no": cint(variant.has_batch_no) == 1,
                "has_serial_no": cint(variant.has_serial_no) == 1,
                "variant_of": template_item_code,
                "variant_attributes": attribute_map.get(item_code, {}),
            }
        )

    return {
        "template": {
            "id": template.name,
            "name": template.item_name or template.name,
            "description": template.description or "",
            "category": template.item_group or "General",
            "image": template.image,
            "variant_based_on": template.variant_based_on,
        },
        "attributes": options,
        "variants": enriched_variants,
    }


def _get_variant_pos_context():
    try:
        pos_doc = get_current_pos_profile()
    except Exception:
        pos_doc = frappe._dict({})

    warehouse = getattr(pos_doc, "warehouse", None)
    return pos_doc, warehouse, getattr(pos_doc, "selling_price_list", None)


def _get_template_variant_rows(template_item_code):
    sql = """
        SELECT
            i.name,
            i.item_name,
            i.description,
            i.item_group,
            i.image,
            i.stock_uom,
            i.sales_uom,
            i.is_stock_item,
            i.has_batch_no,
            i.has_serial_no,
            (
                SELECT ib.barcode
                FROM `tabItem Barcode` ib
                WHERE ib.parent = i.name
                ORDER BY ib.idx
                LIMIT 1
            ) AS barcode
        FROM `tabItem` i
        WHERE i.disabled = 0
        AND IFNULL(i.is_sales_item, 1) = 1
        AND i.variant_of = %s
        ORDER BY i.item_name ASC
    """
    sql = apply_sql_permissions(sql)
    return frappe.db.sql(sql, (template_item_code,), as_dict=True)


def _get_variant_attribute_map(variant_codes):
    if not variant_codes:
        return {}

    placeholders = ", ".join(["%s"] * len(variant_codes))
    sql = f"""
        SELECT parent, attribute, attribute_value
        FROM `tabItem Variant Attribute`
        WHERE parent IN ({placeholders})
        AND IFNULL(disabled, 0) = 0
        ORDER BY idx
    """
    rows = frappe.db.sql(sql, tuple(variant_codes), as_dict=True)
    attribute_map = {}

    for row in rows:
        if not row.attribute or not row.attribute_value:
            continue
        attribute_map.setdefault(row.parent, {})[row.attribute] = row.attribute_value

    return attribute_map


def _build_attribute_options(template_item_code, variants, attribute_map):
    template_attributes = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": template_item_code, "disabled": 0},
        fields=["attribute", "numeric_values", "idx"],
        order_by="idx",
    )
    attribute_order = [row.attribute for row in template_attributes if row.attribute]

    for attrs in attribute_map.values():
        for attribute in attrs:
            if attribute not in attribute_order:
                attribute_order.append(attribute)

    variant_lookup = {variant.name: variant for variant in variants}
    options = []

    for attribute in attribute_order:
        values = []
        seen = set()
        for item_code, attrs in attribute_map.items():
            value = attrs.get(attribute)
            if not value or value in seen:
                continue
            seen.add(value)
            values.append(
                {
                    "value": value,
                    "variant_count": sum(
                        1
                        for code, code_attrs in attribute_map.items()
                        if code_attrs.get(attribute) == value and code in variant_lookup
                    ),
                }
            )

        if values:
            options.append({"attribute": attribute, "values": values})

    return options
