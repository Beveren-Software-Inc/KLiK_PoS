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
                # "exchange_rate": get_currency_exchange_rate(company_currency, doc.default_currency)
            })

        return {"success": True, "data": result}

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Error fetching customers")
        return {"success": False, "error": _("Something went wrong while fetching customers.")}


@frappe.whitelist()
def create_or_update_customer(customer_data):
    try:
        if isinstance(customer_data, str):
            customer_data = frappe.parse_json(customer_data)

        customer_name = customer_data.get("name")
        email = customer_data.get("email")
        phone = customer_data.get("phone")
        country = customer_data.get("address", {}).get("country", "Kenya")
        name_arabic = customer_data.get("name_arabic", "")
        address = customer_data.get("address", {})

        # Create or update the Customer
        customer_doc = get_or_create_customer(customer_name, email, phone, country, name_arabic)

        # Create or update the Address
        addr_doc = create_or_update_address(customer_doc.name, customer_name, address, country)

        return {
            "success": True,
            "customer_name": customer_doc.name,
            "address_name": addr_doc.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Customer Creation/Update Error")
        return {
            "success": False,
            "error": str(e)
        }


def get_or_create_customer(name, email, phone, country, name_arabic=""):
    """Create or update a Customer."""
    existing = frappe.get_all("Customer", filters={"customer_name": name}, fields=["name"])
    if existing:
        doc = frappe.get_doc("Customer", existing[0]["name"])
        doc.email_id = email
        doc.mobile_no = phone
        doc.custom_country = country
        doc.save()
    else:
        doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": name,
            "customer_type": "Individual",
            "customer_name_in_arabic": name_arabic,
            "email_id": email,
            "mobile_no": phone,
            "custom_country": country
        })
        doc.insert()
    return doc


def create_or_update_address(customer_id, customer_name, address_data, country):
    """Create or update primary address for the customer."""
    address_title = f"{customer_name} - Primary"

    address_fields = {
        "address_title": address_title,
        "address_type": "Billing",
        "address_line1": address_data.get("street", ""),
        "city": address_data.get("city", ""),
        "state": address_data.get("state"),
        "pincode": address_data.get("zipCode"),
        "country": country,
        "is_primary_address": 1,
        "is_shipping_address": 1
    }

    link_data = {
        "link_doctype": "Customer",
        "link_name": customer_id,
        "link_title": customer_name
    }

    existing = frappe.get_all("Address", filters={"address_title": address_title}, fields=["name"])
    if existing:
        doc = frappe.get_doc("Address", existing[0]["name"])
        for field, value in address_fields.items():
            setattr(doc, field, value)
        doc.links = []  # Reset existing links
    else:
        doc = frappe.new_doc("Address")
        for field, value in address_fields.items():
            setattr(doc, field, value)

    doc.append("links", link_data)
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
        
        customer.ignore_version = True  # ✅ Add this line
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

def get_user_company_and_currency():
    user = frappe.session.user

    default_company = frappe.defaults.get_user_default("Company")
    if not default_company:
     
        default_company = frappe.db.get_single_value("Global Defaults", "default_company")
    # Get the default currency for the company
    company_currency = frappe.db.get_value("Company", default_company, "default_currency")

    return {
        "company": default_company,
        "currency": company_currency
    }
    

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
