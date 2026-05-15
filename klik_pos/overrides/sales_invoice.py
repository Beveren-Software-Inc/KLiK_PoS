import frappe

from klik_pos.api.sales_invoice import validate_required_salesperson


def validate_sales_person_on_submit(doc, method=None):
    """
    Check if Sales Person is required for POS transactions and validate before submitting the Sales Invoice
    """
    validate_required_salesperson(doc)
