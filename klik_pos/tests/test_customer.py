from unittest.mock import MagicMock, patch

import frappe
from frappe.tests.utils import FrappeTestCase

from klik_pos.api.customer import check_customer_permission, get_customers


class TestCustomerAPI(FrappeTestCase):
	"""Test cases for Customer API functions"""

	def setUp(self):
		super().setUp()

	@patch("klik_pos.api.customer.get_customer_statistics")
	@patch("frappe.db.get_value")
	@patch("frappe.get_doc")
	@patch("klik_pos.api.customer.get_current_pos_profile")
	@patch("klik_pos.api.customer.get_user_company_and_currency")
	@patch("frappe.permissions.get_user_permissions")
	def test_get_customers_basic_functionality(
		self,
		mock_user_permissions,
		mock_company_currency,
		mock_pos_profile,
		mock_get_doc,
		mock_db_get_value,
		mock_get_stats,
	):
		"""Test basic functionality of get_customers function"""

		mock_pos_profile.return_value = MagicMock(custom_business_type="B2C", customer_groups=[])

		mock_company_currency.return_value = ("Test Company", "USD")

		# Mock user permissions (no specific customer permissions)
		mock_user_permissions.return_value = {}

		from types import SimpleNamespace

		with patch("frappe.get_all") as mock_get_all:
			mock_get_all.return_value = [
				SimpleNamespace(name="CUST-001"),
				SimpleNamespace(name="CUST-002"),
			]

			# Mock frappe.get_doc to return full Customer docs for each name
			doc1 = MagicMock()
			doc1.name = "CUST-001"
			doc1.customer_name = "Test Customer 1"
			doc1.customer_type = "Individual"
			doc1.customer_group = "All Customer Groups"
			doc1.territory = "All Territories"
			doc1.default_currency = "USD"
			doc1.customer_primary_contact = None
			doc1.customer_primary_address = None

			doc2 = MagicMock()
			doc2.name = "CUST-002"
			doc2.customer_name = "Test Customer 2"
			doc2.customer_type = "Individual"
			doc2.customer_group = "All Customer Groups"
			doc2.territory = "All Territories"
			doc2.default_currency = "USD"
			doc2.customer_primary_contact = None
			doc2.customer_primary_address = None

			mock_get_doc.side_effect = [doc1, doc2]

			mock_db_get_value.return_value = None

			mock_get_stats.return_value = {"success": True, "data": {}}

			result = get_customers(limit=10, start=0, search="")

			self.assertTrue(result["success"])
			self.assertEqual(len(result["data"]), 2)
			self.assertEqual(result["data"][0]["name"], "CUST-001")
			self.assertEqual(result["data"][0]["customer_name"], "Test Customer 1")
			self.assertIn(result["data"][0]["customer_type"], ["individual", "Individual"])

			mock_pos_profile.assert_called_once()
			mock_company_currency.assert_called_once()
			mock_user_permissions.assert_called_once()

	@patch("klik_pos.api.customer.get_current_pos_profile")
	@patch("frappe.permissions.get_user_permissions")
	def test_check_customer_permission_b2c_individual(self, mock_user_permissions, mock_pos_profile):
		"""Test check_customer_permission for B2C business type with Individual customer"""

		# Mock POS profile for B2C
		mock_pos_profile.return_value = MagicMock(custom_business_type="B2C", customer_groups=[])

		mock_user_permissions.return_value = {}

		mock_customer = MagicMock()
		mock_customer.customer_type = "Individual"
		mock_customer.customer_group = "All Customer Groups"

		with patch("frappe.get_doc") as mock_get_doc:
			mock_get_doc.return_value = mock_customer

			result = check_customer_permission("CUST-001")

			# Assertions
			self.assertTrue(result["success"])
			self.assertTrue(result["has_permission"])
			self.assertEqual(result["business_type"], "B2C")
			self.assertEqual(result["customer_name"], "CUST-001")

			# Verify mock calls
			mock_pos_profile.assert_called_once()
			mock_user_permissions.assert_called_once()
			mock_get_doc.assert_called_once_with("Customer", "CUST-001")

	@patch("klik_pos.api.customer.get_current_pos_profile")
	@patch("frappe.permissions.get_user_permissions")
	def test_check_customer_permission_b2c_company_denied(self, mock_user_permissions, mock_pos_profile):
		"""Test check_customer_permission for B2C business type with Company customer (should be denied)"""

		# Mock POS profile for B2C
		mock_pos_profile.return_value = MagicMock(custom_business_type="B2C", customer_groups=[])

		# Mock user permissions (no specific customer permissions)
		mock_user_permissions.return_value = {}

		mock_customer = MagicMock()
		mock_customer.customer_type = "Company"
		mock_customer.customer_group = "All Customer Groups"

		with patch("frappe.get_doc") as mock_get_doc:
			mock_get_doc.return_value = mock_customer

			result = check_customer_permission("CUST-COMPANY-001")

			# Assertions
			self.assertTrue(result["success"])
			self.assertFalse(result["has_permission"])
			self.assertEqual(result["business_type"], "B2C")
			self.assertEqual(result["customer_name"], "CUST-COMPANY-001")

			# Verify mock calls
			mock_pos_profile.assert_called_once()
			mock_user_permissions.assert_called_once()
			mock_get_doc.assert_called_once_with("Customer", "CUST-COMPANY-001")

	@patch("klik_pos.api.customer.get_current_pos_profile")
	@patch("frappe.permissions.get_user_permissions")
	def test_check_customer_permission_user_permissions_denied(self, mock_user_permissions, mock_pos_profile):
		"""Test check_customer_permission when user doesn't have permission to specific customer"""

		mock_pos_profile.return_value = MagicMock(custom_business_type="B2C", customer_groups=[])

		mock_user_permissions.return_value = {"Customer": [{"doc": "CUST-001"}]}

		result = check_customer_permission("CUST-002")

		# Assertions
		self.assertTrue(result["success"])
		self.assertFalse(result["has_permission"])
		self.assertEqual(result["customer_name"], "CUST-002")
		self.assertEqual(result["user_permissions"], 1)

		# Verify mock calls
		mock_pos_profile.assert_called_once()
		mock_user_permissions.assert_called_once()

	@patch("klik_pos.api.customer.get_current_pos_profile")
	def test_check_customer_permission_invalid_customer(self, mock_pos_profile):
		"""Test check_customer_permission with non-existent customer"""

		mock_pos_profile.return_value = MagicMock(custom_business_type="B2C", customer_groups=[])

		with patch("frappe.get_doc") as mock_get_doc:
			mock_get_doc.side_effect = frappe.DoesNotExistError("Customer", "NON-EXISTENT")

			# Call the function
			result = check_customer_permission("NON-EXISTENT")

			# Assertions
			self.assertFalse(result["success"])
			self.assertFalse(result["has_permission"])
			self.assertIn("error", result)

			# Verify mock calls
			mock_pos_profile.assert_called_once()
			mock_get_doc.assert_called_once_with("Customer", "NON-EXISTENT")
