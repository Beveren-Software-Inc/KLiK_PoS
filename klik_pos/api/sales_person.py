import frappe
from frappe import _
from frappe.query_builder import Table
from frappe.utils import now


def _get_active_salespeople(pos_profile=None):

    SalesPerson = Table("tabSales Person")
    Auth = Table("__Auth")
    POSProfileSalesPerson = Table("tabPOS Profile Sales Person")
    POSProfile = Table("tabPOS Profile")

    query = (
        frappe.qb.from_(SalesPerson)
        .join(POSProfileSalesPerson)
        .on(POSProfileSalesPerson.sales_person == SalesPerson.name)
        .join(POSProfile)
        .on(POSProfile.name == POSProfileSalesPerson.parent)
        .left_join(Auth)
        .on(
            (Auth.name == SalesPerson.name)
            & (Auth.doctype == "Sales Person")
            & (Auth.fieldname == "pos_pin")
        )
        .select(
            SalesPerson.name,
            SalesPerson.sales_person_name,
            Auth.name.as_("has_pin_auth"),
        )
        .where(SalesPerson.enabled == 1)
        .where(POSProfileSalesPerson.enabled == 1)
        .where(SalesPerson.name != "Sales Team")
        .where(POSProfile.disabled == 0)
        .orderby(SalesPerson.sales_person_name)
        .distinct()
    )

    query = query.where(POSProfile.name == pos_profile)

    rows = query.run(as_dict=True)

    return [
        {
            "salesperson": row.name,
            "salesperson_name": row.sales_person_name,
            "has_pin": bool(row.has_pin_auth),
            "pos_profile": pos_profile,
        }
        for row in rows
    ]


def _is_salesperson_allowed_for_profile(salesperson, pos_profile):
    if not salesperson or not pos_profile:
        return True

    return bool(
        frappe.db.exists(
            "POS Profile Sales Person",
            {"parent": pos_profile, "sales_person": salesperson},
        )
    )


@frappe.whitelist()
def list_salespeople(pos_profile=None):
    """Return active salespeople for POS selector UI."""
    try:
        return {
            "success": True,
            "salespeople": _get_active_salespeople(pos_profile=pos_profile),
        }
    except Exception:
        frappe.log_error(frappe.get_traceback(), _("List Salespeople Error"))
        return {
            "success": False,
            "message": _(
                "An error occurred while loading salespeople. Please try again."
            ),
        }


@frappe.whitelist()
def verify_pin(pin, device_id, salesperson=None, pos_profile=None):
    """
    Verify PIN against all Sales Persons and return matching salesperson
    """
    try:
        resolved_pos_profile = pos_profile
        sales_persons = _get_active_salespeople(pos_profile=resolved_pos_profile)
        if salesperson:
            sales_persons = [
                sp for sp in sales_persons if sp.get("salesperson") == salesperson
            ]
        if not sales_persons:
            return {"success": False, "message": _("No active sales persons found")}

        matched_salesperson = None
        for sp in sales_persons:
            if not sp.get("has_pin"):
                continue
            try:
                sales_person_doc = frappe.get_doc("Sales Person", sp.get("salesperson"))
                has_pin = sales_person_doc.pos_pin is not None
                if not has_pin:
                    continue

                stored_pin = sales_person_doc.get_password("pos_pin")
                if stored_pin and str(stored_pin) == str(pin):
                    matched_salesperson = sp
                    break

            except Exception:
                continue

        if matched_salesperson:
            cache_key_sp = f"pos_device:{device_id}:salesperson"
            cache_key_ts = f"pos_device:{device_id}:timestamp"

            # Set cache values (expire in 30 days = 2592000 seconds)
            frappe.cache().set_value(
                cache_key_sp,
                matched_salesperson.get("salesperson"),
                expires_in_sec=2592000,
            )
            frappe.cache().set_value(cache_key_ts, now(), expires_in_sec=2592000)

            return {
                "success": True,
                "salesperson": matched_salesperson.get("salesperson"),
                "salesperson_name": matched_salesperson.get("salesperson_name"),
            }
        else:
            return {"success": False, "message": _("Invalid PIN. Please try again.")}

    except Exception:
        frappe.log_error(frappe.get_traceback(), _("PIN Verification Error"))
        return {
            "success": False,
            "message": _("An error occurred during verification. Please try again."),
        }


@frappe.whitelist()
def get_remembered_salesperson(device_id, pos_profile=None):
    """
    Get the cached salesperson for this device
    """
    try:
        cache_key_sp = f"pos_device:{device_id}:salesperson"
        resolved_pos_profile = pos_profile

        cached_salesperson = frappe.cache().get_value(cache_key_sp)

        if cached_salesperson:
            sp_exists = frappe.db.exists(
                "Sales Person", {"name": cached_salesperson, "enabled": 1}
            )

            if sp_exists and _is_salesperson_allowed_for_profile(
                cached_salesperson, resolved_pos_profile
            ):
                sp_name = frappe.db.get_value(
                    "Sales Person", cached_salesperson, "sales_person_name"
                )

                # Update timestamp
                cache_key_ts = f"pos_device:{device_id}:timestamp"
                frappe.cache().set_value(cache_key_ts, now(), expires_in_sec=2592000)

                return {
                    "success": True,
                    "salesperson": cached_salesperson,
                    "salesperson_name": sp_name,
                }
            else:
                clear_device_cache(device_id)
                return {"success": False}

        return {"success": False}

    except Exception:
        frappe.log_error(frappe.get_traceback(), _("Get Remembered Salesperson Error"))
        return {"success": False}


@frappe.whitelist()
def clear_remembered_salesperson(device_id):
    """
    Clear the cached salesperson for this device
    """
    try:
        clear_device_cache(device_id)
        return {"success": True}
    except Exception:
        frappe.log_error(
            frappe.get_traceback(), _("Clear Remembered Salesperson Error")
        )
        return {"success": False}


def clear_device_cache(device_id):
    """
    Helper function to clear all cache keys for a device
    """
    cache_key_sp = f"pos_device:{device_id}:salesperson"
    cache_key_ts = f"pos_device:{device_id}:timestamp"

    frappe.cache().delete_value(cache_key_sp)
    frappe.cache().delete_value(cache_key_ts)


@frappe.whitelist()
def get_cache_stats(device_id):
    """
    Debug function to check cache status for a device
    """
    cache_key_sp = f"pos_device:{device_id}:salesperson"
    cache_key_ts = f"pos_device:{device_id}:timestamp"

    return {
        "salesperson": frappe.cache().get_value(cache_key_sp),
        "timestamp": frappe.cache().get_value(cache_key_ts),
    }
