import frappe
from frappe import _


@frappe.whitelist()
def get_user_roles():
    """
    Get the current user's roles and determine if they have administrative privileges.
    """
    try:
        user = frappe.session.user
        user_roles = frappe.get_roles(user)

        # Check if user has administrative privileges
        admin_roles = ["Administrator", "Sales Manager", "System Manager"]
        is_admin_user = any(role in admin_roles for role in user_roles)

        return {
            "success": True,
            "data": {
                "user": user,
                "roles": user_roles,
                "is_admin_user": is_admin_user,
                "admin_roles": admin_roles
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error getting user roles")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_current_user_info():
    """
    Get comprehensive current user information including roles and POS profile.
    """
    try:
        user = frappe.session.user
        user_roles = frappe.get_roles(user)

        # Check if user has administrative privileges
        admin_roles = ["Administrator", "Sales Manager", "System Manager"]
        is_admin_user = any(role in admin_roles for role in user_roles)

        # Get user details
        user_doc = frappe.get_doc("User", user)

        # Get current POS profile
        from klik_pos.klik_pos.utils import get_current_pos_profile
        pos_profile = get_current_pos_profile()

        return {
            "success": True,
            "data": {
                "user": user,
                "full_name": user_doc.full_name or user,
                "email": user_doc.email,
                "roles": user_roles,
                "is_admin_user": is_admin_user,
                "admin_roles": admin_roles,
                "pos_profile": pos_profile.name if pos_profile else None,
                "pos_profile_name": pos_profile.name if pos_profile else None
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error getting current user info")
        return {
            "success": False,
            "error": str(e)
        }
