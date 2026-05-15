def build_item_search_conditions(search: str, enhanced: bool) -> tuple[list[str], list]:
	"""Return (sql_clauses, params) to append to an item listing query.

	enhanced=True  — multi-token AND: every whitespace-delimited word must appear
	                 in at least one of item code, item name, description, or barcode.
	enhanced=False — single %term% LIKE across the same columns (legacy behaviour).

	The clauses are written for a query that aliases `tabItem` as `i`.
	"""
	if not search or not search.strip():
		return [], []

	tokens = search.strip().split() if enhanced else [search.strip()]

	clauses: list[str] = []
	params: list = []

	for token in tokens:
		term = f"%{token}%"
		clauses.append(
			"""AND (
				i.name LIKE %s
				OR i.item_name LIKE %s
				OR i.description LIKE %s
				OR EXISTS (
					SELECT 1 FROM `tabItem Barcode` ib
					WHERE ib.parent = i.name AND ib.barcode LIKE %s
				)
			)"""
		)
		params.extend([term, term, term, term])

	return clauses, params
