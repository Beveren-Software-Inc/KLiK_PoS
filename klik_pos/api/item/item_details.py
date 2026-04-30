import frappe
from frappe import _
from frappe.utils import flt, get_datetime, getdate, today

from erpnext.stock.doctype.batch.batch import get_batch_qty
from klik_pos.klik_pos.utils import get_current_pos_profile

from ..sql_builder import apply_sql_permissions
from .item_price import fetch_item_price, get_price_list_with_customer_priority


@frappe.whitelist()
def get_batch_nos_with_qty(item_code):
    pos_doc = get_current_pos_profile()
    warehouse = pos_doc.warehouse

    if not item_code or not warehouse:
        return []

    batches = frappe.get_list(
        "Batch",
        filters={"item": item_code},
        fields=["name", "batch_id", "expiry_date"],
    )

    batch_qty_data = []
    for b in batches:
        qty = get_batch_qty(batch_no=b.name, warehouse=warehouse)
        if qty > 0:
            batch_qty_data.append({"batch_id": b.batch_id, "qty": qty})

    return batch_qty_data


@frappe.whitelist()
def get_item_uoms_and_prices(item_code, customer=None):
    if not item_code:
        return {}

    try:
        price_list = get_price_list_with_customer_priority(customer)

        item_list = frappe.get_list(
            "Item",
            filters={"name": item_code},
            fields=["stock_uom", "valuation_rate", "item_name"],
            limit=1,
        )

        if not item_list:
            return {}

        item_data = item_list[0]

        uom_entries = frappe.get_list(
            "UOM Conversion Detail",
            filters={"parent": item_code},
            fields=["uom", "conversion_factor"],
            ignore_permissions=True,
        )

        uom_data = []
        uom_names_in_table = set()

        for uom_row in uom_entries:
            uom_names_in_table.add(uom_row.uom)
            uom_data.append(
                {
                    "uom": uom_row.uom,
                    "conversion_factor": uom_row.conversion_factor,
                    "price": 0.0,
                }
            )

        stock_uom = item_data.stock_uom

        if stock_uom and stock_uom not in uom_names_in_table:
            uom_data.insert(
                0,
                {
                    "uom": stock_uom,
                    "conversion_factor": 1.0,
                    "price": 0.0,
                },
            )

        for uom_info in uom_data:
            price_sql = """
                SELECT price_list_rate
                FROM `tabItem Price`
                WHERE item_code = %s AND uom = %s AND selling = 1
                AND (price_list = %s OR %s IS NULL OR %s = '')
                ORDER BY CASE WHEN price_list = %s THEN 0 ELSE 1 END, modified DESC
                LIMIT 1
            """
            price_sql = apply_sql_permissions(price_sql)

            price = frappe.db.sql(
                price_sql,
                (
                    item_code,
                    uom_info["uom"],
                    price_list,
                    price_list,
                    price_list,
                    price_list,
                ),
            )

            if price:
                uom_info["price"] = flt(price[0][0])
            else:
                base_price_info = fetch_item_price(
                    item_code,
                    price_list=price_list,
                    customer=customer,
                    uom=stock_uom,
                )

                if base_price_info and flt(base_price_info.get("price", 0)) > 0:
                    uom_info["price"] = (
                        flt(base_price_info["price"])
                        * uom_info["conversion_factor"]
                    )
                else:
                    uom_info["price"] = (
                        flt(item_data.valuation_rate)
                        * uom_info["conversion_factor"]
                    )

        result = {
            "base_uom": stock_uom,
            "uoms": uom_data,
            "price_list_used": price_list,
        }

        return result

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Get Item UOMs Error for {item_code}",
        )
        return {
            "base_uom": None,
            "uoms": [],
            "price_list_used": None,
        }


@frappe.whitelist(allow_guest=True)
def get_serial_nos_for_item(item_code: str):
    if not item_code:
        return []

    try:
        pos_doc = get_current_pos_profile()
        warehouse = getattr(pos_doc, "warehouse", None)

        filters = {"item_code": item_code, "status": "Active"}

        if warehouse:
            filters["warehouse"] = warehouse

        serials = frappe.get_list(
            "Serial No",
            filters=filters,
            fields=["name", "serial_no"],
            limit=500,
            order_by="modified desc",
        )

        return [{"serial_no": s.serial_no or s.name} for s in serials]

    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"Get Serial Nos Error for {item_code}",
        )
        return []


@frappe.whitelist()
def get_full_pricing_and_batch_details(
    item_code, warehouse=None, customer=None
):
    if not item_code:
        return {}

    item_list = frappe.get_list(
        "Item",
        filters={"name": item_code},
        fields=[
            "item_name",
            "item_code",
            "standard_rate",
            "valuation_rate",
            "stock_uom",
            "brand",
            "description",
            "image",
            "has_batch_no",
            "has_serial_no",
        ],
        limit=1,
    )

    if not item_list:
        return {}

    item_info = item_list[0]

    today_date = getdate(today())
    to_datetime = get_datetime(str(today_date) + " 23:59:59")

    global_stock_query = """
        SELECT 
            SUM(actual_qty) as total_qty,
            SUM(stock_value) as total_value,
            AVG(valuation_rate) as avg_valuation_rate
        FROM `tabBin`
        WHERE item_code = %s
    """

    global_stock = frappe.db.sql(
        global_stock_query,
        (item_code,),
        as_dict=True,
    )

    global_stock_total = {
        "total_qty": flt(global_stock[0].total_qty) if global_stock else 0,
        "total_value": flt(global_stock[0].total_value) if global_stock else 0,
        "avg_valuation_rate": flt(global_stock[0].avg_valuation_rate) if global_stock else 0,
    }

    price_query = """
        SELECT price_list, price_list_rate AS rate, currency, uom, customer, valid_from, valid_upto, name
        FROM `tabItem Price`
        WHERE item_code = %s AND selling = 1 AND (customer = %s OR customer IS NULL OR customer = '')
    """
    price_query = apply_sql_permissions(price_query)

    price_list_records = frappe.db.sql(
        price_query,
        (item_code, customer),
        as_dict=True,
    )

    sle_query = """
        SELECT warehouse, actual_qty, stock_value_difference, valuation_rate,
               qty_after_transaction, voucher_type, batch_no, serial_no,
               serial_and_batch_bundle, has_batch_no, has_serial_no
        FROM `tabStock Ledger Entry`
        WHERE item_code = %s AND docstatus < 2 AND is_cancelled = 0
        AND posting_datetime <= %s
    """

    params = [item_code, to_datetime]

    if warehouse:
        sle_query += " AND warehouse = %s"
        params.append(warehouse)

    sle_query += " ORDER BY posting_datetime ASC, creation ASC"
    sle_query = apply_sql_permissions(sle_query)

    sle_entries = frappe.db.sql(
        sle_query,
        tuple(params),
        as_dict=True,
    )

    warehouse_map = {}
    latest_valuation_rate = flt(item_info.valuation_rate)
    serial_map = {}
    bundle_map = {}

    for entry in sle_entries:
        wh = entry.warehouse

        if wh not in warehouse_map:
            warehouse_map[wh] = {
                "bal_qty": 0.0,
                "bal_val": 0.0,
                "val_rate": 0.0,
            }

        qty_diff = flt(entry.actual_qty)

        if (
            entry.voucher_type == "Stock Reconciliation"
            and not any([
                entry.batch_no,
                entry.serial_no,
                entry.serial_and_batch_bundle,
            ])
        ):
            qty_diff = (
                flt(entry.qty_after_transaction)
                - flt(warehouse_map[wh]["bal_qty"])
            )

        warehouse_map[wh]["bal_qty"] += qty_diff
        warehouse_map[wh]["bal_val"] += flt(entry.stock_value_difference)

        if entry.valuation_rate:
            warehouse_map[wh]["val_rate"] = flt(entry.valuation_rate)
            latest_valuation_rate = flt(entry.valuation_rate)

        if entry.serial_no:
            for sn in entry.serial_no.split("\n"):
                sn = sn.strip()
                if sn:
                    if sn not in serial_map:
                        serial_map[sn] = {
                            "qty": 0.0,
                            "warehouse": wh,
                            "val_rate": 0.0,
                            "batch_no": entry.batch_no,
                            "bundle_id": entry.serial_and_batch_bundle,
                        }

                    serial_map[sn]["qty"] += qty_diff

                    if entry.valuation_rate:
                        serial_map[sn]["val_rate"] = flt(entry.valuation_rate)

                    if serial_map[sn]["warehouse"] != wh:
                        serial_map[sn]["warehouse"] = wh

        if entry.serial_and_batch_bundle:
            bundle_id = entry.serial_and_batch_bundle
            if bundle_id not in bundle_map:
                bundle_map[bundle_id] = {
                    "warehouse": wh,
                    "batch_no": entry.batch_no,
                    "serial_nos": [],
                    "qty": 0,
                }

            if not bundle_map[bundle_id]["serial_nos"]:
                bundle_details = frappe.db.sql("""
                    SELECT serial_no, batch_no, qty
                    FROM `tabSerial and Batch Entry`
                    WHERE parent = %s
                """, (bundle_id,), as_dict=True)

                for detail in bundle_details:
                    if detail.serial_no:
                        for sn in detail.serial_no.split("\n"):
                            sn = sn.strip()
                            if sn:
                                bundle_map[bundle_id]["serial_nos"].append(sn)
                                if sn not in serial_map:
                                    serial_map[sn] = {
                                        "qty": 0.0,
                                        "warehouse": wh,
                                        "val_rate": 0.0,
                                        "batch_no": detail.batch_no or entry.batch_no,
                                        "bundle_id": bundle_id,
                                    }
                                serial_map[sn]["qty"] += flt(detail.qty) * qty_diff
                    elif detail.batch_no:
                        bundle_map[bundle_id]["batch_no"] = detail.batch_no

            bundle_map[bundle_id]["qty"] += abs(qty_diff)

    total_bal_qty = sum(v["bal_qty"] for v in warehouse_map.values())
    total_bal_val = sum(v["bal_val"] for v in warehouse_map.values())

    effective_val_rate = (
        flt(total_bal_val) / flt(total_bal_qty)
        if flt(total_bal_qty)
        else latest_valuation_rate
    )

    batch_map = {}
    result_batches = []

    if item_info.has_batch_no:
        batch_sql = """
            SELECT warehouse, batch_no, SUM(actual_qty) AS qty, SUM(stock_value_difference) AS val
            FROM `tabStock Ledger Entry`
            WHERE item_code = %s AND docstatus < 2 AND is_cancelled = 0 
            AND batch_no != '' AND posting_datetime <= %s
        """

        b_params = [item_code, to_datetime]

        if warehouse:
            batch_sql += " AND warehouse = %s"
            b_params.append(warehouse)

        batch_sql += " GROUP BY batch_no, warehouse"

        bundle_sql = """
            SELECT sle.warehouse, sbe.batch_no, SUM(sbe.qty) AS qty, SUM(sbe.stock_value_difference) AS val
            FROM `tabStock Ledger Entry` sle
            JOIN `tabSerial and Batch Entry` sbe ON sbe.parent = sle.serial_and_batch_bundle
            WHERE sle.item_code = %s AND sle.docstatus < 2 AND sle.is_cancelled = 0 
            AND sle.has_batch_no = 1 AND sle.posting_datetime <= %s
        """

        if warehouse:
            bundle_sql += " AND sle.warehouse = %s"

        bundle_sql += " GROUP BY sbe.batch_no, sle.warehouse"

        batch_sql = apply_sql_permissions(batch_sql)
        bundle_sql = apply_sql_permissions(bundle_sql)

        entries = frappe.db.sql(
            batch_sql,
            tuple(b_params),
            as_dict=True,
        ) + frappe.db.sql(
            bundle_sql,
            tuple(b_params),
            as_dict=True,
        )

        for row in entries:
            key = (row.batch_no, row.warehouse)
            if key not in batch_map:
                batch_map[key] = {"qty": 0.0, "val": 0.0}
            batch_map[key]["qty"] += flt(row.qty)
            batch_map[key]["val"] += flt(row.val)

    batches_raw = frappe.get_list(
        "Batch",
        filters={"item": item_code},
        fields=["name", "expiry_date", "manufacturing_date"],
    )

    for b in batches_raw:
        for (bid, wh), bdata in batch_map.items():
            if bid == b.name and flt(bdata["qty"]) > 0:
                qty = flt(bdata["qty"])

                batch_serials = [
                    {"serial_no": sn, "warehouse": s["warehouse"], "val_rate": s["val_rate"]}
                    for sn, s in serial_map.items()
                    if s.get("batch_no") == bid and s["qty"] > 0
                ]

                result_batches.append(
                    {
                        "batch_id": b.name,
                        "qty": qty,
                        "val": flt(bdata["val"]),
                        "val_rate": (
                            flt(bdata["val"]) / qty
                            if qty
                            else effective_val_rate
                        ),
                        "expiry_date": b.expiry_date,
                        "manufacturing_date": b.manufacturing_date,
                        "warehouse": wh,
                        "serials": batch_serials,
                    }
                )

    active_prices = []

    for p in price_list_records:
        if (
            (p.valid_from and getdate(p.valid_from) > today_date)
            or (
                p.valid_upto
                and getdate(p.valid_upto) < today_date
            )
        ):
            continue

        note_sql = "SELECT note FROM `tabItem Price` WHERE name = %s"
        note_sql = apply_sql_permissions(note_sql)

        note_data = frappe.db.sql(note_sql, (p.name,)) or frappe.db.sql(
            apply_sql_permissions(
                "SELECT note FROM `tabItem Price` WHERE name = %s"
            ),
            (p.name,),
        )

        rate = flt(p.rate)
        margin = rate - effective_val_rate

        active_prices.append(
            {
                "price_list": p.price_list,
                "rate": rate,
                "currency": p.currency,
                "uom": p.uom,
                "customer": p.customer,
                "note": note_data[0][0] if note_data else None,
                "cost": effective_val_rate,
                "margin": margin,
                "margin_pct": (
                    (margin / effective_val_rate * 100)
                    if effective_val_rate
                    else 0
                ),
            }
        )

    serials_list = []
    if not item_info.has_batch_no:
        for sn, s_data in serial_map.items():
            if s_data["qty"] > 0:
                serial_entry = {
                    "serial_no": sn,
                    "warehouse": s_data["warehouse"],
                    "val_rate": s_data["val_rate"] or effective_val_rate,
                }
                serials_list.append(serial_entry)

    return {
        "item_name": item_info.item_name,
        "item_code": item_info.item_code,
        "standard_rate": item_info.standard_rate or 0,
        "valuation_rate": effective_val_rate,
        "uom": item_info.stock_uom,
        "brand": item_info.brand,
        "description": item_info.description,
        "image": item_info.image,
        "has_batch_no": item_info.has_batch_no,
        "has_serial_no": item_info.has_serial_no,
        "global_stock_total": global_stock_total,
        "total_bal_qty": total_bal_qty,
        "total_bal_val": total_bal_val,
        "price_lists": active_prices,
        "batches": result_batches if item_info.has_batch_no else [],
        "serials": serials_list,
        "warehouse_stock": [
            {
                "warehouse": wh,
                "bal_qty": flt(v["bal_qty"]),
                "bal_val": flt(v["bal_val"]),
                "val_rate": flt(v["val_rate"]),
            }
            for wh, v in warehouse_map.items()
            if v["bal_qty"] != 0
        ],
    }