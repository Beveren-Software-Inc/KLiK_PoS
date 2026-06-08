import json

import frappe
from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
	get_loyalty_program_details_with_points,
	validate_loyalty_points,
)
from frappe import _
from frappe.utils import flt, nowdate


def _as_int(value):
	try:
		return int(flt(value or 0))
	except Exception:
		return 0


def _resolve_loyalty_program(customer, loyalty_program=None):
	if loyalty_program:
		return loyalty_program
	return frappe.db.get_value("Customer", customer, "loyalty_program")


def get_customer_loyalty_summary(customer, company=None, loyalty_program=None, current_transaction_amount=0):
	"""Return ERPNext loyalty details for a customer without duplicating loyalty calculations."""
	if not customer:
		return {
			"enabled": False,
			"loyalty_program": None,
			"loyalty_points": 0,
			"redeemable_value": 0,
		}

	loyalty_program = _resolve_loyalty_program(customer, loyalty_program)
	if not loyalty_program:
		return {
			"enabled": False,
			"loyalty_program": None,
			"loyalty_points": 0,
			"redeemable_value": 0,
		}

	details = get_loyalty_program_details_with_points(
		customer=customer,
		loyalty_program=loyalty_program,
		company=company,
		silent=True,
		current_transaction_amount=current_transaction_amount,
	)

	points = _as_int(details.get("loyalty_points"))
	conversion_factor = flt(details.get("conversion_factor") or 0)
	return {
		"enabled": True,
		"loyalty_program": details.get("loyalty_program") or loyalty_program,
		"loyalty_program_name": details.get("loyalty_program_name") or loyalty_program,
		"loyalty_program_type": details.get("loyalty_program_type"),
		"loyalty_program_tier": details.get("tier_name"),
		"customer_loyalty_program_tier": frappe.db.get_value(
			"Customer", customer, "loyalty_program_tier"
		),
		"loyalty_points": points,
		"available_points": points,
		"conversion_factor": conversion_factor,
		"redeemable_value": flt(points * conversion_factor),
		"total_spent": flt(details.get("total_spent") or 0),
		"collection_factor": flt(details.get("collection_factor") or 0),
		"expense_account": details.get("expense_account"),
		"cost_center": details.get("cost_center"),
		"company": details.get("company") or company,
	}


def normalize_loyalty_redemption(data):
	if isinstance(data, str):
		data = json.loads(data)

	loyalty_data = data.get("loyalty") or data.get("loyaltyRedemption") or {}
	if not isinstance(loyalty_data, dict):
		loyalty_data = {}

	points = (
		loyalty_data.get("loyalty_points")
		or loyalty_data.get("points")
		or data.get("loyalty_points")
		or data.get("loyaltyPoints")
	)
	points = _as_int(points)
	if points <= 0:
		return None

	return {
		"loyalty_points": points,
		"loyalty_program": loyalty_data.get("loyalty_program")
		or loyalty_data.get("program")
		or data.get("loyalty_program")
		or data.get("loyaltyProgram"),
	}


def apply_loyalty_redemption(doc, loyalty_redemption):
	"""Apply native ERPNext loyalty redemption fields and validations to a Sales Invoice."""
	if not loyalty_redemption:
		return None

	points = _as_int(loyalty_redemption.get("loyalty_points"))
	if points <= 0:
		return None

	doc.redeem_loyalty_points = 1
	doc.loyalty_points = points
	if loyalty_redemption.get("loyalty_program"):
		doc.loyalty_program = loyalty_redemption.get("loyalty_program")

	validate_loyalty_points(doc, points)
	return {
		"loyalty_program": doc.loyalty_program,
		"loyalty_points": doc.loyalty_points,
		"loyalty_amount": doc.loyalty_amount,
	}


def get_invoice_loyalty_summary(invoice):
	if not invoice:
		return {}

	points_earned = frappe.db.sql(
		"""
		SELECT COALESCE(SUM(loyalty_points), 0)
		FROM `tabLoyalty Point Entry`
		WHERE invoice_type = %s
			AND invoice = %s
			AND loyalty_points > 0
		""",
		(invoice.doctype, invoice.name),
	)[0][0] or 0

	return {
		"loyalty_program": getattr(invoice, "loyalty_program", None),
		"redeem_loyalty_points": int(getattr(invoice, "redeem_loyalty_points", 0) or 0),
		"loyalty_points_redeemed": _as_int(getattr(invoice, "loyalty_points", 0)),
		"loyalty_amount": flt(getattr(invoice, "loyalty_amount", 0)),
		"loyalty_points_earned": _as_int(points_earned),
		"current_balance": get_customer_loyalty_summary(
			invoice.customer,
			company=invoice.company,
			loyalty_program=getattr(invoice, "loyalty_program", None),
		),
	}


@frappe.whitelist()
def get_customer_loyalty(customer, company=None, loyalty_program=None, current_transaction_amount=0):
	try:
		return {
			"success": True,
			"data": get_customer_loyalty_summary(
				customer,
				company=company,
				loyalty_program=loyalty_program,
				current_transaction_amount=current_transaction_amount,
			),
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Klik POS Customer Loyalty Error")
		return {"success": False, "error": str(e)}


@frappe.whitelist()
def preview_loyalty_redemption(customer, loyalty_points, company=None, loyalty_program=None, transaction_amount=0):
	try:
		points = _as_int(loyalty_points)
		if points <= 0:
			frappe.throw(_("Enter loyalty points greater than zero."))

		summary = get_customer_loyalty_summary(
			customer,
			company=company,
			loyalty_program=loyalty_program,
			current_transaction_amount=transaction_amount,
		)
		if not summary.get("enabled"):
			frappe.throw(_("Customer isn't enrolled in any Loyalty Program"))
		if points > summary.get("loyalty_points", 0):
			frappe.throw(_("You don't have enough Loyalty Points to redeem"))

		loyalty_amount = flt(points * flt(summary.get("conversion_factor") or 0))
		if transaction_amount and loyalty_amount > flt(transaction_amount):
			frappe.throw(_("You can't redeem Loyalty Points having more value than the Total Amount."))

		return {
			"success": True,
			"data": {
				"loyalty_program": summary.get("loyalty_program"),
				"loyalty_points": points,
				"loyalty_amount": loyalty_amount,
				"posting_date": nowdate(),
			},
		}
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Klik POS Loyalty Preview Error")
		return {"success": False, "error": str(e)}
