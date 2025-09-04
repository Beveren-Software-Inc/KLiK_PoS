import frappe
from frappe import _
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist()
def get_payment_modes():
    try:
        pos_doc = get_current_pos_profile()
        payment_modes = frappe.get_all(
            "POS Payment Method",
            filters={"parent": pos_doc.name},
            fields=["mode_of_payment", "default", "allow_in_returns"]
        )

        for mode in payment_modes:
            payment_type = frappe.get_value("Mode of Payment", mode["mode_of_payment"], "type")
            mode["type"] = payment_type or "Default"

        return {
            "success": True,
            "pos_profile": pos_doc.name,
            "data": payment_modes
        }

    except Exception as e:
        frappe.log_error(title="Get Payment Modes Error", message=str(e))
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_all_mode_of_payment():
    try:
        mode_of_payments = frappe.get_all(
            "Mode of Payment",
            filters={"enabled": 1},
            fields=["name", "type", "enabled"]
        )
        return mode_of_payments
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Fetch Mode of Payment Error")
        return {"success": False, "message": str(e)}

@frappe.whitelist()
def get_opening_entry_payment_summary():
    try:
        # Step 1: Get current POS profile
        pos_profile = get_current_pos_profile()
        if not pos_profile:
            return {"success": False, "error": "No POS Profile found for the current user."}

        # Step 2: Get active POS Opening Entry
        opening_entry = frappe.get_all(
            "POS Opening Entry",
            filters={
                "pos_profile": pos_profile.name,
                "user": frappe.session.user,
                "docstatus": 1,  # submitted
                "status": "Open"
            },
            fields=["name", "period_start_date"],
            order_by="creation desc",
            limit_page_length=1
        )

        if not opening_entry:
            return {"success": False, "error": "No open POS Opening Entry found."}

        opening_entry_name = opening_entry[0].name
        opening_start = opening_entry[0].period_start_date  # full datetime

        opening_date = opening_start.date()
        opening_time = opening_start.time()

        # Step 3: Fetch payment modes + opening balances
        opening_modes = frappe.get_all(
            "POS Opening Entry Detail",
            filters={"parent": opening_entry_name},
            fields=["mode_of_payment", "opening_amount"]
        )
        opening_time = opening_start.time().strftime("%H:%M:%S")
        print("Opening Modes:", opening_time)
        # Check if user has administrative privileges
        user_roles = frappe.get_roles(frappe.session.user)
        is_admin_user = any(role in ["Administrator", "Sales Manager", "System Manager"] for role in user_roles)

        # Step 4: Aggregate sales invoice payments
        if is_admin_user:
            # For admin users, aggregate all invoices for the day
            frappe.logger().info(f"Admin user {frappe.session.user} - aggregating all invoices for date: {opening_date}")
            sales_data = frappe.db.sql("""
                SELECT sip.mode_of_payment,
                       SUM(sip.amount) as total_amount,
                       COUNT(DISTINCT si.name) as transactions
                FROM `tabSales Invoice` si
                JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
                WHERE si.pos_profile = %s
                  AND si.docstatus = 1
                  AND si.posting_date = %s
                GROUP BY sip.mode_of_payment
            """, (pos_profile.name, opening_date), as_dict=True)
        else:
            # For regular users, aggregate only invoices for the current POS opening entry
            frappe.logger().info(f"Aggregating payments for POS opening entry: {opening_entry_name}")
            sales_data = frappe.db.sql("""
                SELECT sip.mode_of_payment,
                       SUM(sip.amount) as total_amount,
                       COUNT(DISTINCT si.name) as transactions
                FROM `tabSales Invoice` si
                JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
                WHERE si.custom_pos_opening_entry = %s
                  AND si.docstatus = 1
                GROUP BY sip.mode_of_payment
            """, (opening_entry_name), as_dict=True)



        sales_map = {row.mode_of_payment: row for row in sales_data}

        # Step 5: Merge both
        result = []
        for mode in opening_modes:
            mop = mode.mode_of_payment
            data = {
                "name": mop,
                "openingAmount": float(mode.opening_amount or 0.0),
                "amount": float(sales_map.get(mop, {}).get("total_amount", 0.0)),
                "transactions": int(sales_map.get(mop, {}).get("transactions", 0))
            }
            result.append(data)

        return {
            "success": True,
            "pos_profile": pos_profile.name,
            "opening_entry": opening_entry_name,
            "date": str(opening_date),
            "time": str(opening_time),
            "data": result
        }

    except Exception as e:
        frappe.log_error(title="Get Opening Entry Payment Summary Error", message=frappe.get_traceback())
        return {"success": False, "error": str(e)}
