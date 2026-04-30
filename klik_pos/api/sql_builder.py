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

def _find_clause_positions(sql_upper: str):
    positions = {}
    for clause in _CLAUSE_ORDER:
        match = re.search(rf"\b{clause}\b", sql_upper)
        if match:
            positions[clause] = match.start()
    return positions

def _extract_doctype_aliases(sql: str):
    """Extracts DocType and their aliases from SQL query. Returns dict {doctype: alias}"""
    aliases = {}
    
    from_pattern = r'FROM\s+`tab(\w+)`\s+(\w+)'
    for match in re.finditer(from_pattern, sql, re.IGNORECASE):
        doctype = match.group(1)
        alias = match.group(2)
        aliases[doctype] = alias
    
    join_pattern = r'JOIN\s+`tab(\w+)`\s+(\w+)'
    for match in re.finditer(join_pattern, sql, re.IGNORECASE):
        doctype = match.group(1)
        alias = match.group(2)
        aliases[doctype] = alias
    
    from_no_alias = r'FROM\s+`tab(\w+)`(?:\s+WHERE|\s+GROUP|\s+ORDER|\s+LIMIT|\s+$|\s+INNER|\s+LEFT|\s+RIGHT)'
    for match in re.finditer(from_no_alias, sql, re.IGNORECASE):
        doctype = match.group(1)
        if doctype not in aliases:
            aliases[doctype] = f"`tab{doctype}`"
    
    join_no_alias = r'JOIN\s+`tab(\w+)`(?:\s+ON|\s+WHERE|\s+GROUP|\s+ORDER|\s+LIMIT|\s+$)'
    for match in re.finditer(join_no_alias, sql, re.IGNORECASE):
        doctype = match.group(1)
        if doctype not in aliases:
            aliases[doctype] = f"`tab{doctype}`"
    
    return aliases

def apply_sql_permissions(sql: str):
    """Automatically injects Frappe permission conditions into SQL query."""
    try:
        doctype_aliases = _extract_doctype_aliases(sql)
        
        if not doctype_aliases:
            return sql
        
        permission_conditions = []
        
        for doctype, alias in doctype_aliases.items():
            try:
                rule = build_match_conditions(doctype)
                
                if rule:
                    if alias != f"`tab{doctype}`":
                        rule = rule.replace(f"`tab{doctype}`", alias)
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
        else:
            insert_pos = len(sql_clean)
            for clause in ["GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET"]:
                if clause in positions:
                    insert_pos = min(insert_pos, positions[clause])
            
            return (
                sql_clean[:insert_pos]
                + f" WHERE {permission_sql} "
                + sql_clean[insert_pos:]
            )
    
    except Exception as e:
        frappe.log_error(f"Error applying SQL permissions: {str(e)}\nSQL: {sql}", "SQL Permission Error")
        return sql