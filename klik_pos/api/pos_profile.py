import frappe
from frappe import _

from klik_pos.api.sales_invoice import get_current_pos_opening_entry
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist()
def get_pos_profiles_for_user():
    """
    Return a list of POS Profiles assigned to the current user.

    Permission hierarchy:
    1. User Permissions (first level) - if exists, only return these profiles
    2. Applicable Users table (second level) - fallback if no User Permissions

    Returns profiles with an 'is_default' flag based on POS Profile User settings.
    """
    user = frappe.session.user

    # Check for User Permissions first (first-level permission)
    user_permission_profiles = _get_user_permission_profiles(user)

    if user_permission_profiles:
        return _build_profiles_with_defaults(
            user_permission_profiles, user, require_applicable_user=True
        )

    # Fall back to Applicable Users table (second-level permission)
    applicable_user_profiles = _get_applicable_user_profiles(user)
    return _build_profiles_with_defaults(
        applicable_user_profiles, user, require_applicable_user=False
    )


def _get_user_permission_profiles(user):
    """Get enabled POS Profiles from User Permissions."""
    user_permissions = frappe.get_all(
        "User Permission",
        filters={"user": user, "allow": "POS Profile"},
        fields=["for_value"],
    )

    if not user_permissions:
        return []

    profile_names = [p["for_value"] for p in user_permissions]

    # Get only enabled profiles
    all_profiles = frappe.get_all(
        "POS Profile",
        filters={"name": ["in", profile_names]},
        fields=["name", "disabled"],
    )

    return [p.name for p in all_profiles if not p.disabled]


def _get_applicable_user_profiles(user):
    """Get enabled POS Profiles where user is in Applicable Users table."""
    all_profiles = frappe.get_all(
        "POS Profile", filters={"disabled": 0}, fields=["name"]
    )

    profiles = []
    for profile in all_profiles:
        user_entry = frappe.get_all(
            "POS Profile User",
            filters={"parent": profile.name, "user": user},
            fields=["user"],
            limit=1,
        )
        if user_entry:
            profiles.append(profile.name)

    return profiles


def _build_profiles_with_defaults(profile_names, user, require_applicable_user=False):
    """
    Build list of profiles with default flags.

    Args:
        profile_names: List of profile names to process
        user: Current user
        require_applicable_user: If True, skip profiles where user is not in Applicable Users

    Returns:
        List of dicts with 'name' and 'is_default' keys
    """
    profiles_with_default = []

    for profile_name in profile_names:
        try:
            profile_data = _get_profile_default_status(profile_name, user)

            # Skip if user not in Applicable Users and it's required
            if require_applicable_user and not profile_data["in_applicable_users"]:
                frappe.logger().info(
                    f"User {user} has User Permission for {profile_name} "
                    f"but is not in Applicable Users - skipping"
                )
                continue

            profiles_with_default.append(
                {"name": profile_name, "is_default": profile_data["is_default"]}
            )

        except Exception as e:
            frappe.logger().error(
                f"Error getting details for POS Profile {profile_name}: {e}"
            )
            # Only add profile with is_default=False if not requiring applicable user
            if not require_applicable_user:
                profiles_with_default.append(
                    {"name": profile_name, "is_default": False}
                )

    return profiles_with_default


def _get_profile_default_status(profile_name, user):
    """
    Get default status for a profile and check if user is in Applicable Users.

    Returns:
        dict: {'is_default': bool, 'in_applicable_users': bool}
    """
    user_entry = frappe.get_all(
        "POS Profile User",
        filters={"parent": profile_name, "user": user},
        fields=["default"],
        limit=1,
    )

    in_applicable_users = bool(user_entry)
    is_default = False

    if user_entry:
        default_value = user_entry[0].get("default")
        # Handle both integer (0/1) and boolean values
        is_default = default_value in (1, True)

    return {"is_default": is_default, "in_applicable_users": in_applicable_users}


def _get_company_summary(company_name):
    """
    Return a compact summary of `Company`.
    """
    try:
        company = frappe.get_doc("Company", company_name)
        return {
            "name": company.name,
            "company_name": getattr(company, "company_name", None),
            "abbr": getattr(company, "abbr", None),
            "tax_id": getattr(company, "tax_id", None),
            "phone_no": getattr(company, "phone_no", None),
            "email": getattr(company, "email", None),
            "country": getattr(company, "country", None),
            "country_code": (
                frappe.db.get_value(
                    "Country", {"country_name": company.country}, "code"
                )
                or ""
            ).upper(),
            "default_currency": getattr(company, "default_currency", None),
        }
    except Exception as e:
        frappe.logger().warning(f"Could not fetch company {company_name}: {e}")
        return {}


@frappe.whitelist()
def get_pos_details():
    current_opening_entry = get_current_pos_opening_entry()
    if current_opening_entry:
        opening_doc = frappe.get_doc("POS Opening Entry", current_opening_entry)
        pos = frappe.get_doc("POS Profile", opening_doc.pos_profile)
    else:
        pos = get_current_pos_profile()

    details = pos.as_dict()
    if "applicable_for_users" in details:
        del details["applicable_for_users"]

    default_customer = None
    if pos.customer:
        customer_doc = frappe.get_doc("Customer", pos.customer)
        default_customer = {
            "id": customer_doc.name,
            "name": customer_doc.customer_name,
            "email": customer_doc.email_id or "",
            "phone": customer_doc.mobile_no or "",
            "customer_type": customer_doc.customer_type,
            "territory": customer_doc.territory,
            "customer_group": customer_doc.customer_group,
            "default_currency": customer_doc.default_currency,
            "is_walkin": getattr(customer_doc, "custom_is_walkin", 0),
            "tax_id": customer_doc.tax_id,
        }

    details.update({
        "company_summary": _get_company_summary(pos.company),
        "currency_symbol": frappe.db.get_value("Currency", pos.currency, "symbol") or pos.currency,
        "is_zatca_enabled": is_zatca_enabled(),
        "default_customer": default_customer,
        "current_opening_entry": current_opening_entry
    })

    return details


def is_zatca_enabled():
    pos_profile = get_current_pos_profile()
    company = pos_profile.company
    # meta = frappe.get_meta("Company")  # unused
    if frappe.db.has_column("Company", "custom_enable_zatca_e_invoicing"):
        return (
            frappe.db.get_value("Company", company, "custom_enable_zatca_e_invoicing")
            == 1
        )
    return False
