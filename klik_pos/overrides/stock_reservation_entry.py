import frappe

from erpnext.stock.doctype.stock_reservation_entry.stock_reservation_entry import StockReservationEntry


class KlikStockReservationEntry(StockReservationEntry):
	"""Allow Klik's pre-submission Sales Invoice reservations.

	ERPNext's standard reservation vouchers must be submitted. Klik creates a
	reservation before a queued POS invoice is submitted, so the invoice is
	validated separately when it is created and submitted.
	"""

	def validate_voucher(self):
		invoice = (
			frappe.db.get_value(
				"Sales Invoice", self.voucher_no, ["docstatus", "reserve_stock"], as_dict=True
			)
			if self.voucher_type == "Sales Invoice"
			else None
		)
		if invoice and invoice.docstatus == 0 and invoice.reserve_stock:
			return

		super().validate_voucher()
