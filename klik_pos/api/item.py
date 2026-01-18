import frappe
from erpnext.accounts.doctype.pricing_rule.pricing_rule import apply_pricing_rule
from erpnext.stock.doctype.batch.batch import get_batch_qty
from erpnext.stock.utils import get_stock_balance
from frappe import _

from klik_pos.api.sales_invoice import get_current_pos_opening_entry
from klik_pos.klik_pos.utils import get_current_pos_profile


def get_price_list_with_customer_priority(customer=None):
	"""
	Get price list with customer-first priority:
	1. Customer's default price list (if customer provided and has one)
	2. POS Profile's selling price list
	3. None (fallback to latest price)
	"""
	try:
		# First priority: Check customer's default price list
		if customer:
			customer_price_list = frappe.db.get_value("Customer", customer, "default_price_list")
			if customer_price_list:
				return customer_price_list

		# Second priority: POS Profile's selling price list
		pos_doc = get_current_pos_profile()
		pos_price_list = getattr(pos_doc, "selling_price_list", None)
		if pos_price_list:
			return pos_price_list

		# Fallback: No specific price list
		return None

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Error getting price list with customer priority")
		return None


def fetch_item_balance(item_code: str, warehouse: str) -> float:
	"""Get stock balance of an item from a warehouse."""
	try:
		return get_stock_balance(item_code, warehouse) or 0
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Error fetching balance for {item_code}")
		return 0


def _get_uom_conversion_factor(item_code: str, uom: str) -> float | None:
	"""Get conversion factor for a specific UOM from Item UOM table."""
	try:
		conversion_factor = frappe.db.get_value(
			"UOM",
			{"parent": item_code, "uom": uom},
			"conversion_factor",
		)
		return float(conversion_factor) if conversion_factor else None
	except Exception:
		return None


def _calculate_price_from_default_uom(
	item_code: str, requested_uom: str, price_list: str | None, customer: str | None
) -> dict | None:
	"""
	Calculate price for requested UOM from default UOM (stock_uom) using conversion factor.
	Returns None if calculation is not possible.
	This function directly queries for default UOM price to avoid recursion.
	"""
	try:
		item_doc = frappe.get_doc("Item", item_code)
		default_uom = item_doc.stock_uom

		# If requested UOM is already the default UOM, no conversion needed
		if requested_uom == default_uom:
			return None

		# Get conversion factor for requested UOM
		conversion_factor = _get_uom_conversion_factor(item_code, requested_uom)
		if not conversion_factor:
			return None

		# Determine the price list to use
		if not price_list:
			price_list = get_price_list_with_customer_priority(customer)

		# Directly query for default UOM price to avoid recursion
		default_uom_filters = {
			"item_code": item_code,
			"uom": default_uom,
			"selling": 1,
		}

		if price_list and price_list.strip():
			default_uom_filters["price_list"] = price_list

		default_price_doc = frappe.get_value(
			"Item Price",
			default_uom_filters,
			["price_list_rate", "currency"],
			as_dict=True,
		)

		# If no price found with price_list, try without price_list filter
		if not default_price_doc and price_list:
			default_uom_filters.pop("price_list", None)
			default_price_doc = frappe.get_value(
				"Item Price",
				default_uom_filters,
				["price_list_rate", "currency"],
				as_dict=True,
				order_by="modified desc",
			)

		if default_price_doc and default_price_doc.price_list_rate:
			# Calculate price: default_uom_price * conversion_factor
			calculated_price = float(default_price_doc.price_list_rate) * conversion_factor
			symbol = (
				frappe.db.get_value("Currency", default_price_doc.currency, "symbol")
				or default_price_doc.currency
			)
			return {
				"price": calculated_price,
				"currency": default_price_doc.currency,
				"currency_symbol": symbol,
			}

		return None
	except Exception:
		frappe.log_error(
			frappe.get_traceback(),
			f"Error calculating price from default UOM for {item_code}, UOM: {requested_uom}",
		)
		return None


def fetch_item_price(
	item_code: str, price_list: str | None = None, customer: str | None = None, uom: str | None = None
) -> dict:
	"""
	Get item price from Item Price doctype with customer-first priority.
	If price_list is provided, use it. Otherwise, determine price list using customer-first priority.
	If uom is provided, filter by that UOM. Otherwise, get latest price regardless of UOM.
	"""
	try:
		# Determine the price list to use
		if not price_list:
			price_list = get_price_list_with_customer_priority(customer)

		# Build base filters
		price_filters = {
			"item_code": item_code,
			"selling": 1,
		}

		# Add UOM filter if provided
		if uom:
			price_filters["uom"] = uom

		# If price_list is null or empty, get latest price without price_list filter
		if not price_list or price_list.strip() == "":
			price_doc = frappe.get_value(
				"Item Price",
				price_filters,
				["price_list_rate", "currency"],
				as_dict=True,
				order_by="modified desc",
			)

			if price_doc:
				symbol = frappe.db.get_value("Currency", price_doc.currency, "symbol") or price_doc.currency
				return {
					"price": price_doc.price_list_rate,
					"currency": price_doc.currency,
					"currency_symbol": symbol,
				}
			else:
				# If UOM was specified but no price found, calculate from default UOM
				if uom:
					calculated_price_info = _calculate_price_from_default_uom(
						item_code, uom, price_list, customer
					)
					if calculated_price_info:
						return calculated_price_info

				# Fallback to item's default price if no price found
				item_doc = frappe.get_doc("Item", item_code)
				default_currency = (
					frappe.get_value(
						"Company",
						frappe.defaults.get_user_default("Company"),
						"default_currency",
					)
					or "SAR"
				)
				default_symbol = (
					frappe.db.get_value("Currency", default_currency, "symbol") or default_currency
				)

				# If UOM is specified and different from stock_uom, apply conversion factor
				valuation_price = item_doc.valuation_rate or 0
				if uom and uom != item_doc.stock_uom:
					conversion_factor = _get_uom_conversion_factor(item_code, uom)
					if conversion_factor:
						valuation_price = float(valuation_price) * conversion_factor

				return {
					"price": valuation_price,
					"currency": default_currency,
					"currency_symbol": default_symbol,
				}

		# Normal price list lookup
		price_filters["price_list"] = price_list
		price_doc = frappe.get_value(
			"Item Price",
			price_filters,
			["price_list_rate", "currency"],
			as_dict=True,
		)

		if price_doc:
			symbol = frappe.db.get_value("Currency", price_doc.currency, "symbol") or price_doc.currency
			return {
				"price": price_doc.price_list_rate,
				"currency": price_doc.currency,
				"currency_symbol": symbol,
			}
		else:
			# If UOM was specified but no price found, calculate from default UOM
			if uom:
				calculated_price_info = _calculate_price_from_default_uom(
					item_code, uom, price_list, customer
				)
				if calculated_price_info:
					return calculated_price_info

			# Fallback to item's default price if no price list entry found
			item_doc = frappe.get_doc("Item", item_code)
			default_currency = (
				frappe.get_value(
					"Company",
					frappe.defaults.get_user_default("Company"),
					"default_currency",
				)
				or "SAR"
			)
			default_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency

			# If UOM is specified and different from stock_uom, apply conversion factor
			valuation_price = item_doc.valuation_rate or 0
			if uom and uom != item_doc.stock_uom:
				conversion_factor = _get_uom_conversion_factor(item_code, uom)
				if conversion_factor:
					valuation_price = float(valuation_price) * conversion_factor

			return {
				"price": valuation_price,
				"currency": default_currency,
				"currency_symbol": default_symbol,
			}

	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Error fetching price for {item_code}")
		return {"price": 0, "currency": "SAR", "currency_symbol": "SAR"}


@frappe.whitelist(allow_guest=True)
def get_item_price_for_customer(item_code, customer=None, uom=None):
	"""
	Get item price for a specific customer using customer-first price list priority.
	This is used when adding items to cart or when customer changes.
	If uom is provided, filter by that UOM to ensure price matches the item's UOM.
	"""
	try:
		if not item_code:
			return {"success": False, "price": 0, "currency": "SAR", "currency_symbol": "SAR"}

		# Get price using customer-first priority, with UOM filter if provided
		price_info = fetch_item_price(item_code, customer=customer, uom=uom)

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
			"currency": "SAR",
			"currency_symbol": "SAR",
			"error": str(e),
		}


@frappe.whitelist(allow_guest=True)
def get_item_by_barcode(barcode: str):
	"""Get item details by barcode."""
	try:
		pos_doc = get_current_pos_profile()
		warehouse = pos_doc.warehouse
		price_list = pos_doc.selling_price_list

		item_code = frappe.db.sql(
			"""
            SELECT parent
            FROM `tabItem Barcode`
            WHERE barcode = %s
        """,
			barcode,
			as_dict=True,
		)

		if not item_code:
			item_code = frappe.db.sql(
				"""
                SELECT name
                FROM `tabItem`
                WHERE name = %s AND disabled = 0
            """,
				barcode,
				as_dict=True,
			)

		if not item_code:
			frappe.throw(_("Item not found for barcode: {0}").format(barcode))

		item_name = item_code[0].parent or item_code[0].name

		item_doc = frappe.get_doc("Item", item_name)

		balance = fetch_item_balance(item_name, warehouse)
		price_info = fetch_item_price(item_name, price_list)

		return {
			"item_code": item_name,
			"item_name": item_doc.item_name or item_name,
			"description": item_doc.description or "",
			"item_group": item_doc.item_group or "General",
			"price": price_info["price"],
			"currency": price_info["currency"],
			"currency_symbol": price_info["currency_symbol"],
			"available": balance,
			"image": item_doc.image,
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error fetching item by barcode: {barcode}")
		frappe.throw(_("Error fetching item by barcode: {0}").format(str(e)))


@frappe.whitelist(allow_guest=True)
def get_item_by_identifier(code: str):
	"""Resolve an item by barcode, batch number or serial number.
	Returns same structure as get_item_by_barcode."""
	try:
		if not code:
			frappe.throw(_("Identifier required"))

		pos_doc = get_current_pos_profile()
		warehouse = pos_doc.warehouse
		price_list = pos_doc.selling_price_list

		matched_type = None
		matched_value = None

		# 1) Try Item Barcode
		item_row = frappe.db.sql(
			"""
            SELECT parent as item_code
            FROM `tabItem Barcode`
            WHERE barcode = %s
            """,
			code,
			as_dict=True,
		)
		if item_row:
			matched_type = "barcode"
			matched_value = code

		# 2) Try Batch by batch_id or name
		if not item_row:
			item_row = frappe.db.sql(
				"""
                SELECT b.item as item_code
                FROM `tabBatch` b
                WHERE b.batch_id = %s OR b.name = %s
                """,
				(code, code),
				as_dict=True,
			)
			if item_row:
				matched_type = "batch"
				matched_value = code

		# 3) Try Serial No
		if not item_row:
			# In ERPNext, the Serial No doctype has field name=serial_no; item_code links to Item
			item_row = frappe.db.sql(
				"""
                SELECT s.item_code as item_code
                FROM `tabSerial No` s
                WHERE s.name = %s OR s.serial_no = %s
                """,
				(code, code),
				as_dict=True,
			)
			if item_row:
				matched_type = "serial"
				matched_value = code

		if not item_row:
			frappe.throw(_("Item not found for identifier: {0}").format(code))

		item_code = item_row[0].get("item_code")
		if not item_code:
			frappe.throw(_("Invalid identifier mapping for: {0}").format(code))

		item_doc = frappe.get_doc("Item", item_code)
		balance = fetch_item_balance(item_code, warehouse)
		price_info = fetch_item_price(item_code, price_list)

		return {
			"item_code": item_code,
			"item_name": item_doc.item_name or item_code,
			"description": item_doc.description or "",
			"item_group": item_doc.item_group or "General",
			"price": price_info["price"],
			"currency": price_info["currency"],
			"currency_symbol": price_info["currency_symbol"],
			"available": balance,
			"image": item_doc.image,
			"matched_type": matched_type,
			"matched_value": matched_value,
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error fetching item by identifier: {code}")
		frappe.throw(_("Error fetching item by identifier: {0}").format(str(e)))


def _get_pos_context():
	"""Get POS profile and warehouse context with safe fallbacks."""
	try:
		pos_doc = get_current_pos_profile()
	except Exception:
		frappe.log_error(frappe.get_traceback(), "get_current_pos_profile failed")
		pos_doc = frappe._dict({})

	warehouse = getattr(pos_doc, "warehouse", None)
	if not warehouse:
		try:
			default_company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
				"Global Defaults", "default_company"
			)
			warehouse = frappe.db.get_value("Company", default_company, "default_warehouse")
		except Exception:
			warehouse = None
	if not warehouse:
		try:
			any_wh = frappe.get_all("Warehouse", filters={"is_group": 0}, fields=["name"], limit=1)
			warehouse = any_wh[0]["name"] if any_wh else None
		except Exception:
			warehouse = None

	price_list = getattr(pos_doc, "selling_price_list", None)
	hide_unavailable = getattr(pos_doc, "hide_unavailable_items", False)

	return pos_doc, warehouse, price_list, hide_unavailable


def _fetch_batch_stock(item_codes: list, warehouse: str) -> dict:
	"""Fetch stock balances for multiple items in optimized batch queries."""
	if not item_codes or not warehouse:
		return {}

	stock_map = {}

	# Use SQL to get stock from Bin table in batch
	try:
		placeholders = ", ".join(["%s"] * len(item_codes))
		sql = f"""
			SELECT item_code, actual_qty
			FROM `tabBin`
			WHERE item_code IN ({placeholders})
			AND warehouse = %s
		"""
		params = [*item_codes, warehouse]
		results = frappe.db.sql(sql, params, as_dict=True)

		for row in results:
			stock_map[row["item_code"]] = row["actual_qty"] or 0

		# Items not in Bin have 0 stock
		for item_code in item_codes:
			if item_code not in stock_map:
				stock_map[item_code] = 0

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Batch stock fetch error")
		# Fallback to individual queries
		for item_code in item_codes:
			stock_map[item_code] = fetch_item_balance(item_code, warehouse)

	return stock_map


def _fetch_batch_prices(item_codes: list, price_list: str | None, uom_map: dict) -> dict:
	"""Fetch prices for multiple items in optimized batch queries."""
	if not item_codes:
		return {}

	price_map = {}

	try:
		# Get default currency
		default_currency = (
			frappe.get_value(
				"Company",
				frappe.defaults.get_user_default("Company"),
				"default_currency",
			)
			or "SAR"
		)
		default_symbol = frappe.db.get_value("Currency", default_currency, "symbol") or default_currency

		# Build query for Item Price
		placeholders = ", ".join(["%s"] * len(item_codes))

		if price_list and price_list.strip():
			# Try with price list first
			sql = f"""
				SELECT item_code, price_list_rate, currency, uom
				FROM `tabItem Price`
				WHERE item_code IN ({placeholders})
				AND price_list = %s
				AND selling = 1
			"""
			params = [*item_codes, price_list]
		else:
			sql = f"""
				SELECT item_code, price_list_rate, currency, uom
				FROM `tabItem Price`
				WHERE item_code IN ({placeholders})
				AND selling = 1
				ORDER BY modified DESC
			"""
			params = item_codes

		results = frappe.db.sql(sql, params, as_dict=True)

		# Build price map - prefer prices matching the item's UOM
		for row in results:
			item_code = row["item_code"]
			item_uom = uom_map.get(item_code, "Nos")

			# If we already have a price for this item, only replace if UOM matches better
			if item_code in price_map:
				existing_uom_match = price_map[item_code].get("uom") == item_uom
				new_uom_match = row.get("uom") == item_uom
				if not new_uom_match or existing_uom_match:
					continue

			symbol = frappe.db.get_value("Currency", row["currency"], "symbol") or row["currency"]
			price_map[item_code] = {
				"price": row["price_list_rate"] or 0,
				"currency": row["currency"] or default_currency,
				"currency_symbol": symbol or default_symbol,
				"uom": row.get("uom"),
			}

		# For items without prices, use default values
		for item_code in item_codes:
			if item_code not in price_map:
				price_map[item_code] = {
					"price": 0,
					"currency": default_currency,
					"currency_symbol": default_symbol,
				}

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Batch price fetch error")
		# Fallback to individual queries
		for item_code in item_codes:
			uom = uom_map.get(item_code, "Nos")
			price_map[item_code] = fetch_item_price(item_code, price_list, uom=uom)

	return price_map


def _coerce_limit_offset(limit, offset) -> tuple[int, int]:
	"""Coerce query params to ints and apply safety caps."""
	try:
		limit_int = int(limit) if limit else 1000
		offset_int = int(offset) if offset else 0
	except (ValueError, TypeError):
		limit_int = 1000
		offset_int = 0

	# Cap limit to prevent abuse
	return min(limit_int, 2000), max(offset_int, 0)


def _get_item_select_fields() -> str:
	"""Build SELECT fields for Item query, including optional pharmacy fields."""
	select_fields = (
		"i.name, i.item_name, i.description, i.item_group, i.image, i.stock_uom, "
		"i.custom_strength, i.custom_pharmaceutical_form, i.custom_number_of_pack, "
		"i.custom_pack_size, i.custom_route_of_administration"
	)

	# Optional pharmacy field (may not exist on all installs)
	if frappe.db.has_column("Item", "custom_active_substances"):
		select_fields += ", i.custom_active_substances"

	return select_fields


def _build_base_and_count_queries(select_fields: str, hide_unavailable: bool) -> tuple[list[str], list[str]]:
	"""Build the base SQL and count SQL (as list parts) depending on stock filtering mode."""
	if hide_unavailable:
		base_query = [
			f"SELECT DISTINCT {select_fields}",
			"FROM `tabItem` i",
			"INNER JOIN `tabBin` b ON i.name = b.item_code",
			"WHERE i.disabled = 0",
			"AND i.is_stock_item = 1",
			"AND b.actual_qty > 0",
		]
		count_query = [
			"SELECT COUNT(DISTINCT i.name) as total",
			"FROM `tabItem` i",
			"INNER JOIN `tabBin` b ON i.name = b.item_code",
			"WHERE i.disabled = 0",
			"AND i.is_stock_item = 1",
			"AND b.actual_qty > 0",
		]
	else:
		base_query = [
			f"SELECT DISTINCT {select_fields}",
			"FROM `tabItem` i",
			"WHERE i.disabled = 0",
			"AND i.is_stock_item = 1",
		]
		count_query = [
			"SELECT COUNT(DISTINCT i.name) as total",
			"FROM `tabItem` i",
			"WHERE i.disabled = 0",
			"AND i.is_stock_item = 1",
		]

	return base_query, count_query


def _append_item_group_filters(
	base_query: list[str],
	count_query: list[str],
	params_list: list[object],
	count_params: list[object],
	pos_doc,
):
	"""Append POS Profile item group filters to both base and count queries."""
	if getattr(pos_doc, "item_groups", None):
		item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
		if item_group_names:
			placeholders = ", ".join(["%s"] * len(item_group_names))
			base_query.append(f"AND i.item_group IN ({placeholders})")
			count_query.append(f"AND i.item_group IN ({placeholders})")
			params_list.extend(item_group_names)
			count_params.extend(item_group_names)


def _append_category_filter(
	base_query: list[str],
	count_query: list[str],
	params_list: list[object],
	count_params: list[object],
	category: str | None,
):
	"""Append a direct Item Group filter (overrides POS groups) if category is provided."""
	if category and category != "all":
		base_query.append("AND i.item_group = %s")
		count_query.append("AND i.item_group = %s")
		params_list.append(category)
		count_params.append(category)


def _append_search_filter(
	query_parts: list[str],
	params: list[object],
	search: str | None,
):
	"""Append search condition (name, item_name, description, barcode) to a query."""
	if not (search and search.strip()):
		return

	search_term = f"%{search.strip()}%"
	search_condition = """
				AND (
					i.name LIKE %s
					OR i.item_name LIKE %s
					OR i.description LIKE %s
					OR EXISTS (
						SELECT 1 FROM `tabItem Barcode` ib
						WHERE ib.parent = i.name AND ib.barcode LIKE %s
					)
				)
			"""
	query_parts.append(search_condition)
	params.extend([search_term, search_term, search_term, search_term])


def _get_total_count(count_query: list[str], count_params: list[object]) -> int:
	count_sql = "\n".join(count_query)
	total_result = frappe.db.sql(count_sql, tuple(count_params), as_dict=True)
	return total_result[0]["total"] if total_result else 0


def _get_unfiltered_total_count(pos_doc, category: str | None, search: str | None) -> int:
	"""
	Count total items matching filters WITHOUT stock/bin filters.
	This is used when hide_unavailable_items is enabled to show the real total.
	"""
	unfiltered_count_query = [
		"SELECT COUNT(DISTINCT i.name) as total",
		"FROM `tabItem` i",
		"WHERE i.disabled = 0",
		"AND i.is_stock_item = 1",
	]
	unfiltered_count_params: list[object] = []

	# Apply item group filter from POS profile
	if getattr(pos_doc, "item_groups", None):
		item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
		if item_group_names:
			placeholders = ", ".join(["%s"] * len(item_group_names))
			unfiltered_count_query.append(f"AND i.item_group IN ({placeholders})")
			unfiltered_count_params.extend(item_group_names)

	# Apply category filter if specified
	if category and category != "all":
		unfiltered_count_query.append("AND i.item_group = %s")
		unfiltered_count_params.append(category)

	# Apply search filter if specified
	_append_search_filter(unfiltered_count_query, unfiltered_count_params, search)

	unfiltered_count_sql = "\n".join(unfiltered_count_query)
	unfiltered_total_result = frappe.db.sql(
		unfiltered_count_sql, tuple(unfiltered_count_params), as_dict=True
	)
	return unfiltered_total_result[0]["total"] if unfiltered_total_result else 0


def _fetch_primary_barcodes(item_codes: list[str]) -> dict[str, str]:
	"""Fetch one (primary/first) barcode per item in a single query."""
	barcode_map: dict[str, str] = {}
	try:
		barcode_results = frappe.get_all(
			"Item Barcode",
			filters={"parent": ["in", item_codes]},
			fields=["parent", "barcode"],
			limit=0,
		)
		for barcode_row in barcode_results:
			item_code = barcode_row.get("parent")
			if item_code and item_code not in barcode_map:
				barcode_map[item_code] = barcode_row.get("barcode")
	except Exception:
		frappe.log_error(frappe.get_traceback(), "Error fetching item barcodes for POS")
	return barcode_map


def _build_enriched_items(
	items: list[dict],
	stock_map: dict[str, float],
	price_map: dict[str, dict],
	barcode_map: dict[str, str],
	hide_unavailable: bool,
) -> list[dict]:
	"""Convert raw item rows into the SPA payload shape."""
	enriched_items: list[dict] = []

	for item in items:
		item_code = item["name"]
		balance = stock_map.get(item_code, 0)

		# Skip items with no stock if hide_unavailable is enabled
		if hide_unavailable and balance <= 0:
			continue

		default_uom = item.get("stock_uom", "Nos")
		price_info = price_map.get(item_code, {"price": 0, "currency": "SAR", "currency_symbol": "SAR"})
		primary_barcode = barcode_map.get(item_code)

		enriched_item = {
			"id": item_code,
			"name": item.get("item_name") or item_code,
			"description": item.get("description", ""),
			"category": item.get("item_group", "General"),
			"price": price_info["price"],
			"currency": price_info["currency"],
			"currency_symbol": price_info["currency_symbol"],
			"available": balance,
			"image": item.get("image"),
			"sold": 0,
			"preparationTime": 10,
			"uom": default_uom,
			"barcode": primary_barcode,
		}

		# Add pharmacy fields if they exist (from beveren_health app)
		if item.get("custom_strength"):
			enriched_item["custom_strength"] = item.get("custom_strength")
		if item.get("custom_pharmaceutical_form"):
			enriched_item["custom_pharmaceutical_form"] = item.get("custom_pharmaceutical_form")
		if item.get("custom_number_of_pack") is not None:
			enriched_item["custom_number_of_pack"] = item.get("custom_number_of_pack")
		if item.get("custom_pack_size"):
			enriched_item["custom_pack_size"] = item.get("custom_pack_size")
		if item.get("custom_route_of_administration"):
			enriched_item["custom_route_of_administration"] = item.get("custom_route_of_administration")
		if item.get("custom_active_substances"):
			enriched_item["custom_active_substances"] = item.get("custom_active_substances")

		enriched_items.append(enriched_item)

	return enriched_items


@frappe.whitelist(allow_guest=True)
def get_items_with_balance_and_price(
	limit: int = 1000,
	offset: int = 0,
	search: str | None = None,
	category: str | None = None,
):
	"""
	Get items with balance and price - optimized with pagination and server-side search.

	Args:
		limit: Number of items to return (default 1000)
		offset: Starting position for pagination (default 0)
		search: Search term to filter items by name, item_code, or barcode
		category: Filter by item group/category

	Returns:
		dict with items, total_count, and has_more flag
	"""
	limit, offset = _coerce_limit_offset(limit, offset)

	pos_doc, warehouse, price_list, hide_unavailable = _get_pos_context()

	try:
		select_fields = _get_item_select_fields()
		base_query, count_query = _build_base_and_count_queries(select_fields, hide_unavailable)

		params_list: list[object] = []
		count_params: list[object] = []

		# Warehouse filter for hide_unavailable
		if hide_unavailable and warehouse:
			base_query.append("AND b.warehouse = %s")
			count_query.append("AND b.warehouse = %s")
			params_list.append(warehouse)
			count_params.append(warehouse)

		_append_item_group_filters(base_query, count_query, params_list, count_params, pos_doc)
		_append_category_filter(base_query, count_query, params_list, count_params, category)
		_append_search_filter(base_query, params_list, search)
		_append_search_filter(count_query, count_params, search)

		# Get total count
		total_count = _get_total_count(count_query, count_params)

		# For hide_unavailable: show real total without stock filter
		if hide_unavailable:
			total_count = _get_unfiltered_total_count(pos_doc, category, search)

		# Add ordering and pagination
		base_query.append("ORDER BY i.item_name ASC")
		base_query.append("LIMIT %s OFFSET %s")
		params_list.extend([limit, offset])

		# Execute main query
		sql = "\n".join(base_query)
		items = frappe.db.sql(sql, tuple(params_list), as_dict=True)

		if not items:
			return {
				"items": [],
				"total_count": total_count,
				"has_more": False,
				"limit": limit,
				"offset": offset,
			}

		item_codes = [item["name"] for item in items]

		barcode_map = _fetch_primary_barcodes(item_codes)

		# Build UOM map for price fetching
		uom_map = {item["name"]: item.get("stock_uom", "Nos") for item in items}

		# Fetch stock and prices in batch (optimized)
		stock_map = _fetch_batch_stock(item_codes, warehouse)
		price_map = _fetch_batch_prices(item_codes, price_list, uom_map)

		enriched_items = _build_enriched_items(items, stock_map, price_map, barcode_map, hide_unavailable)

		has_more = (offset + len(enriched_items)) < total_count
		return {
			"items": enriched_items,
			"total_count": total_count,
			"has_more": has_more,
			"limit": limit,
			"offset": offset,
		}

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Get Combined Item Data Error")
		frappe.throw(_("Something went wrong while fetching item data."))


@frappe.whitelist(allow_guest=True)
def get_stock_updates():
	"""Get only stock updates for all items - lightweight endpoint with early filtering."""
	pos_doc = None
	try:
		current_opening_entry = get_current_pos_opening_entry()
		if current_opening_entry:
			opening_doc = frappe.get_doc("POS Opening Entry", current_opening_entry)
			pos_doc = frappe.get_doc("POS Profile", opening_doc.pos_profile)
	except Exception:
		pos_doc = None

	if not pos_doc:
		pos_doc = get_current_pos_profile()

	warehouse = pos_doc.warehouse
	hide_unavailable = getattr(pos_doc, "hide_unavailable_items", False)

	try:
		if hide_unavailable:
			# Use SQL to get only items with stock > 0
			base_query = """
                SELECT DISTINCT i.name
                FROM `tabItem` i
                INNER JOIN `tabBin` b ON i.name = b.item_code
                WHERE i.disabled = 0
                AND i.is_stock_item = 1
                AND b.warehouse = %s
                AND b.actual_qty > 0
            """

			params = [warehouse]
			if pos_doc.item_groups:
				item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
				if item_group_names:
					placeholders = ", ".join(["%s"] * len(item_group_names))
					base_query += f" AND i.item_group IN ({placeholders})"
					params.extend(item_group_names)

			base_query += " ORDER BY i.modified DESC"

			# Execute query
			items = frappe.db.sql(base_query, params, as_dict=True)
			item_codes = [item["name"] for item in items]
		else:
			# Original logic for when hide_unavailable is disabled
			filters = {"disabled": 0, "is_stock_item": 1}
			if pos_doc.item_groups:
				item_group_names = [d.item_group for d in pos_doc.item_groups if d.item_group]
				if item_group_names:
					filters["item_group"] = ["in", item_group_names]

			items = frappe.get_all("Item", filters=filters, fields=["name"], order_by="modified desc")
			item_codes = [item["name"] for item in items]

		# Optimized: Use batch processing with smaller chunks
		stock_updates = {}

		chunk_size = 100
		for i in range(0, len(item_codes), chunk_size):
			chunk = item_codes[i : i + chunk_size]
			for item_code in chunk:
				try:
					balance = get_stock_balance(item_code, warehouse) or 0
					if not hide_unavailable or balance > 0:
						stock_updates[item_code] = balance
				except Exception:
					if not hide_unavailable:
						stock_updates[item_code] = 0

		return stock_updates

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Get Stock Updates Error")
		return {}


@frappe.whitelist(allow_guest=True)
def get_item_stock(item_code: str):
	"""Get stock for a specific item - for individual updates."""
	pos_doc = get_current_pos_profile()
	warehouse = pos_doc.warehouse

	try:
		balance = fetch_item_balance(item_code, warehouse)
		return {"item_code": item_code, "available": balance}
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Get Item Stock Error for {item_code}")
		return {"item_code": item_code, "available": 0}


@frappe.whitelist(allow_guest=True)
def get_items_stock_batch(item_codes: str):
	"""Get stock for multiple specific items - optimized batch update with early filtering."""
	pos_doc = get_current_pos_profile()
	warehouse = pos_doc.warehouse
	hide_unavailable = getattr(pos_doc, "hide_unavailable_items", False)

	try:
		item_codes_list = [code.strip() for code in item_codes.split(",") if code.strip()]

		stock_updates = {}
		for item_code in item_codes_list:
			balance = fetch_item_balance(item_code, warehouse)
			if not hide_unavailable or balance > 0:
				stock_updates[item_code] = balance

		return stock_updates
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Get Items Stock Batch Error for {item_codes}")
		return {}


@frappe.whitelist(allow_guest=True)
def get_item_groups_for_pos():
	try:
		pos_profile = get_current_pos_profile()

		formatted_groups = []
		# Determine allowed item groups from POS Profile (if configured)
		item_group_names = []
		if pos_profile.item_groups:
			item_group_names = [d.item_group for d in pos_profile.item_groups if d.item_group]

			item_groups = frappe.get_all(
				"Item Group",
				filters={"name": ["in", item_group_names], "is_group": 0},
				fields=["name", "item_group_name", "parent_item_group"],
			)
		else:
			# Fallback: fetch all leaf item groups
			item_groups = frappe.get_all(
				"Item Group",
				filters={"is_group": 0},
				fields=["name", "item_group_name"],
				limit=100,
				order_by="modified desc",
			)

		# Compute total items constrained to POS Profile's allowed groups (if any)
		if item_group_names:
			total_item_count = frappe.db.count(
				"Item",
				filters={
					"disabled": 0,
					"is_stock_item": 1,
					"item_group": ["in", item_group_names],
				},
			)
		else:
			total_item_count = frappe.db.count("Item", filters={"disabled": 0, "is_stock_item": 1})

		for group in item_groups:
			item_count = frappe.db.count("Item", filters={"item_group": group["name"]})

			formatted_groups.append(
				{
					"id": group["name"],
					"name": group.get("item_group_name") or group["name"],
					"parent": group.get("parent_item_group") or None,
					"icon": "📦",
					"count": item_count,
				}
			)
		return {"groups": formatted_groups, "total_items": total_item_count}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Get Item Groups for POS Error {e!s}")
		frappe.throw(_("Something went wrong while fetching item group data."))


@frappe.whitelist()
def get_batch_nos_with_qty(item_code):
	"""
	Returns a list of dicts with batch numbers and their actual quantities
	for a given item code and warehouse.
	"""
	pos_doc = get_current_pos_profile()
	warehouse = pos_doc.warehouse

	if not item_code or not warehouse:
		return []

	# Get all batches for the item
	batches = frappe.get_all("Batch", filters={"item": item_code}, fields=["name", "batch_id", "expiry_date"])

	batch_qty_data = []
	for b in batches:
		qty = get_batch_qty(batch_no=b.name, warehouse=warehouse)
		if qty > 0:
			batch_qty_data.append({"batch_id": b.batch_id, "qty": qty})

	return batch_qty_data


@frappe.whitelist()
def get_item_uoms_and_prices(item_code, customer=None):
	"""
	Returns a list of UOMs and their prices for a given item code.
	Returns UOMs from Item UOM table and prices from Item Price doctype.
	Uses customer-first price list priority.
	"""
	if not item_code:
		return {}

	try:
		# Get the price list with customer-first priority
		price_list = get_price_list_with_customer_priority(customer)

		item_doc = frappe.get_doc("Item", item_code)

		uom_data = []

		# Get all UOMs from child table
		uom_names_in_table = set()
		for uom_row in item_doc.get("uoms", []):
			uom_names_in_table.add(uom_row.uom)
			uom_data.append(
				{
					"uom": uom_row.uom,
					"conversion_factor": uom_row.conversion_factor,
					"price": 0.0,
				}
			)

		# Add stock_uom if it's not already in the list (stock_uom has conversion_factor of 1.0)
		stock_uom = item_doc.stock_uom
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
			# First, check if there's a direct price entry for this UOM
			direct_price_filters = {
				"item_code": item_code,
				"uom": uom_info["uom"],
				"selling": 1,
			}
			if price_list and price_list.strip():
				direct_price_filters["price_list"] = price_list

			direct_price = frappe.db.get_value(
				"Item Price",
				direct_price_filters,
				"price_list_rate",
			)

			# If no direct price with price_list, try without price_list
			if not direct_price and price_list:
				direct_price_filters.pop("price_list", None)
				direct_price = frappe.db.get_value(
					"Item Price",
					direct_price_filters,
					"price_list_rate",
					order_by="modified desc",
				)

			if direct_price:
				# Use direct price if found
				uom_info["price"] = float(direct_price)
			else:
				# No direct price found - calculate from base UOM using conversion factor
				# Get base UOM price with customer-first priority
				base_price_info = fetch_item_price(
					item_code, price_list=price_list, customer=customer, uom=item_doc.stock_uom
				)

				if base_price_info and base_price_info.get("price", 0) > 0:
					converted_price = float(base_price_info["price"]) * uom_info["conversion_factor"]
					uom_info["price"] = converted_price
				else:
					# Last resort: use valuation_rate with conversion factor
					valuation_rate = frappe.db.get_value("Item", item_code, "valuation_rate") or 0
					converted_price = float(valuation_rate) * uom_info["conversion_factor"]
					uom_info["price"] = converted_price

		return {
			"base_uom": item_doc.stock_uom,
			"uoms": uom_data,
			"price_list_used": price_list,
		}
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Get Item UOMs Error for {item_code}")
		return {
			"base_uom": "Nos",
			"uoms": [{"uom": "Nos", "conversion_factor": 1.0, "price": 0.0}],
		}


@frappe.whitelist(allow_guest=True)
def get_serial_nos_for_item(item_code: str):
	"""
	Returns a list of available Serial Nos for a given item (and POS warehouse if set).
	"""
	if not item_code:
		return []

	try:
		pos_doc = get_current_pos_profile()
		warehouse = getattr(pos_doc, "warehouse", None)

		filters = {"item_code": item_code, "status": ["in", ["Active", "Available"]]}
		if warehouse:
			filters["warehouse"] = warehouse

		serials = frappe.get_all(
			"Serial No",
			filters=filters,
			fields=["name", "serial_no"],
			limit=500,
			order_by="modified desc",
		)

		# Normalize: prefer serial_no field if present; fallback to name
		result = []
		for s in serials:
			serial_value = s.get("serial_no") or s.get("name")
			if serial_value:
				result.append({"serial_no": serial_value})

		return result
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Get Serial Nos Error for {item_code}")
		return []


@frappe.whitelist(allow_guest=True)
def apply_pricing_rules_to_cart(cart_items, customer=None):
	"""
	Apply ERPNext pricing rules to cart items.

	Args:
		cart_items: List of cart items with item_code, qty, price, uom, etc.
		customer: Customer ID (optional)

	Returns:
		List of items with updated prices, discounts, and pricing rule info
	"""
	try:
		cart_items = _parse_cart_items(cart_items)
		if not cart_items:
			return []

		context = _build_pricing_context(customer)
		erpnext_items = _prepare_erpnext_items(cart_items, context)

		if not erpnext_items:
			return []
		pricing_results = _apply_pricing_rules(erpnext_items, context)

		result_items = _process_pricing_results(pricing_results, erpnext_items, cart_items, context)
		return result_items

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), f"Error applying pricing rules to cart: {e!s}")
		return cart_items


def _parse_cart_items(cart_items):
	"""Parse cart items from JSON string if needed."""
	if isinstance(cart_items, str):
		import json

		return json.loads(cart_items)
	return cart_items


def _build_pricing_context(customer=None):
	"""Build context object with POS profile, company, and customer details."""
	pos_profile = get_current_pos_profile()
	company = pos_profile.company if pos_profile else frappe.defaults.get_user_default("Company")

	context = {
		"pos_profile": pos_profile,
		"company": company,
		"warehouse": pos_profile.warehouse if pos_profile else None,
		"price_list": pos_profile.selling_price_list if pos_profile else None,
		"currency": frappe.get_cached_value("Company", company, "default_currency") or "SAR",
		"customer": customer,
		"customer_group": None,
		"territory": None,
	}

	if customer:
		customer_doc = frappe.get_cached_value(
			"Customer", customer, ["customer_group", "territory"], as_dict=True
		)
		if customer_doc:
			context["customer_group"] = customer_doc.customer_group
			context["territory"] = customer_doc.territory

	return context


def _prepare_erpnext_items(cart_items, context):
	"""Convert cart items to ERPNext pricing rule format."""
	erpnext_items = []

	for item in cart_items:
		item_code = item.get("id") or item.get("item_code")
		if not item_code:
			continue

		item_doc = frappe.get_cached_value("Item", item_code, ["item_group", "brand"], as_dict=True)

		if not item_doc:
			continue

		# Get original price from backend to pass to pricing rule
		# This ensures pricing rules work with correct base price
		item_uom = item.get("uom") or frappe.get_cached_value("Item", item_code, "stock_uom")
		# Use context for price_list and customer to ensure correct price calculation
		price_list = context.get("price_list")
		customer = context.get("customer")

		# First check for direct price entry for this UOM (same logic as get_item_uoms_and_prices)
		direct_price_filters = {
			"item_code": item_code,
			"uom": item_uom,
			"selling": 1,
		}
		if price_list and price_list.strip():
			direct_price_filters["price_list"] = price_list

		direct_price = frappe.db.get_value(
			"Item Price",
			direct_price_filters,
			"price_list_rate",
		)

		# If no direct price with price_list, try without price_list
		if not direct_price and price_list:
			direct_price_filters.pop("price_list", None)
			direct_price = frappe.db.get_value(
				"Item Price",
				direct_price_filters,
				"price_list_rate",
				order_by="modified desc",
			)

		if direct_price:
			# Use direct price if found
			base_price = float(direct_price)
		else:
			# No direct price - calculate from base UOM using conversion factor
			item_doc = frappe.get_doc("Item", item_code)
			stock_uom = item_doc.stock_uom

			# Get base UOM price
			base_price_info = fetch_item_price(
				item_code, price_list=price_list, customer=customer, uom=stock_uom
			)
			base_uom_price = (
				base_price_info.get("price", 0)
				if base_price_info.get("price", 0) > 0
				else item.get("price", 0)
			)

			# If UOM is different from stock_uom, apply conversion factor
			if item_uom and item_uom != stock_uom:
				conversion_factor = _get_uom_conversion_factor(item_code, item_uom)
				if conversion_factor:
					base_price = float(base_uom_price) * conversion_factor
				else:
					base_price = base_uom_price
			else:
				base_price = base_uom_price

		# Fallback to cart item price if calculation failed
		if base_price <= 0:
			base_price = item.get("price", 0)

		item_qty = item.get("quantity", 1)

		# Get conversion factor for the UOM to calculate stock_qty correctly
		item_doc_full = frappe.get_doc("Item", item_code)
		stock_uom = item_doc_full.stock_uom
		conversion_factor = 1.0
		if item_uom and item_uom != stock_uom:
			uom_conversion = _get_uom_conversion_factor(item_code, item_uom)
			if uom_conversion:
				conversion_factor = uom_conversion

		stock_qty = item_qty * conversion_factor

		erpnext_item = {
			"doctype": "Sales Invoice Item",
			"name": "",
			"item_code": item_code,
			"item_group": item_doc.item_group,
			"brand": item_doc.brand or "",
			"qty": item_qty,
			"stock_qty": stock_qty,  # filter_pricing_rules uses stock_qty for filtering
			"price_list_rate": base_price,  # Use calculated price with UOM conversion
			"uom": item_uom,
			"conversion_factor": conversion_factor,
		}

		erpnext_items.append(erpnext_item)

	return erpnext_items


def _apply_pricing_rules(erpnext_items, context):
	"""Call ERPNext's pricing rule engine."""
	# Build args dict - always include customer_group and territory from customer
	args_dict = {
		"items": erpnext_items,
		"company": context["company"],
		"currency": context["currency"],
		"transaction_date": frappe.utils.today(),
		"transaction_type": "selling",
		"conversion_rate": 1.0,
		"plc_conversion_rate": 1.0,
	}

	# Always include customer if it exists
	if context.get("customer"):
		args_dict["customer"] = context["customer"]

	# Always include customer_group and territory if available (needed for pricing rule filtering)
	if context.get("customer_group"):
		args_dict["customer_group"] = context["customer_group"]
	if context.get("territory"):
		args_dict["territory"] = context["territory"]

	# Add other optional fields
	if context.get("price_list"):
		args_dict["price_list"] = context["price_list"]
	if context.get("warehouse"):
		args_dict["warehouse"] = context["warehouse"]

	args = frappe._dict(args_dict)

	try:
		results = apply_pricing_rule(args, doc=None)
	except Exception as e:
		import traceback

		frappe.log_error(
			message=f"Error in apply_pricing_rule: {e!s}\n{traceback.format_exc()}",
			title="Pricing Rule Error",
		)
		results = []

	return results


def _process_pricing_results(pricing_results, erpnext_items, cart_items, context):
	"""Process pricing rule results and map back to cart items."""
	result_items = []

	# Create a map from item_code to cart_item for quick lookup
	cart_item_map = {}
	for cart_item in cart_items:
		cart_item_code = cart_item.get("id") or cart_item.get("item_code")
		if cart_item_code:
			cart_item_map[cart_item_code] = cart_item

	# Process each pricing result - they correspond to erpnext_items by index
	for idx, pricing_result in enumerate(pricing_results):
		if idx >= len(erpnext_items):
			continue

		# Get the item_code from the corresponding erpnext_item
		erpnext_item = erpnext_items[idx]
		item_code = erpnext_item.get("item_code")

		if not item_code:
			continue

		# Find the matching cart item
		cart_item = cart_item_map.get(item_code)
		if not cart_item:
			continue

		# Check if pricing rule was applied
		has_rule = _has_pricing_rule(pricing_result)

		if not has_rule:
			# No pricing rule - get original price from backend
			result_items.extend(
				_handle_no_pricing_rule(
					erpnext_item,
					[cart_item],  # Pass single item as list
					context,
				)
			)
			continue

		# Pricing rule was applied - calculate discounted price
		processed_item = _calculate_discounted_price(cart_item, pricing_result, context)
		result_items.append(processed_item)

	# Add unprocessed cart items (items not in erpnext_items)
	processed_item_codes = {item.get("id") or item.get("item_code") for item in result_items}
	for cart_item in cart_items:
		cart_item_code = cart_item.get("id") or cart_item.get("item_code")
		if cart_item_code and cart_item_code not in processed_item_codes:
			result_items.append(cart_item)

	return result_items


def _has_pricing_rule(pricing_result):
	"""Check if pricing result contains a valid pricing rule."""
	pricing_rules_json = pricing_result.get("pricing_rules", "")
	has_rule = pricing_result.get("has_pricing_rule", 0)
	result = bool(pricing_rules_json and has_rule)

	return result


def _extract_pricing_rule_names(pricing_result):
	"""Extract pricing rule names from JSON string."""
	import json

	try:
		pricing_rules_json = pricing_result.get("pricing_rules", "")
		return json.loads(pricing_rules_json)
	except (json.JSONDecodeError, TypeError):
		return []


def _handle_no_pricing_rule(erpnext_item, cart_items, context):
	"""Handle items without pricing rules - return with original price."""
	item_code = erpnext_item.get("item_code")
	if not item_code:
		return []

	for cart_item in cart_items:
		cart_item_code = cart_item.get("id") or cart_item.get("item_code")
		if cart_item_code == item_code:
			item_uom = cart_item.get("uom")
			price_list = context.get("price_list")
			customer = context.get("customer")

			# Use same logic as _prepare_erpnext_items: check direct price first, then calculate
			direct_price_filters = {
				"item_code": cart_item_code,
				"uom": item_uom,
				"selling": 1,
			}
			if price_list and price_list.strip():
				direct_price_filters["price_list"] = price_list

			direct_price = frappe.db.get_value(
				"Item Price",
				direct_price_filters,
				"price_list_rate",
			)

			if not direct_price and price_list:
				direct_price_filters.pop("price_list", None)
				direct_price = frappe.db.get_value(
					"Item Price",
					direct_price_filters,
					"price_list_rate",
					order_by="modified desc",
				)

			if direct_price:
				original_price = float(direct_price)
			else:
				# Calculate from base UOM, but prefer cart item price if it's already set correctly
				cart_price = cart_item.get("price", 0)

				# If cart already has a price > 0, check if it makes sense for this UOM
				if cart_price > 0 and item_uom:
					item_doc = frappe.get_doc("Item", cart_item_code)
					stock_uom = item_doc.stock_uom

					# Get base UOM price to validate cart price
					base_price_info = fetch_item_price(
						cart_item_code, price_list=price_list, customer=customer, uom=stock_uom
					)
					base_uom_price = base_price_info.get("price", 0)

					if base_uom_price > 0:
						if item_uom != stock_uom:
							conversion_factor = _get_uom_conversion_factor(cart_item_code, item_uom)
							if conversion_factor:
								expected_price = float(base_uom_price) * conversion_factor
								# If cart price is close to expected (within 5%), use cart price
								if abs(cart_price - expected_price) / max(cart_price, expected_price) < 0.05:
									original_price = cart_price
								else:
									original_price = expected_price
							else:
								original_price = cart_price
						else:
							# Same UOM, use cart price if close to base price
							if abs(cart_price - base_uom_price) / max(cart_price, base_uom_price) < 0.05:
								original_price = cart_price
							else:
								original_price = base_uom_price
					else:
						# No base price found, use cart price
						original_price = cart_price
				else:
					# No cart price or UOM, calculate normally
					item_doc = frappe.get_doc("Item", cart_item_code)
					stock_uom = item_doc.stock_uom
					base_price_info = fetch_item_price(
						cart_item_code, price_list=price_list, customer=customer, uom=stock_uom
					)
					base_uom_price = (
						base_price_info.get("price", 0) if base_price_info.get("price", 0) > 0 else 0
					)

					if item_uom and item_uom != stock_uom:
						conversion_factor = _get_uom_conversion_factor(cart_item_code, item_uom)
						if conversion_factor and base_uom_price > 0:
							original_price = float(base_uom_price) * conversion_factor
						else:
							original_price = base_uom_price if base_uom_price > 0 else cart_price
					else:
						original_price = base_uom_price if base_uom_price > 0 else cart_price

			# Final fallback to cart item price
			if original_price <= 0:
				original_price = cart_item.get("price", 0)

			return [
				{
					**cart_item,
					"price": original_price,
					"original_price": original_price,
				}
			]

	return []


def _calculate_discounted_price(cart_item, pricing_result, context):
	"""Calculate final price after applying discounts."""
	cart_item_code = cart_item.get("id") or cart_item.get("item_code")
	item_uom = cart_item.get("uom")
	price_list = context.get("price_list")
	customer = context.get("customer")

	# Use same logic as _prepare_erpnext_items: check direct price first, then calculate
	direct_price_filters = {
		"item_code": cart_item_code,
		"uom": item_uom,
		"selling": 1,
	}
	if price_list and price_list.strip():
		direct_price_filters["price_list"] = price_list

	direct_price = frappe.db.get_value(
		"Item Price",
		direct_price_filters,
		"price_list_rate",
	)

	if not direct_price and price_list:
		direct_price_filters.pop("price_list", None)
		direct_price = frappe.db.get_value(
			"Item Price",
			direct_price_filters,
			"price_list_rate",
			order_by="modified desc",
		)

	if direct_price:
		original_price = float(direct_price)
	else:
		# Calculate from base UOM, but prefer cart item price if it's already set correctly
		cart_price = cart_item.get("price", 0)

		# If cart already has a price > 0, check if it makes sense for this UOM
		if cart_price > 0 and item_uom:
			item_doc = frappe.get_doc("Item", cart_item_code)
			stock_uom = item_doc.stock_uom

			# Get base UOM price to validate cart price
			base_price_info = fetch_item_price(
				cart_item_code, price_list=price_list, customer=customer, uom=stock_uom
			)
			base_uom_price = base_price_info.get("price", 0)

			if base_uom_price > 0:
				if item_uom != stock_uom:
					conversion_factor = _get_uom_conversion_factor(cart_item_code, item_uom)
					if conversion_factor:
						expected_price = float(base_uom_price) * conversion_factor
						# If cart price is close to expected (within 5%), use cart price
						if abs(cart_price - expected_price) / max(cart_price, expected_price) < 0.05:
							original_price = cart_price
						else:
							original_price = expected_price
					else:
						original_price = cart_price
				else:
					# Same UOM, use cart price if close to base price
					if abs(cart_price - base_uom_price) / max(cart_price, base_uom_price) < 0.05:
						original_price = cart_price
					else:
						original_price = base_uom_price
			else:
				# No base price found, use cart price
				original_price = cart_price
		else:
			# No cart price or UOM, calculate normally
			item_doc = frappe.get_doc("Item", cart_item_code)
			stock_uom = item_doc.stock_uom
			base_price_info = fetch_item_price(
				cart_item_code, price_list=price_list, customer=customer, uom=stock_uom
			)
			base_uom_price = base_price_info.get("price", 0) if base_price_info.get("price", 0) > 0 else 0

			if item_uom and item_uom != stock_uom:
				conversion_factor = _get_uom_conversion_factor(cart_item_code, item_uom)
				if conversion_factor and base_uom_price > 0:
					original_price = float(base_uom_price) * conversion_factor
				else:
					original_price = base_uom_price if base_uom_price > 0 else cart_price
			else:
				original_price = base_uom_price if base_uom_price > 0 else cart_price

	# Final fallback to cart item price
	if original_price <= 0:
		original_price = cart_item.get("price", 0)

	# Validate that pricing_result price_list_rate makes sense for the UOM
	# If pricing rule returns a price that's way off from expected UOM price,
	# it means ERPNext calculated discount for wrong UOM - recalculate using our original_price
	pricing_result_rate = pricing_result.get("price_list_rate")
	_has_pricing_rule = pricing_result.get("has_pricing_rule", 0)
	discount_percentage = pricing_result.get("discount_percentage", 0) or 0
	discount_amount = pricing_result.get("discount_amount", 0) or 0
	_pricing_rules_json = pricing_result.get("pricing_rules", "")

	if pricing_result_rate is not None and item_uom and original_price > 0:
		# If the pricing_result_rate is significantly different from our calculated original_price
		# (more than 50% difference), it's likely calculated for wrong UOM
		price_diff_ratio = abs(pricing_result_rate - original_price) / max(
			pricing_result_rate, original_price
		)
		if price_diff_ratio > 0.5:
			# Pricing rule returned price for wrong UOM, recalculate discount on correct UOM price
			# Extract discount info and apply to our correct original_price
			discount_percentage = pricing_result.get("discount_percentage", 0) or 0
			discount_amount = pricing_result.get("discount_amount", 0) or 0

			# Calculate what the discount should be based on the difference
			# If pricing_result_rate is much lower, calculate the discount percentage
			if pricing_result_rate < original_price:
				calculated_discount_pct = ((original_price - pricing_result_rate) / original_price) * 100
				# Use the calculated discount or the one from pricing_result
				effective_discount = (
					discount_percentage if discount_percentage > 0 else calculated_discount_pct
				)
				if effective_discount > 0:
					final_price = original_price * (1 - effective_discount / 100)
				elif discount_amount > 0:
					final_price = max(0, original_price - discount_amount)
				else:
					final_price = original_price
			else:
				# Use discount from pricing_result
				if discount_percentage > 0:
					final_price = original_price * (1 - discount_percentage / 100)
				elif discount_amount > 0:
					final_price = max(0, original_price - discount_amount)
				else:
					final_price = original_price

			# Return early with recalculated price
			final_discount_pct = (
				discount_percentage
				if discount_percentage > 0
				else ((original_price - final_price) / original_price * 100)
			)
			final_discount_amt = discount_amount if discount_amount > 0 else (original_price - final_price)

			return {
				**cart_item,
				"price": final_price,
				"original_price": original_price,
				"discount_percentage": final_discount_pct,
				"discount_amount": final_discount_amt,
				"pricing_rules": pricing_result.get("pricing_rules", ""),
				"has_pricing_rule": pricing_result.get("has_pricing_rule", 0),
				"free_item_data": pricing_result.get("free_item_data", []),
			}

	# Calculate final price based on pricing rule type
	final_price = _apply_discount_logic(original_price, pricing_result)

	# Build result item with all pricing information
	return {
		**cart_item,
		"price": final_price,
		"original_price": original_price,
		"discount_percentage": pricing_result.get("discount_percentage", 0) or 0,
		"discount_amount": pricing_result.get("discount_amount", 0) or 0,
		"pricing_rules": pricing_result.get("pricing_rules", ""),
		"has_pricing_rule": pricing_result.get("has_pricing_rule", 0),
		"free_item_data": pricing_result.get("free_item_data", []),
	}


def _apply_discount_logic(original_price, pricing_result):
	"""Apply discount based on pricing rule type."""
	pricing_rule_for = pricing_result.get("pricing_rule_for", "")
	discount_percentage = pricing_result.get("discount_percentage", 0) or 0
	discount_amount = pricing_result.get("discount_amount", 0) or 0
	price_list_rate = pricing_result.get("price_list_rate")

	if price_list_rate is not None:
		if pricing_rule_for == "Rate":
			# Explicitly Rate type - use the rate
			return price_list_rate
		elif price_list_rate != original_price:
			# Use it even if pricing_rule_for is not set correctly
			return price_list_rate

	# Apply discount based on type
	if pricing_rule_for == "Discount Percentage":
		# Use percentage discount
		if discount_percentage > 0:
			return original_price * (1 - discount_percentage / 100)
		# discount_amount is already calculated from percentage, don't subtract it again

	elif pricing_rule_for == "Discount Amount":
		# Use amount discount
		if discount_amount > 0:
			return max(0, original_price - discount_amount)

	# Fallback: try percentage first, then amount
	if discount_percentage > 0:
		return original_price * (1 - discount_percentage / 100)
	elif discount_amount > 0:
		return max(0, original_price - discount_amount)

	return original_price


def _add_unprocessed_items(result_items, cart_items):
	"""Add cart items that weren't processed by pricing rules."""
	processed_item_codes = {item.get("id") or item.get("item_code") for item in result_items}

	for cart_item in cart_items:
		cart_item_code = cart_item.get("id") or cart_item.get("item_code")
		if cart_item_code and cart_item_code not in processed_item_codes:
			result_items.append(cart_item)
