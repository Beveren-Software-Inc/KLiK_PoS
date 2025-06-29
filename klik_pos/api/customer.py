import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_customers(limit: int = 50, start: int = 0, search: str = ""):
    """
    Fetch customers with structured primary contact & address details.
    """
    try:
        filters = {}
        if search:
            filters["customer_name"] = ["like", f"%{search}%"]

        customer_names = frappe.get_all(
            "Customer",
            filters=filters,
            fields=["name", "customer_name", "customer_type", "customer_group", "territory"],
            order_by="modified desc",
            limit=limit,
            start=start,
        )

        result = []

        for cust in customer_names:
            doc = frappe.get_doc("Customer", cust.name)

            contact = frappe.db.get_value(
                "Contact",
                {"name": doc.customer_primary_contact},
                ["first_name", "last_name", "email_id", "phone"],
                as_dict=True,
            ) if doc.customer_primary_contact else None

            address = frappe.db.get_value(
                "Address",
                {"name": doc.customer_primary_address},
                ["address_line1", "city", "state", "country", "pincode"],
                as_dict=True,
            ) if doc.customer_primary_address else None

            result.append({
                "name": doc.name,
                "customer_name": doc.customer_name,
                "customer_type": doc.customer_type,
                "customer_group": doc.customer_group,
                "territory": doc.territory,
                "contact": contact,
                "address": address
            })

        return {"success": True, "data": result}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error fetching customers")
        return {"success": False, "error": str(e)}
