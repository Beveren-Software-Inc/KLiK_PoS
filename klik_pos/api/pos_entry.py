

import frappe
import json
from klik_pos.klik_pos.utils import get_current_pos_profile
from frappe import _
from frappe.utils import now_datetime, today

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
    import json

    data = frappe.local.form_dict
    if isinstance(data, str):
        data = json.loads(data)

    user = frappe.session.user

    pos_profile = get_current_pos_profile().name
    
    company = frappe.defaults.get_user_default("Company")

    if not company:
        frappe.throw(_("No default company found for user {0}").format(user))
    if not pos_profile:
        frappe.throw(_("POS Profile could not be determined"))

    balance_details = data.get("balance_details") or data.get("opening_balance", [])
    if not balance_details:
        frappe.throw(_("At least one balance detail (mode of payment) is required"))

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



@frappe.whitelist()
def create_closing_entry(data):
    """
    Create a POS Closing Entry for the current user's open POS Opening Entry.
    """
    import json
    from frappe.utils import now_datetime, today

    data = json.loads(data)
    user = frappe.session.user

    # Get the open POS Opening Entry
    open_entry = frappe.get_all("POS Opening Entry",
        filters={
            "user": user,
            "docstatus": 1,
            "pos_closing_entry": ["is", "null"]
        },
        fields=["name", "pos_profile", "company", "period_start_date"]
    )

    if not open_entry:
        frappe.throw(_("No open POS Opening Entry found for user."))

    opening_entry = open_entry[0]

    # Load full POS Opening Entry to access opening balances
    opening_doc = frappe.get_doc("POS Opening Entry", opening_entry.name)
    opening_balance_map = {
        row.mode_of_payment: row.opening_amount
        for row in opening_doc.opening_balance
    }

    payment_data = data.get("payment_reconciliation", [])
    tax_data = data.get("taxes", [])

    if not payment_data:
        frappe.throw(_("At least one payment reconciliation entry is required."))

    # Create POS Closing Entry
    doc = frappe.new_doc("POS Closing Entry")
    doc.user = user
    doc.company = opening_entry.company
    doc.pos_profile = opening_entry.pos_profile
    doc.period_start_date = opening_doc.period_start_date
    doc.period_end_date = now_datetime()
    doc.set_posting_time = 1
    doc.posting_date = today()
    doc.opening_entry_reference = opening_entry.name

    # Set totals
    doc.total_quantity = data.get("total_quantity")
    doc.net_total = data.get("net_total")
    doc.total_amount = data.get("total_amount")

    # Append to payment reconciliation
    for row in payment_data:
        mode = row.get("mode_of_payment")
        closing_amount = row.get("closing_amount", 0)
        expected_amount = row.get("expected_amount", 0)
        opening_amount = opening_balance_map.get(mode, 0)
        difference = closing_amount - expected_amount

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
    frappe.db.set_value("POS Opening Entry", opening_entry.name, "pos_closing_entry", doc.name)

    return {
        "name": doc.name,
        "message": _("POS Closing Entry created successfully.")
    }

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