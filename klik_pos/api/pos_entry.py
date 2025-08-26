

import frappe
import json
from klik_pos.klik_pos.utils import get_current_pos_profile
from frappe import _
from frappe.utils import now_datetime, today
import json
from frappe.utils import now_datetime, today
import frappe, json, traceback
from frappe.utils import now_datetime, today
from frappe import _
import frappe, json, traceback
from frappe.utils import now_datetime, today
from frappe import _


@frappe.whitelist()
def open_pos():
    """Check if the current user has an open POS Opening Entry."""
    user = frappe.session.user
    pos_profile = get_current_pos_profile().name

    if not pos_profile:
        return False

    # Look for a submitted POS Opening Entry with no linked closing entry
    open_entry = frappe.db.exists("POS Opening Entry", {
        "pos_profile": pos_profile,
        "user": user,
        "docstatus": 1,  # Submitted
        "pos_closing_entry": None
    })

    return True if open_entry else False


@frappe.whitelist()
def create_opening_entry():
    """
    Create a POS Opening Entry with balance details only.
    """
    try:
        data = frappe.local.form_dict
        if isinstance(data, str):
            data = json.loads(data)

        frappe.logger().info(f"POS Opening Entry Data Received: {data}")

        user = frappe.session.user

        # get pos profile
        pos_profile = get_current_pos_profile().name if get_current_pos_profile() else None
        company = frappe.defaults.get_user_default("Company")

        if not company:
            frappe.throw(_("No default company found for user {0}").format(user))
        if not pos_profile:
            frappe.throw(_("POS Profile could not be determined"))

        balance_details = data.get("balance_details") or data.get("opening_balance", [])
        if not balance_details:
            frappe.throw(_("At least one balance detail (mode of payment) is required"))

        # Check if an open entry exists
        existing = frappe.db.exists("POS Opening Entry", {
            "pos_profile": pos_profile,
            "user": user,
            "docstatus": 1,
            "pos_closing_entry": None
        })
        if existing:
            frappe.throw(_("You already have an open POS Opening Entry."))

        # Create the POS Opening Entry
        doc = frappe.new_doc("POS Opening Entry")
        doc.user = user
        doc.company = company
        doc.pos_profile = pos_profile
        doc.posting_date = today()
        doc.set_posting_time = 1
        doc.period_start_date = now_datetime()

        for row in balance_details:
            doc.append("balance_details", {
                "mode_of_payment": row.get("mode_of_payment"),
                "opening_amount": row.get("opening_amount")
            })

        doc.insert()
        doc.submit()

        return {
            "name": doc.name,
            "message": _("POS Opening Entry created successfully.")
        }

    except Exception as e:
        # Log error with full traceback in Error Log
        frappe.log_error(
            message=traceback.format_exc(),
            title="POS Opening Entry Creation Failed"
        )
        # Throw user-friendly message
        frappe.throw(_("Failed to create POS Opening Entry: {0}").format(str(e)))


def validate_opening_entry(doc, method):
    exists = frappe.db.exists(
        "POS Opening Entry",
        {
            "user": doc.user,
            "status": "Open",
        }
    )
    if exists:
        cashier_name = frappe.db.get_value("User", doc.user, "full_name") or doc.user
        frappe.throw(
            _("Cashier {0} already has an open entry: {1}").format(
                cashier_name, exists
            )
        )

@frappe.whitelist()
def create_closing_entry():
    """
    Create a POS Closing Entry for the current user's open POS Opening Entry.
    """
    try:
        data = frappe.local.form_dict
        if isinstance(data, str):
            data = json.loads(data)

        user = frappe.session.user
        frappe.logger().info(f"POS Closing Entry Data Received: {data}")

        # Get the open POS Opening Entry
        open_entry = frappe.get_all(
            "POS Opening Entry",
            filters={
                "user": user,
                "docstatus": 1,
                "status": "Open"
            },
            fields=["name", "pos_profile", "company", "period_start_date"]
        )

        if not open_entry:
            frappe.throw(_("No open POS Opening Entry found for user."))

        opening_entry = open_entry[0]
        opening_entry_name = opening_entry.name
        opening_start = opening_entry.period_start_date  # full datetime
        opening_date = opening_start.date()
        opening_time = opening_start.time().strftime("%H:%M:%S")
        
        # Step 3: Fetch payment modes + opening balances
        opening_modes = frappe.get_all(
            "POS Opening Entry Detail",
            filters={"parent": opening_entry_name},
            fields=["mode_of_payment", "opening_amount"]
        )
        opening_balance_map = {row.mode_of_payment: row.opening_amount for row in opening_modes}

        # closing_balance is a dict: {"Cash": 323, "Credit Card": 676}
        closing_balance = data.get("closing_balance", {})
        tax_data = data.get("taxes", [])

        if not closing_balance:
            frappe.throw(_("At least one closing balance entry is required."))

        # Step 4: Aggregate sales invoice payments for that day, starting from opening time
        sales_data = frappe.db.sql("""
            SELECT sip.mode_of_payment, 
                   SUM(sip.amount) as total_amount, 
                   COUNT(DISTINCT si.name) as transactions
            FROM `tabSales Invoice` si
            JOIN `tabSales Invoice Payment` sip ON si.name = sip.parent
            WHERE si.pos_profile = %s
              AND si.docstatus = 1
              AND si.posting_date = %s
              AND si.posting_time >= %s
            GROUP BY sip.mode_of_payment
        """, (opening_entry.pos_profile, opening_date, opening_time), as_dict=True)

        sales_map = {row.mode_of_payment: row.total_amount for row in sales_data}
        print("Sales Map:", opening_entry.name)
        # Create POS Closing Entry
        doc = frappe.new_doc("POS Closing Entry")
        doc.user = user
        doc.company = opening_entry.company
        doc.pos_profile = opening_entry.pos_profile
        doc.period_start_date = opening_start
        doc.period_end_date = now_datetime()
        doc.set_posting_time = 1
        doc.posting_date = today()
        doc.pos_opening_entry = opening_entry.name

        # Set totals
        doc.total_quantity = data.get("total_quantity")
        doc.net_total = data.get("net_total")
        doc.total_amount = data.get("total_amount")

        # Append to payment reconciliation
        for mode, closing_amount in closing_balance.items():
            opening_amount = opening_balance_map.get(mode, 0)
            expected_amount = sales_map.get(mode, 0)  # from SQL aggregation
            difference = float(closing_amount) - float(expected_amount)

            doc.append("payment_reconciliation", {
                "mode_of_payment": mode,
                "opening_amount": opening_amount,
                "expected_amount": expected_amount,
                "closing_amount": closing_amount,
                "difference": difference
            })

        # Append taxes
        for tax in tax_data:
            doc.append("taxes", {
                "account_head": tax.get("account_head"),
                "rate": tax.get("rate"),
                "amount": tax.get("amount")
            })

        # Submit the document
        doc.submit()

        # Link back to POS Opening Entry
        frappe.db.set_value(
            "POS Opening Entry", opening_entry.name,
            "pos_closing_entry", doc.name
        )

        return {
            "name": doc.name,
            "message": _("POS Closing Entry created successfully.")
        }

    except Exception as e:
        frappe.log_error(
            message=traceback.format_exc(),
            title="POS Closing Entry Creation Failed"
        )
        frappe.throw(_("Failed to create POS Closing Entry: {0}").format(str(e)))
