import json

import frappe
from erpnext.setup.utils import get_exchange_rate
from frappe import _

from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist(allow_guest=True)
def get_customers(limit: int = 100, start: int = 0, search: str = ""):
	"""
	Fetch customers with structured primary contact & address details.
	Returns all customers based on business type and search criteria.
	"""

	try:
		pos_profile = get_current_pos_profile()
		business_type = getattr(pos_profile, "custom_business_type", "B2C")
		company, company_currency = get_user_company_and_currency()
		result = []

		# If there's a search term, broaden the query across name, customer_name, contact email/phone.
		# Also increase limit for search results to surface older matches.
		if search:
			# Sanitize search input for LIKE
			like_param = f"%{search}%"

			# Build optional customer_type filter
			cust_type_filter = ""
			cust_type_params = []
			if business_type == "B2B":
				cust_type_filter = "AND c.customer_type = %s"
				cust_type_params.append("Company")
			elif business_type == "B2C":
				cust_type_filter = "AND c.customer_type = %s"
				cust_type_params.append("Individual")

			# Prefer higher cap when searching
			try:
				limit_val = int(limit) if limit else 100
			except Exception:
				limit_val = 100
			# Boost limits for search to show more matches
			limit_val = max(limit_val, 500)

			customer_names = frappe.db.sql(
				f"""
                SELECT DISTINCT c.name, c.customer_name, c.customer_type, c.customer_group, c.territory, c.default_currency
                FROM `tabCustomer` c
                LEFT JOIN `tabDynamic Link` dl ON dl.link_doctype='Customer' AND dl.link_name=c.name AND dl.parenttype='Contact'
                LEFT JOIN `tabContact` ct ON ct.name = dl.parent
                LEFT JOIN `tabContact Email` ce ON ce.parent = ct.name
                LEFT JOIN `tabContact Phone` cp ON cp.parent = ct.name
                WHERE (
                    c.customer_name LIKE %s OR c.name LIKE %s OR
                    ce.email_id LIKE %s OR cp.phone LIKE %s
                )
                {cust_type_filter}
                ORDER BY c.creation DESC
                LIMIT %s OFFSET %s
                """,
				tuple(
					[
						like_param,
						like_param,
						like_param,
						like_param,
						*cust_type_params,
						limit_val,
						int(start) or 0,
					]
				),
				as_dict=True,
			)

			# Total count for search
			total_count_row = frappe.db.sql(
				f"""
                SELECT COUNT(DISTINCT c.name) as total
                FROM `tabCustomer` c
                LEFT JOIN `tabDynamic Link` dl ON dl.link_doctype='Customer' AND dl.link_name=c.name AND dl.parenttype='Contact'
                LEFT JOIN `tabContact` ct ON ct.name = dl.parent
                LEFT JOIN `tabContact Email` ce ON ce.parent = ct.name
                LEFT JOIN `tabContact Phone` cp ON cp.parent = ct.name
                WHERE (
                    c.customer_name LIKE %s OR c.name LIKE %s OR
                    ce.email_id LIKE %s OR cp.phone LIKE %s
                )
                {cust_type_filter}
                """,
				tuple([like_param, like_param, like_param, like_param, *cust_type_params]),
				as_dict=True,
			)
			total_count = (total_count_row[0].total if total_count_row else 0) or 0
		else:
			# Original logic for when no search term - keep capped limit for performance
			filters = {}
			if business_type == "B2B":
				filters["customer_type"] = "Company"
			elif business_type == "B2C":
				filters["customer_type"] = "Individual"

			customer_names = frappe.get_all(
				"Customer",
				filters=filters,
				fields=[
					"name",
					"customer_name",
					"customer_type",
					"customer_group",
					"territory",
					"default_currency",
				],
				order_by="creation desc",
				limit=limit,
				start=start,
			)

			total_count = frappe.db.count("Customer", filters=filters)
		for cust in customer_names:
			doc = frappe.get_doc("Customer", cust.name)

			contact = (
				frappe.db.get_value(
					"Contact",
					{"name": doc.customer_primary_contact},
					["first_name", "last_name", "email_id", "phone", "mobile_no"],
					as_dict=True,
				)
				if doc.customer_primary_contact
				else None
			)

			address = (
				frappe.db.get_value(
					"Address",
					{"name": doc.customer_primary_address},
					["address_line1", "city", "state", "country", "pincode"],
					as_dict=True,
				)
				if doc.customer_primary_address
				else None
			)

			# Get customer statistics
			stats = get_customer_statistics(doc.name)
			customer_stats = stats.get("data", {}) if stats.get("success") else {}

			result.append(
				{
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
				}
			)

		return {
			"success": True,
			"data": result,
			"total_count": total_count,
			"start": start,
			"limit": limit,
		}

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Error fetching customers")
		return {
			"success": False,
			"error": _("Something went wrong while fetching customers."),
		}


def get_user_company_and_currency():
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
				"name": [
					"in",
					frappe.get_all(
						"Dynamic Link",
						filters={
							"link_doctype": "Customer",
							"link_name": customer,
							"parenttype": "Address",
						},
						pluck="parent",
					),
				]
			},
			fields=[
				"name",
				"address_line1",
				"address_line2",
				"city",
				"state",
				"country",
				"pincode",
			],
			order_by="creation desc",
		)
		return addresses
	except Exception:
		frappe.log_error(frappe.get_traceback(), f"Error fetching addresses for customer {customer}")
		return []


@frappe.whitelist()
def get_currency_exchange_rate(from_currency: str, to_currency: str, transaction_date: str | None = None):
	"""
	Get exchange rate from `from_currency` to `to_currency`.
	Optionally pass a transaction_date (YYYY-MM-DD).
	"""
	if not transaction_date:
		transaction_date = frappe.utils.nowdate()
	try:
		if not from_currency or not to_currency:
			return {
				"success": False,
				"error": "Both from_currency and to_currency are required",
			}

		rate = get_exchange_rate(from_currency, to_currency, transaction_date)
		return rate

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching exchange rate")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_customer_info(customer_name: str):
	"""Fetch comprehensive customer document by customer name."""
	try:
		customers = frappe.get_all("Customer", filters={"customer_name": customer_name}, fields=["name"])
		if not customers:
			customers = frappe.get_all("Customer", filters={"name": customer_name}, fields=["name"])

		if not customers:
			return {"success": False, "error": f"Customer not found: {customer_name}"}

		customer = frappe.get_doc("Customer", customers[0]["name"])

		# Get primary contact details
		contact_data = None
		if customer.customer_primary_contact:
			contact_data = frappe.db.get_value(
				"Contact",
				customer.customer_primary_contact,
				["first_name", "last_name", "email_id", "phone", "mobile_no"],
				as_dict=True,
			)

		# Get primary address details
		address_data = None
		if customer.customer_primary_address:
			address_data = frappe.db.get_value(
				"Address",
				customer.customer_primary_address,
				[
					"address_line1",
					"address_line2",
					"city",
					"state",
					"country",
					"pincode",
				],
				as_dict=True,
			)

		# Prepare base customer data
		customer_data = {
			"name": customer.name,
			"customer_name": customer.customer_name,
			"customer_group": customer.customer_group,
			"territory": customer.territory,
			"customer_type": customer.customer_type,
			"customer_primary_contact": customer.customer_primary_contact,
			"customer_primary_address": customer.customer_primary_address,
			"email_id": customer.email_id,
			"mobile_no": customer.mobile_no,
			"creation": customer.creation,
			"contact_data": contact_data,
			"address_data": address_data,
		}

		# Add ZATCA details for company customers
		if customer.customer_type == "Company":
			customer_data.update(
				{
					"vat_number": getattr(customer, "custom_vat_number", ""),
					"registration_scheme": getattr(customer, "custom_registration_scheme", ""),
					"registration_number": getattr(customer, "custom_registration_number", ""),
					"payment_method": getattr(customer, "custom_payment_method", "Cash"),
					"industry": getattr(customer, "custom_industry", ""),
					"employee_count": getattr(customer, "custom_employee_count", ""),
					"company_name": customer.customer_name,
				}
			)

		return customer_data
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching customer info")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def create_or_update_customer(customer_data):
	try:
		if isinstance(customer_data, str):
			customer_data = frappe.parse_json(customer_data)
		# Extract main fields
		customer_name = customer_data.get("name")
		email = customer_data.get("email")
		phone = customer_data.get("phone")
		cust_type = customer_data.get("customer_type", customer_data.get("type", "individual")).lower()
		country = customer_data.get("address", {}).get("country", "Kenya")
		name_arabic = customer_data.get("name_arabic", "")
		address = customer_data.get("address", {})

		if not customer_name:
			customer_name = phone or email
		if not customer_name:
			frappe.throw("Customer must have at least a name, phone, or email")

		# Create or update Customer
		customer_doc = get_or_create_customer(
			customer_name, email, phone, country, name_arabic, customer_data
		)

		contact_doc = None
		addr_doc = None
		# For Individuals → create contact if phone exists, and address if provided
		if cust_type == "individual":
			if phone:
				contact_doc = create_or_update_contact(customer_doc.name, customer_name, email, phone)

			# Create address for individual customers if address data is provided
			if address and any(address.get(field) for field in ["street", "city", "state", "zipCode"]):
				addr_doc = create_or_update_address(customer_doc.name, customer_name, address, country)
				if addr_doc:
					frappe.db.set_value(
						"Customer",
						customer_doc.name,
						"customer_primary_address",
						addr_doc.name,
					)

		# For Companies → create both Contact and Address
		if cust_type == "company":
			contact_name = customer_data.get("contactName", customer_name)
			contact_doc = create_or_update_contact(customer_doc.name, contact_name, email, phone)
			addr_doc = create_or_update_address(customer_doc.name, customer_name, address, country)

			if addr_doc:
				frappe.db.set_value(
					"Customer",
					customer_doc.name,
					"customer_primary_address",
					addr_doc.name,
				)

		return {
			"success": True,
			"customer_name": customer_doc.name,
			"contact_name": contact_doc.name if contact_doc else None,
			"address_name": addr_doc.name if addr_doc else None,
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Customer Creation/Update Error")
		return {"success": False, "error": str(e)}


def get_or_create_customer(name, email, phone, country, name_arabic="", data=None):
	"""Create or update a Customer (Individual or Company)."""
	try:
		cust_type = (
			"Company"
			if data and (data.get("customer_type") == "company" or data.get("type") == "company")
			else "Individual"
		)

		# Get customer_group and territory from data, with defaults
		customer_group = data.get("customer_group", "All Customer Groups") if data else "All Customer Groups"
		territory = data.get("territory", country) if data else country

		existing = frappe.get_all("Customer", filters={"customer_name": name}, fields=["name"])
		if existing:
			doc = frappe.get_doc("Customer", existing[0]["name"])
			doc.email_id = email
			doc.mobile_no = phone
			doc.custom_country = country
			doc.customer_type = cust_type
			doc.customer_name_in_arabic = name_arabic
			doc.customer_group = customer_group
			doc.territory = territory

			if cust_type == "Company":
				doc.custom_vat_number = data.get("vatNumber")
				doc.custom_payment_method = data.get("preferredPaymentMethod")
				doc.custom_registration_scheme = data.get("registrationScheme")
				doc.custom_registration_number = data.get("registrationNumber")

			doc.save()
		else:
			# Create new
			doc = frappe.get_doc(
				{
					"doctype": "Customer",
					"customer_name": name,
					"customer_type": cust_type,
					"customer_name_in_arabic": name_arabic,
					"email_id": email,
					"mobile_no": phone,
					"custom_country": country,
					"customer_group": customer_group,
					"territory": territory,
					"status": data.get("status", "Active") if data else "Active",
					"custom_vat_number": (data.get("vatNumber") if cust_type == "Company" else None),
					"custom_payment_method": (
						data.get("preferredPaymentMethod") if cust_type == "Company" else None
					),
					"custom_registration_scheme": (
						data.get("registrationScheme") if cust_type == "Company" else None
					),
					"custom_registration_number": (
						data.get("registrationNumber") if cust_type == "Company" else None
					),
				}
			)
			doc.insert()
		return doc
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error in get_or_create_customer")
		raise e


@frappe.whitelist(allow_guest=True)
def get_customer_groups():
	"""Fetch customer groups based on POS profile configuration."""
	try:
		pos_profile = get_current_pos_profile()

		# Check if POS profile has customer groups configured
		if hasattr(pos_profile, "customer_groups") and pos_profile.customer_groups:
			customer_group_names = [d.customer_group for d in pos_profile.customer_groups if d.customer_group]

			customer_groups = frappe.get_all(
				"Customer Group",
				filters={"name": ["in", customer_group_names]},
				fields=["name", "customer_group_name"],
				order_by="customer_group_name asc",
			)
		else:
			customer_groups = frappe.get_all(
				"Customer Group",
				fields=["name", "customer_group_name"],
				order_by="customer_group_name asc",
			)

		# Check if "All Customer Groups" already exists, if not add it
		has_all_groups = any(group["name"] == "All Customer Groups" for group in customer_groups)
		if not has_all_groups:
			customer_groups.insert(
				0,
				{
					"name": "All Customer Groups",
					"customer_group_name": "All Customer Groups",
				},
			)

		return {"success": True, "data": customer_groups}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching customer groups")
		return {"success": False, "error": str(e)}


@frappe.whitelist(allow_guest=True)
def get_territories():
	"""Fetch all territories for dropdown selection."""
	try:
		territories = frappe.get_all(
			"Territory",
			fields=["name", "territory_name"],
			order_by="territory_name asc",
		)

		return {"success": True, "data": territories}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching territories")
		return {"success": False, "error": str(e)}


def create_or_update_contact(customer, customer_name, email, phone):
	existing_contact = frappe.get_all("Contact", filters={"email_id": email, "link_name": customer}, limit=1)

	if existing_contact:
		doc = frappe.get_doc("Contact", existing_contact[0].name)
		doc.first_name = customer_name
		doc.phone = phone
		doc.email_id = email
	else:
		# create new document properly
		doc = frappe.get_doc(
			{
				"doctype": "Contact",
				"first_name": customer_name,
				"email_id": email,
				"phone": phone,
				"links": [{"link_doctype": "Customer", "link_name": customer}],
			}
		)

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
		"address_line1": address_data.get("street", ""),
		"address_line2": address_data.get("buildingNumber", ""),
		"city": address_data.get("city", ""),
		"state": address_data.get("state", ""),
		"county": address_data.get("city", ""),
		"pincode": address_data.get("zipCode", ""),
		"country": country,
		"is_primary_address": 1 if address_data.get("isPrimary") else 0,
		"is_shipping_address": 0,
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

	doc.append(
		"links",
		{
			"link_doctype": "Customer",
			"link_name": customer_id,
			"link_title": customer_name,
		},
	)
	doc.save()
	return doc


@frappe.whitelist()
def update_customer(customer_id, customer_data):
	if isinstance(customer_data, str):
		customer_data = json.loads(customer_data)

	try:
		customer = frappe.get_doc("Customer", customer_id)

		# Extract email and phone for contact update
		email = customer_data.get("email")
		phone = customer_data.get("phone")
		customer_name = customer_data.get("name", customer.customer_name)
		address_data = customer_data.get("address", {})
		country = address_data.get("country", "Saudi Arabia")

		# Update customer fields
		for key, value in customer_data.items():
			if key not in ["email", "phone", "address"]:
				setattr(customer, key, value)

		customer.ignore_version = True
		customer.save()

		# Update email_id and mobile_no directly on Customer doctype for consistency
		if email:
			customer.email_id = email
		if phone:
			customer.mobile_no = phone

		# Update the primary contact's child tables if email or phone changed
		if customer.customer_primary_contact and (email or phone):
			try:
				contact_doc = frappe.get_doc("Contact", customer.customer_primary_contact)

				# Update email in child table
				if email:
					contact_doc.email_ids = []
					contact_doc.append("email_ids", {"email_id": email, "is_primary": 1})

				# Update phone in child table
				if phone:
					contact_doc.phone_nos = []
					contact_doc.append(
						"phone_nos",
						{
							"phone": phone,
							"is_primary_mobile_no": 1,
							"is_primary_phone": 1,
						},
					)

				contact_doc.save()
			except Exception:
				frappe.log_error(
					frappe.get_traceback(),
					f"Error updating contact for customer {customer_id}",
				)
				# Don't fail the whole operation if contact update fails

		# Update address if address data is provided
		if address_data and any(
			address_data.get(field) for field in ["street", "city", "state", "zipCode", "buildingNumber"]
		):
			try:
				addr_doc = create_or_update_address(customer_id, customer_name, address_data, country)
				if addr_doc:
					frappe.db.set_value(
						"Customer",
						customer_id,
						"customer_primary_address",
						addr_doc.name,
					)
			except Exception:
				frappe.log_error(
					frappe.get_traceback(),
					f"Error updating address for customer {customer_id}",
				)

		return {"success": True, "updated_customer": customer.name}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Update Customer Error")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_customer_statistics(customer_id):
	"""Get customer statistics including total orders and total spent"""
	try:
		# Get total invoices (orders) for the customer
		total_orders = frappe.db.count(
			"Sales Invoice",
			filters={
				"customer": customer_id,
				"docstatus": 1,
				"is_return": 0,
				"status": ["!=", "Cancelled"],
			},
		)

		# Get total amount spent by the customer
		total_spent_result = frappe.db.sql(
			"""
            SELECT COALESCE(SUM(grand_total), 0) as total_spent
            FROM `tabSales Invoice`
            WHERE customer = %s
            AND docstatus = 1
            AND is_return = 0
            AND status != 'Cancelled'
        """,
			(customer_id,),
			as_dict=True,
		)

		total_spent = total_spent_result[0].total_spent if total_spent_result else 0

		# Get last visit date (most recent invoice date)
		last_visit_result = frappe.db.sql(
			"""
            SELECT MAX(posting_date) as last_visit
            FROM `tabSales Invoice`
            WHERE customer = %s
            AND docstatus = 1
            AND is_return = 0
            AND status != 'Cancelled'
        """,
			(customer_id,),
			as_dict=True,
		)

		last_visit = last_visit_result[0].last_visit if last_visit_result else None

		return {
			"success": True,
			"data": {
				"total_orders": total_orders,
				"total_spent": total_spent,
				"last_visit": last_visit,
			},
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Error fetching customer statistics")
		return {"success": False, "error": str(e)}


@frappe.whitelist(allow_guest=True)
def get_global_totals():
	"""Return global totals for customers and invoices for dashboard cards."""
	try:
		total_customers = frappe.db.count("Customer")
		total_invoices = frappe.db.count(
			"Sales Invoice",
			filters={
				"docstatus": 1,
				"is_return": 0,
				"status": ["!=", "Cancelled"],
			},
		)
		return {
			"success": True,
			"total_customers": total_customers,
			"total_invoices": total_invoices,
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Global Customer Totals Error")
		return {
			"success": False,
			"error": str(e),
			"total_customers": 0,
			"total_invoices": 0,
		}
