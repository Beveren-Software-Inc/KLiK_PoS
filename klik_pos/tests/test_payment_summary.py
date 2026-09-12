from frappe.tests.utils import FrappeTestCase

from klik_pos.api.payment import _build_payment_summary


class TestPaymentSummary(FrappeTestCase):
	def test_build_payment_summary_accepts_dict_rows(self):
		result = _build_payment_summary(
			[{"mode_of_payment": "Cash", "opening_amount": 100}],
			[
				{
					"mode_of_payment": "Cash",
					"total_amount": 250,
					"transactions": 3,
				}
			],
		)

		self.assertEqual(
			result,
			[
				{
					"name": "Cash",
					"openingAmount": 100.0,
					"amount": 250,
					"transactions": 3,
				}
			],
		)
