import re

import frappe
from frappe.desk.reportview import build_match_conditions

_CLAUSE_ORDER = [
    "WHERE",
    "GROUP BY",
    "HAVING",
    "ORDER BY",
    "LIMIT",
    "OFFSET",
]

_RESERVED_ALIAS_TOKENS = {
    "WHERE",
    "GROUP",
    "HAVING",
    "ORDER",
    "LIMIT",
    "OFFSET",
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
    "CROSS",
    "JOIN",
    "ON",
}


def _find_clause_positions(sql_upper: str):
    positions = {}
    for clause in _CLAUSE_ORDER:
        match = re.search(rf"\b{clause}\b", sql_upper)
        if match:
            positions[clause] = match.start()
    return positions


def _extract_doctype_aliases(sql: str, primary_only: bool = False):
    """Extract DocTypes and aliases from SQL query. Returns dict {doctype: alias}."""
    aliases = {}

    table_pattern = re.compile(
        r"\b(?:FROM|JOIN)\s+`tab([^`]+)`"
        r"(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?",
        re.IGNORECASE,
    )

    for match in table_pattern.finditer(sql):
        doctype = match.group(1)
        alias = match.group(2)

        if alias and alias.upper() in _RESERVED_ALIAS_TOKENS:
            alias = None

        aliases[doctype] = alias or f"`tab{doctype}`"

        if primary_only:
            break

    return aliases


def apply_sql_permissions(sql: str):
    """Automatically inject Frappe permission conditions into SQL query."""
    try:
        # Only apply permissions to the primary table, not subquery tables
        doctype_aliases = _extract_doctype_aliases(sql, primary_only=True)

        if not doctype_aliases:
            return sql

        permission_conditions = []

        for doctype, alias in doctype_aliases.items():
            try:
                rule = build_match_conditions(doctype)

                if rule:
                    if alias != f"`tab{doctype}`":
                        rule = rule.replace(f"`tab{doctype}`", alias)

                    rule = rule.replace("%", "%%")

                    permission_conditions.append(f"({rule})")

            except frappe.PermissionError:
                return "SELECT 1 WHERE 1=0"

        if not permission_conditions:
            return sql

        permission_sql = " AND ".join(permission_conditions)

        sql_clean = sql.strip()
        sql_upper = sql_clean.upper()

        positions = _find_clause_positions(sql_upper)

        if "WHERE" in positions:
            where_pos = positions["WHERE"]
            insert_pos = where_pos + len("WHERE")

            next_clauses = [pos for clause, pos in positions.items() if pos > where_pos]
            end_pos = min(next_clauses) if next_clauses else len(sql_clean)

            return (
                sql_clean[:insert_pos]
                + f" {permission_sql} AND "
                + sql_clean[insert_pos:end_pos]
                + sql_clean[end_pos:]
            )

        insert_pos = len(sql_clean)
        for clause in ["GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET"]:
            if clause in positions:
                insert_pos = min(insert_pos, positions[clause])

        return sql_clean[:insert_pos] + f" WHERE {permission_sql} " + sql_clean[insert_pos:]

    except Exception as e:
        frappe.log_error(
            f"Error applying SQL permissions: {str(e)}\nSQL: {sql}",
            "SQL Permission Error",
        )
        return sql
