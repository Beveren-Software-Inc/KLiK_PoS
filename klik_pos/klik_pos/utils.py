

import frappe 

def get_current_pos_profile():
    user = frappe.session.user
    pos_profile = frappe.get_value(
            "POS Profile User",
            {"user": user},
            "parent"
        )
    
    pos_doc = frappe.get_doc("POS Profile", pos_profile)
    return pos_doc
    