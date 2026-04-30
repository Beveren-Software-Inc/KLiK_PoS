import frappe
from frappe import _
from frappe.utils import now


@frappe.whitelist()
def verify_pin(pin, device_id):
    """
    Verify PIN against all Sales Persons and return matching salesperson
    """
    try:
        sales_persons = frappe.get_all(
            "Sales Person",
            filters={
                "enabled": 1,
                "name": ["!=", "Sales Team"],
            },
            fields=["name", "sales_person_name"],
        )
        if not sales_persons:
            return {"success": False, "message": _("No active sales persons found")}

        matched_salesperson = None
        for sp in sales_persons:
            try:
                sales_person_doc = frappe.get_doc("Sales Person", sp.name)
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
                cache_key_sp, matched_salesperson.name, expires_in_sec=2592000
            )
            frappe.cache().set_value(cache_key_ts, now(), expires_in_sec=2592000)

            return {
                "success": True,
                "salesperson": matched_salesperson.name,
                "salesperson_name": matched_salesperson.sales_person_name,
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
def get_remembered_salesperson(device_id):
    """
    Get the cached salesperson for this device
    """
    try:
        cache_key_sp = f"pos_device:{device_id}:salesperson"

        cached_salesperson = frappe.cache().get_value(cache_key_sp)

        if cached_salesperson:
            sp_exists = frappe.db.exists(
                "Sales Person", {"name": cached_salesperson, "enabled": 1}
            )

            if sp_exists:
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
