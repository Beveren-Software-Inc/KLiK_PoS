import frappe
from frappe.model.meta import get_meta

@frappe.whitelist()
def get_link_options(doctype, txt="", search_fields=None):
    meta = get_meta(doctype)
    
    fields_to_search = search_fields or (meta.search_fields if meta.search_fields else ["name"])
    if isinstance(fields_to_search, str):
        fields_to_search = [f.strip() for f in fields_to_search.split(",")]
    
    if "name" not in fields_to_search:
        fields_to_search.append("name")

    title_field = meta.get("title_field")
    display_fields = ["name as value"]
    if title_field and title_field != "name":
        display_fields.append(f"{title_field} as label")
    else:
        display_fields.append("name as label")

    try:
        results = frappe.db.get_list(
            doctype,
            filters={ "name": ["like", f"%{txt}%"] },
            or_filters=[[field, "like", f"%{txt}%"] for field in fields_to_search],
            fields=[f.strip() for f in display_fields],
            limit_page_length=20,
            as_list=False
        )
        return results
    except Exception:
        return []