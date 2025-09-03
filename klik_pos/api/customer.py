import frappe
from frappe import _
import json
from erpnext.setup.utils import get_exchange_rate
from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist(allow_guest=True)
def get_customers(limit: int = 100, start: int = 0, search: str = ""):
    """
    Fetch customers with structured primary contact & address details.
    If a default customer is set in POS Profile, only return that.
    """

    try:
        pos_profile = get_current_pos_profile()
        default_customer = pos_profile.customer
        company, company_currency = get_user_company_and_currency()
        result = []
        filters = {}

        if default_customer:
            filters["name"] = default_customer
        elif search:
            filters["customer_name"] = ["like", f"%{search}%"]

        customer_names = frappe.get_all(
            "Customer",
            filters=filters,
            fields=[
                "name", "customer_name", "customer_type",
                "customer_group", "territory", "default_currency"
            ],
            order_by="modified desc",
            limit=limit,
            start=start,
        )

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

            # Get customer statistics
            stats = get_customer_statistics(doc.name)
            customer_stats = stats.get("data", {}) if stats.get("success") else {}

            result.append({
                "name": doc.name,
                "customer_name": doc.customer_name,
                "customer_type": doc.customer_type,
                "customer_group": doc.customer_group,
                "territory": doc.territory,
                "contact": contact,
                "address": address,
                "default_currency": doc.default_currency,
                "company_currency": company_currency,
                "custom_total_orders": customer_stats.get("total_orders", 0),
                "custom_total_spent": customer_stats.get("total_spent", 0),
                "custom_last_visit": customer_stats.get("last_visit"),
                # "exchange_rate": get_currency_exchange_rate(company_currency, doc.default_currency)
            })
        print("Results", result)
        return {"success": True, "data": result}

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Error fetching customers")
        return {"success": False, "error": _("Something went wrong while fetching customers.")}


def get_user_company_and_currency():
    user = frappe.session.user

    default_company = frappe.defaults.get_user_default("Company")
    if not default_company:
        default_company = frappe.db.get_single_value("Global Defaults", "default_company")

    company_currency = frappe.db.get_value("Company", default_company, "default_currency")

    return default_company, company_currency


@frappe.whitelist(allow_guest=True)
def get_customer_addresses(customer: str):
    """Get all addresses for a specific customer"""
    try:
        # Get all addresses linked to this customer
        addresses = frappe.get_all(
            "Address",
            filters={
                "name": ["in", frappe.get_all(
                    "Dynamic Link",
                    filters={
                        "link_doctype": "Customer",
                        "link_name": customer,
                        "parenttype": "Address"
                    },
                    pluck="parent"
                )]
            },
            fields=["name", "address_line1", "address_line2", "city", "state", "country", "pincode"],
            order_by="creation desc"
        )
        print("Address", addresses)
        return addresses
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error fetching addresses for customer {customer}")
        return []


@frappe.whitelist()
def get_currency_exchange_rate(from_currency: str, to_currency: str, transaction_date: str = None):
    """
    Get exchange rate from `from_currency` to `to_currency`.
    Optionally pass a transaction_date (YYYY-MM-DD).
    """
    if not transaction_date:
        date = frappe.utils.nowdate()
    try:
        if not from_currency or not to_currency:
            return {"success": False, "error": "Both from_currency and to_currency are required"}

        rate = get_exchange_rate(from_currency, to_currency, transaction_date)
        return rate

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error fetching exchange rate")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_customer_info(customer_name: str):
    """Fetch customer document by customer name."""
    customer = frappe.get_doc("Customer", customer_name)
    return {
        "name": customer.name,
        "customer_name": customer.customer_name,
        "customer_group": customer.customer_group,
        "territory": customer.territory,
        "customer_type": customer.customer_type,
        "customer_primary_contact": customer.customer_primary_contact,
        "customer_primary_address": customer.customer_primary_address,
        "email_id": customer.email_id,
        "mobile_no": customer.mobile_no,

    }


@frappe.whitelist()
def create_or_update_customer(customer_data):
    try:
        if isinstance(customer_data, str):
            customer_data = frappe.parse_json(customer_data)
        print(str(customer_data))
        # Extract main fields
        customer_name = customer_data.get("name")
        email = customer_data.get("email")
        phone = customer_data.get("phone")
        cust_type = customer_data.get("type", "individual").lower()
        country = customer_data.get("address", {}).get("country", "Kenya")
        name_arabic = customer_data.get("name_arabic", "")
        address = customer_data.get("address", {})

        # If name is missing, fallback to phone → email
        if not customer_name:
            customer_name = phone or email
        if not customer_name:
            frappe.throw("Customer must have at least a name, phone, or email")

        # Create or update Customer
        customer_doc = get_or_create_customer(customer_name, email, phone, country, name_arabic, customer_data)

        contact_doc = None
        addr_doc = None
        print("mania", customer_doc)
        # For Individuals → only create contact if phone exists
        if cust_type == "individual":
            if phone:
                contact_doc = create_or_update_contact(customer_doc.name, customer_name, email, phone)

        # For Companies → create both Contact and Address
        if cust_type == "company":
            contact_doc = create_or_update_contact(customer_doc.name, customer_name, email, phone)
            addr_doc = create_or_update_address(customer_doc.name, customer_name, address, country)

            # 🔗 Link Address to Customer
            if addr_doc:
                frappe.db.set_value("Customer", customer_doc.name, "customer_primary_address", addr_doc.name)

        return {
            "success": True,
            "customer_name": customer_doc.name,
            "contact_name": contact_doc.name if contact_doc else None,
            "address_name": addr_doc.name if addr_doc else None
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Customer Creation/Update Error")
        return {
            "success": False,
            "error": str(e)
        }

def get_or_create_customer(name, email, phone, country, name_arabic="", data=None):
    """Create or update a Customer (Individual or Company)."""
    try:
        cust_type = "Company" if data and data.get("type") == "company" else "Individual"

        existing = frappe.get_all("Customer", filters={"customer_name": name}, fields=["name"])
        if existing:
            # Update existing
            doc = frappe.get_doc("Customer", existing[0]["name"])
            doc.email_id = email
            doc.mobile_no = phone
            doc.custom_country = country
            doc.customer_type = cust_type
            doc.customer_name_in_arabic = name_arabic

            if cust_type == "Company":
                doc.custom_vat_number = data.get("vatNumber")
                doc.custom_payment_method = data.get("preferredPaymentMethod")
                doc.custom_registration_scheme = data.get("registrationScheme")
                doc.custom_registration_number = data.get("registrationNumber")

            doc.save()
        else:
            # Create new
            doc = frappe.get_doc({
                "doctype": "Customer",
                "customer_name": name,
                "customer_type": cust_type,
                "customer_name_in_arabic": name_arabic,
                "email_id": email,
                "mobile_no": phone,
                "custom_country": country,
                "status": data.get("status", "Active") if data else "Active",
                "custom_vat_number": data.get("vatNumber") if cust_type == "Company" else None,
                "custom_payment_method": data.get("preferredPaymentMethod") if cust_type=="Company" else None,
                "custom_registration_scheme": data.get("registrationScheme") if cust_type == "Company" else None,
                "custom_registration_number": data.get("registrationNumber") if cust_type == "Company" else None
            })
            doc.insert()
        return doc

        # Handle address creation if provided


    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Customer Creation Failed")
        frappe.throw(f"Failed to create/update customer: {e}")


def create_or_update_contact(customer, customer_name, email, phone):
    existing_contact = frappe.get_all(
        "Contact",
        filters={"email_id": email, "link_name": customer},
        limit=1
    )

    if existing_contact:
        # load existing document
        doc = frappe.get_doc("Contact", existing_contact[0].name)
        doc.first_name = customer_name
        doc.phone = phone
        doc.email_id = email
    else:
        # create new document properly
        doc = frappe.get_doc({
            "doctype": "Contact",
            "first_name": customer_name,
            "email_id": email,
            "phone": phone,
            "links": [{
                "link_doctype": "Customer",
                "link_name": customer
            }]
        })

    doc.save(ignore_permissions=True)
    return doc



def create_or_update_address(customer_id, customer_name, address_data, country):
    """Create or update primary Address for the customer."""
    if not address_data:
        return None

    address_title = f"{customer_name} - Primary"

    address_fields = {
        "address_title": address_title,
        "address_type": address_data.get("addressType", "Billing"),
        "address_line1": address_data.get("streetName", ""),
        "address_line2": address_data.get("buildingNumber", ""),
        "city": address_data.get("subdivisionName", ""),
        "county": address_data.get("cityName", ""),
        "pincode": address_data.get("postalCode", ""),
        "country": country,
        "is_primary_address": 1 if address_data.get("isPrimary") else 0,
        "is_shipping_address": 0
    }

    existing = frappe.get_all("Address", filters={"address_title": address_title}, fields=["name"])

    if existing:
        doc = frappe.get_doc("Address", existing[0]["name"])
        for field, value in address_fields.items():
            setattr(doc, field, value)
        doc.links = []
    else:
        doc = frappe.new_doc("Address")
        for field, value in address_fields.items():
            setattr(doc, field, value)

    doc.append("links", {
        "link_doctype": "Customer",
        "link_name": customer_id,
        "link_title": customer_name
    })
    doc.save()
    return doc


@frappe.whitelist()
def update_customer(customer_id, customer_data):
    if isinstance(customer_data, str):
        customer_data = json.loads(customer_data)

    try:
        customer = frappe.get_doc("Customer", customer_id)

        for key, value in customer_data.items():
            setattr(customer, key, value)

        customer.ignore_version = True
        customer.save()

        return {
            "success": True,
            "updated_customer": customer.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Update Customer Error")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_customer_statistics(customer_id):
    """Get customer statistics including total orders and total spent"""
    try:
        # Get total invoices (orders) for the customer
        total_orders = frappe.db.count(
            "Sales Invoice",
            filters={
                "customer": customer_id,
                "docstatus": 1,  # Submitted invoices only
                "is_return": 0,   # Exclude return invoices
                "status": ["!=", "Cancelled"]
            }
        )

        # Get total amount spent by the customer
        total_spent_result = frappe.db.sql("""
            SELECT COALESCE(SUM(grand_total), 0) as total_spent
            FROM `tabSales Invoice`
            WHERE customer = %s
            AND docstatus = 1
            AND is_return = 0
            AND status != 'Cancelled'
        """, (customer_id,), as_dict=True)

        total_spent = total_spent_result[0].total_spent if total_spent_result else 0

        # Get last visit date (most recent invoice date)
        last_visit_result = frappe.db.sql("""
            SELECT MAX(posting_date) as last_visit
            FROM `tabSales Invoice`
            WHERE customer = %s
            AND docstatus = 1
            AND is_return = 0
            AND status != 'Cancelled'
        """, (customer_id,), as_dict=True)

        last_visit = last_visit_result[0].last_visit if last_visit_result else None

        return {
            "success": True,
            "data": {
                "total_orders": total_orders,
                "total_spent": total_spent,
                "last_visit": last_visit
            }
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error fetching customer statistics")
        return {
            "success": False,
            "error": str(e)
        }
