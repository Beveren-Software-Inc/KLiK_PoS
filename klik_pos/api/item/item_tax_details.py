import json

import frappe
from frappe.utils import cint, flt
from erpnext.stock.get_item_details import get_item_details
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist(allow_guest=True)
def get_item_tax_details(item_code, customer=None, qty=1, uom=None):
    """
    Get per-item tax details for cart items, similar to ERPNext's process_item_selection.
    
    This endpoint calls get_item_details to fetch:
    - item_tax_template: The applicable tax template
    - item_tax_rate: Per-item tax rates (JSON mapping of account → rate)
    - Calculated tax amount based on quantity and rate
    
    Args:
        item_code: The item code to fetch tax details for
        customer: Customer ID for price/tax determination
        qty: Quantity for tax calculation
        uom: Unit of measurement
        
    Returns:
        {
            "success": bool,
            "item_tax_template": str,
            "item_tax_rate": dict,  # e.g., {"account": rate, ...}
            "item_name": str,
            "rate": float,
            "tax_info": {
                "tax_templates": [{"name": str, "rate": float, "is_inclusive": bool}],
                "total_tax_rate": float,
            }
        }
    """
    try:
        if not item_code:
            frappe.throw("Item code is required")
        
        pos_profile = get_current_pos_profile()
        qty = flt(qty) if qty else 1
        if qty <= 0:
            qty = 1

        currency_precision_default = frappe.db.get_default("currency_precision")
        currency_precision = cint(currency_precision_default) if currency_precision_default not in (None, "") else 2
        float_precision_default = frappe.db.get_default("float_precision")
        tax_rate_precision = cint(float_precision_default) if float_precision_default not in (None, "") else 3

        company_currency = frappe.get_cached_value("Company", pos_profile.company, "default_currency")
        
        # Get customer details if provided (but not for "Walk in" customer)
        customer_doc = None
        if customer and customer != "Walk in":
            try:
                customer_doc = frappe.get_doc("Customer", customer)
            except Exception:
                pass
        
        # Keep POS currency aligned to company currency for stable conversion in item enrichment.
        currency = pos_profile.currency or company_currency
        conversion_rate = 1.0 if currency == company_currency else flt(
            frappe.get_cached_value("Currency Exchange", {
                "from_currency": currency,
                "to_currency": company_currency,
            }, "exchange_rate")
            or 1.0
        )

        price_list = customer_doc.default_price_list if customer_doc and customer_doc.default_price_list else pos_profile.selling_price_list
        price_list_currency = currency
        if price_list:
            price_list_currency = frappe.get_cached_value("Price List", price_list, "currency") or currency

        plc_conversion_rate = 1.0 if price_list_currency == currency else flt(
            frappe.get_cached_value("Currency Exchange", {
                "from_currency": price_list_currency,
                "to_currency": currency,
            }, "exchange_rate")
            or 1.0
        )
        
        # Prepare args for get_item_details - this mimics ERPNext's transaction.js context
        args = {
            "item_code": item_code,
            "warehouse": pos_profile.warehouse,
            "customer": customer,
            "company": pos_profile.company,
            "currency": currency,
            "conversion_rate": conversion_rate,
            "price_list": price_list,
            "selling_price_list": price_list,
            "price_list_currency": price_list_currency,
            "plc_conversion_rate": plc_conversion_rate,
            "qty": qty,
            "uom": uom or "Nos",
            "tax_category": customer_doc.tax_category if customer_doc else None,
            "is_pos": 1,
            "doctype": "Sales Invoice",
            "name": "",
            "transaction_date": frappe.utils.nowdate(),
        }
        
        # Call get_item_details - returns dict with item details including item_tax_template and item_tax_rate
        details = get_item_details(ctx=args)
        
        item_tax_template = details.get("item_tax_template", "")
        item_tax_rate = details.get("item_tax_rate", {})
        item_name = details.get("item_name", "")
        rate = flt(details.get("rate") or details.get("price_list_rate") or 0, currency_precision)
        
        # Parse item_tax_rate if it's a string (JSON)
        if isinstance(item_tax_rate, str):
            try:
                item_tax_rate = json.loads(item_tax_rate)
            except Exception:
                item_tax_rate = {}

        item_tax_rate = {
            account: flt(tax_rate, tax_rate_precision)
            for account, tax_rate in (item_tax_rate or {}).items()
        }
        
        # Calculate total tax rate
        total_tax_rate = flt(sum(flt(v) for v in item_tax_rate.values()), tax_rate_precision) if item_tax_rate else 0.0
        
        # Build tax metadata from item tax map and active sales tax template.
        tax_templates = []
        if item_tax_rate:
            account_heads = list(item_tax_rate.keys())
            included_map = {}
            if pos_profile.taxes_and_charges and account_heads:
                for row in frappe.get_all(
                    "Sales Taxes and Charges",
                    filters={
                        "parent": pos_profile.taxes_and_charges,
                        "account_head": ["in", account_heads],
                    },
                    fields=["account_head", "included_in_print_rate"],
                ):
                    included_map[row.account_head] = bool(row.included_in_print_rate)

            for account, tax_rate in item_tax_rate.items():
                tax_templates.append(
                    {
                        "account": account,
                        "rate": flt(tax_rate, tax_rate_precision),
                        "is_inclusive": included_map.get(account, False),
                    }
                )
        
        result = {
            "success": True,
            "item_tax_template": item_tax_template,
            "item_tax_rate": item_tax_rate or {},
            "item_name": item_name,
            "rate": rate,
            "tax_info": {
                "tax_templates": tax_templates,
                "total_tax_rate": total_tax_rate,
            }
            ,"precision": {
                "currency": currency_precision,
                "tax_rate": tax_rate_precision,
            }
        }
        print(frappe.as_json(result, indent=2))
        return result
        
    except Exception as e:
        frappe.log_error(f"Error fetching item tax details: {str(e)}", "Item Tax Details Error")
        return {
            "success": False,
            "error": str(e),
            "item_tax_template": "",
            "item_tax_rate": {},
        }
