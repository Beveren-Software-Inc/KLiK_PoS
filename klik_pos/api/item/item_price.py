import frappe
from frappe import _
from frappe.utils import flt

from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions


@frappe.whitelist(allow_guest=True)
def get_item_price_for_customer(item_code, customer=None, uom=None):
    try:
        if not item_code:
            return {
                "success": False,
                "price": 0,
                "currency": "KES",
                "currency_symbol": "KES",
            }

        price_info = fetch_item_price(
            item_code,
            customer=customer,
            uom=uom,
        )

        return {
            "success": True,
            "price": price_info["price"],
            "currency": price_info["currency"],
            "currency_symbol": price_info["currency_symbol"],
        }

    except Exception as e:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error getting item price for customer: {item_code}",
        )
        return {
            "success": False,
            "price": 0,
            "currency": "KES",
            "currency_symbol": "KES",
            "error": str(e),
        }


def fetch_item_price(
    item_code: str,
    price_list: str | None = None,
    customer: str | None = None,
    uom: str | None = None,
) -> dict:
    try:
        if not price_list:
            price_list = get_price_list_with_customer_priority(customer)

        if not price_list or not str(price_list).strip():
            base_sql = """
                SELECT price_list_rate, currency
                FROM `tabItem Price`
                WHERE item_code = %s AND selling = 1
            """
            params = [item_code]

            if uom:
                base_sql += " AND uom = %s"
                params.append(uom)

            base_sql += " ORDER BY modified DESC LIMIT 1"
            base_sql = apply_sql_permissions(base_sql)

            price_doc = frappe.db.sql(
                base_sql,
                tuple(params),
                as_dict=True,
            )

            if price_doc:
                res = price_doc[0]

                symbol_sql = """
                    SELECT symbol FROM `tabCurrency` WHERE name = %s
                """
                symbol_sql = apply_sql_permissions(symbol_sql)

                symbol_data = frappe.db.sql(
                    symbol_sql,
                    (res["currency"],),
                )

                symbol = (
                    symbol_data[0][0]
                    if symbol_data and symbol_data[0][0]
                    else res["currency"]
                )

                return {
                    "price": flt(res["price_list_rate"]),
                    "currency": res["currency"],
                    "currency_symbol": symbol,
                }

            if uom:
                calc = _calculate_price_from_default_uom(
                    item_code,
                    uom,
                    price_list,
                    customer,
                )
                if calc:
                    return calc

            item_sql = """
                SELECT valuation_rate, stock_uom
                FROM `tabItem`
                WHERE name = %s
                LIMIT 1
            """
            item_sql = apply_sql_permissions(item_sql)

            item_res = frappe.db.sql(
                item_sql,
                (item_code,),
                as_dict=True,
            )

            item_data = item_res[0] if item_res else None

            default_company = frappe.defaults.get_user_default("Company")
            if not default_company:
                company_sql = """
                    SELECT default_company FROM `tabGlobal Defaults` LIMIT 1
                """
                company_sql = apply_sql_permissions(company_sql)
                company_res = frappe.db.sql(company_sql)
                default_company = company_res[0][0] if company_res else None

            default_currency = None
            if default_company:
                currency_sql = """
                    SELECT default_currency FROM `tabCompany` WHERE name = %s
                """
                currency_sql = apply_sql_permissions(currency_sql)

                currency_res = frappe.db.sql(
                    currency_sql,
                    (default_company,),
                )

                default_currency = (
                    currency_res[0][0] if currency_res else None
                )

            default_currency = default_currency or "KES"

            symbol_sql = """
                SELECT symbol FROM `tabCurrency` WHERE name = %s
            """
            symbol_sql = apply_sql_permissions(symbol_sql)

            symbol_res = frappe.db.sql(
                symbol_sql,
                (default_currency,),
            )

            default_symbol = (
                symbol_res[0][0]
                if symbol_res and symbol_res[0][0]
                else default_currency
            )

            valuation_price = flt(item_data["valuation_rate"]) if item_data else 0

            if uom and item_data and uom != item_data["stock_uom"]:
                factor = _get_uom_conversion_factor(item_code, uom)
                if factor:
                    valuation_price = valuation_price * factor

            return {
                "price": valuation_price,
                "currency": default_currency,
                "currency_symbol": default_symbol,
            }

        sql = """
            SELECT price_list_rate, currency
            FROM `tabItem Price`
            WHERE item_code = %s AND selling = 1 AND price_list = %s
        """
        params = [item_code, price_list]

        if uom:
            sql += " AND uom = %s"
            params.append(uom)

        sql += " LIMIT 1"
        sql = apply_sql_permissions(sql)

        price_doc = frappe.db.sql(
            sql,
            tuple(params),
            as_dict=True,
        )

        if price_doc:
            res = price_doc[0]

            symbol_sql = """
                SELECT symbol FROM `tabCurrency` WHERE name = %s
            """
            symbol_sql = apply_sql_permissions(symbol_sql)

            symbol_res = frappe.db.sql(
                symbol_sql,
                (res["currency"],),
            )

            symbol = (
                symbol_res[0][0]
                if symbol_res and symbol_res[0][0]
                else res["currency"]
            )

            return {
                "price": flt(res["price_list_rate"]),
                "currency": res["currency"],
                "currency_symbol": symbol,
            }

        if uom:
            calc = _calculate_price_from_default_uom(
                item_code,
                uom,
                price_list,
                customer,
            )
            if calc:
                return calc

        item_sql = """
            SELECT valuation_rate, stock_uom
            FROM `tabItem`
            WHERE name = %s
            LIMIT 1
        """
        item_sql = apply_sql_permissions(item_sql)

        item_res = frappe.db.sql(
            item_sql,
            (item_code,),
            as_dict=True,
        )

        item_data = item_res[0] if item_res else None

        default_company = frappe.defaults.get_user_default("Company")
        if not default_company:
            company_sql = """
                SELECT default_company FROM `tabGlobal Defaults` LIMIT 1
            """
            company_sql = apply_sql_permissions(company_sql)
            company_res = frappe.db.sql(company_sql)
            default_company = company_res[0][0] if company_res else None

        default_currency = None
        if default_company:
            currency_sql = """
                SELECT default_currency FROM `tabCompany` WHERE name = %s
            """
            currency_sql = apply_sql_permissions(currency_sql)

            currency_res = frappe.db.sql(
                currency_sql,
                (default_company,),
            )

            default_currency = (
                currency_res[0][0] if currency_res else None
            )

        default_currency = default_currency or "KES"

        symbol_sql = """
            SELECT symbol FROM `tabCurrency` WHERE name = %s
        """
        symbol_sql = apply_sql_permissions(symbol_sql)

        symbol_res = frappe.db.sql(
            symbol_sql,
            (default_currency,),
        )

        default_symbol = (
            symbol_res[0][0]
            if symbol_res and symbol_res[0][0]
            else default_currency
        )

        valuation_price = flt(item_data["valuation_rate"]) if item_data else 0

        if uom and item_data and uom != item_data["stock_uom"]:
            factor = _get_uom_conversion_factor(item_code, uom)
            if factor:
                valuation_price = valuation_price * factor

        return {
            "price": valuation_price,
            "currency": default_currency,
            "currency_symbol": default_symbol,
        }

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error fetching price for {item_code}",
        )
        return {
            "price": 0,
            "currency": "KES",
            "currency_symbol": "KES",
        }


def _get_uom_conversion_factor(item_code, uom):
    try:
        sql = """
            SELECT conversion_factor
            FROM `tabUOM Conversion Detail`
            WHERE parent = %s AND uom = %s
            LIMIT 1
        """
        sql = apply_sql_permissions(sql)

        res = frappe.db.sql(
            sql,
            (item_code, uom),
            as_dict=True,
        )

        return flt(res[0]["conversion_factor"]) if res else None

    except Exception:
        return None


def _calculate_price_from_default_uom(
    item_code,
    requested_uom,
    price_list,
    customer,
):
    try:
        item_sql = """
            SELECT stock_uom
            FROM `tabItem`
            WHERE name = %s
            LIMIT 1
        """
        item_sql = apply_sql_permissions(item_sql)

        item_res = frappe.db.sql(
            item_sql,
            (item_code,),
            as_dict=True,
        )

        if not item_res:
            return None

        default_uom = item_res[0]["stock_uom"]

        if requested_uom == default_uom:
            return None

        factor = _get_uom_conversion_factor(item_code, requested_uom)
        if not factor:
            return None

        if not price_list:
            price_list = get_price_list_with_customer_priority(customer)

        price_sql = """
            SELECT price_list_rate, currency
            FROM `tabItem Price`
            WHERE item_code = %s AND uom = %s AND selling = 1
        """

        params = [item_code, default_uom]

        if price_list and str(price_list).strip():
            price_sql += " AND price_list = %s"
            params.append(price_list)

        price_sql += " LIMIT 1"
        price_sql = apply_sql_permissions(price_sql)

        price_doc = frappe.db.sql(
            price_sql,
            tuple(params),
            as_dict=True,
        )

        if not price_doc and price_list:
            fallback_sql = """
                SELECT price_list_rate, currency
                FROM `tabItem Price`
                WHERE item_code = %s AND uom = %s AND selling = 1
                ORDER BY modified DESC
                LIMIT 1
            """
            fallback_sql = apply_sql_permissions(fallback_sql)

            price_doc = frappe.db.sql(
                fallback_sql,
                (item_code, default_uom),
                as_dict=True,
            )

        if price_doc:
            res = price_doc[0]

            calc_price = flt(res["price_list_rate"]) * factor

            symbol_sql = """
                SELECT symbol FROM `tabCurrency` WHERE name = %s
            """
            symbol_sql = apply_sql_permissions(symbol_sql)

            symbol_res = frappe.db.sql(
                symbol_sql,
                (res["currency"],),
            )

            symbol = (
                symbol_res[0][0]
                if symbol_res and symbol_res[0][0]
                else res["currency"]
            )

            return {
                "price": calc_price,
                "currency": res["currency"],
                "currency_symbol": symbol,
            }

        return None

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Error calculating price from default UOM for {item_code}",
        )
        return None


def get_price_list_with_customer_priority(customer=None):
    try:
        if customer:
            customer_sql = """
                SELECT default_price_list, customer_group
                FROM `tabCustomer` c
                WHERE c.name = %s
            """
            customer_sql = apply_sql_permissions(customer_sql)

            res = frappe.db.sql(
                customer_sql,
                (customer,),
            )

            if res and res[0][0]:
                return res[0][0]

            # Customer group fallback
            if res and len(res[0]) > 1 and res[0][1]:
                customer_group_sql = """
                    SELECT default_price_list
                    FROM `tabCustomer Group` cg
                    WHERE cg.name = %s
                """
                customer_group_sql = apply_sql_permissions(customer_group_sql)
                customer_group_res = frappe.db.sql(
                    customer_group_sql,
                    (res[0][1],),
                )
                if customer_group_res and customer_group_res[0][0]:
                    return customer_group_res[0][0]

        pos_doc = get_current_pos_profile()
        pos_pl = getattr(pos_doc, "selling_price_list", None)

        if pos_pl:
            return pos_pl

        # Selling Settings fallback
        selling_settings_sql = """
            SELECT selling_price_list
            FROM `tabSelling Settings` ss
            LIMIT 1
        """
        selling_settings_sql = apply_sql_permissions(selling_settings_sql)
        settings_res = frappe.db.sql(selling_settings_sql)
        if settings_res and settings_res[0][0]:
            return settings_res[0][0]

        return None

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            "Error getting price list with customer priority",
        )
        return None