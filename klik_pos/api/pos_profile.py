

import frappe
from frappe import _
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist()
def get_pos_profiles_for_user():
    """
    Return a list of POS Profiles assigned to the current user via User Permissions or directly.
    """
    user = frappe.session.user

    # Get POS Profiles assigned to the user via User Permissions
    user_permissions = frappe.get_all("User Permission",
        filters={
            "user": user,
            "allow": "POS Profile"
        },
        fields=["for_value"]
    )

    pos_profiles = [p["for_value"] for p in user_permissions]

    # Fallback: if no user permissions exist, return all POS Profiles where user is in the 'users' table
    if not pos_profiles:
        profiles = frappe.get_all("POS Profile", filters={}, fields=["name", "disabled"])
        for p in profiles:
            if not p.disabled:
                user_list = frappe.get_all("POS Profile User",
                    filters={"parent": p.name, "user": user},
                    fields=["user"]
                )
                if user_list:
                    pos_profiles.append(p.name)

    return pos_profiles

@frappe.whitelist()
def get_pos_details():
    pos = get_current_pos_profile()
    business_type = pos.custom_business_type
    print_format = pos.custom_pos_printformat

    details = {
        "business_type": business_type,
        "print_format": print_format,
        "currency":pos.currency,
        "currency_symbol":frappe.db.get_value("Currency", pos.currency, "symbol") or pos.currency,
        "print_receipt_on_order_complete":pos.print_receipt_on_order_complete,
        "print_format":pos.custom_pos_printformat,
        "custom_use_scanner_fully":pos.custom_use_scanner_fully,
        "custom_allow_credit_sales":pos.custom_allow_credit_sales,
        "custom_allow_return":pos.custom_allow_return,
        
    }
    return details
