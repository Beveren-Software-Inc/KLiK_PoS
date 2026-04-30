import json

import frappe
from frappe.email.doctype.email_account.email_account import EmailAccount
from frappe.utils import fmt_money, now

from klik_pos.klik_pos.utils import get_current_pos_profile


@frappe.whitelist()
def send_invoice_email(**kwargs):
	"""
	Accepts frontend payload and sends invoice email with PDF attachment.
	"""
	data = kwargs

	email = data.get("email")
	customer_name = data.get("customer_name")
	invoice_no = data.get("invoice_data")
	sender = data.get("sender")

	if not (email and invoice_no):
		frappe.throw("Email and invoice number are required.")

	try:
		doc = frappe.get_doc("Sales Invoice", invoice_no)

		pos_profile = get_current_pos_profile()
		print_format = pos_profile.print_format or pos_profile.print_format or "Standard"

		pdf_data = frappe.get_print("Sales Invoice", doc.name, print_format=print_format, as_pdf=True)

		invoice_amount = fmt_money(doc.rounded_total or doc.grand_total, currency=doc.currency)

		subject = f"Invoice {doc.name} from {frappe.defaults.get_user_default('Company')}"
		message = f"""
			<p>Dear {customer_name},</p>
			<p>Please find attached your invoice <b>{doc.name}</b>.</p>
			<p>The total amount due is <b>{invoice_amount}</b>.</p>
			<p>Thank you for your business.</p>
		"""

		attachments = [{"fname": f"{doc.name}.pdf", "fcontent": pdf_data}]

		frappe.sendmail(
			recipients=[email],
			subject=subject,
			message=message,
			attachments=attachments,
			delayed=False,
			sender=sender,
		)

		return {
			"status": "success",
			"recipients": [email],
			"invoice": invoice_no,
			"amount": invoice_amount,
			"print_format": print_format,
			"timestamp": now(),
		}

	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Send Invoice Email Failed")
		frappe.throw(f"Failed to send invoice email: {e!s}")


@frappe.whitelist()
def get_email_templates():
	"""
	Get all Email templates
	"""
	try:
		templates = frappe.get_all(
			"Email Template",
			filters={},
			fields=["name", "subject", "response_html", "response"],
		)
		return templates
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Get Email Templates Failed")
		frappe.throw(f"Failed to get Email templates: {e!s}")


@frappe.whitelist()
def get_email_template(template_name):
    """
    Get a specific Email template by name
    """
    try:
        template = frappe.get_doc("Email Template", template_name)
        return {
            "name": template.name,
            "subject": template.subject,
            "response_html": template.response_html,
            "response": template.response,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Email Template Failed")
        frappe.throw(f"Failed to get Email template: {e!s}")


def _format_account(doc: EmailAccount, source: str) -> dict:
    return {
        "name": getattr(doc, "name", None),
        "email_id": getattr(doc, "email_id", None),
        "default_sender": getattr(doc, "default_sender", None),
        "source": source,
        "is_exists_in_db": bool(getattr(doc, "is_exists_in_db", lambda: False)()),
    }


@frappe.whitelist()
def get_available_outgoing_accounts(
    user: str | None = None, company: str | None = None
) -> list[dict]:
    """
    Get a list of email accounts that can be used to send emails.

    Order of selection:
    1. Accounts linked to the user's email.
    2. The system's default outgoing account.
    3. Account set in site configuration.

    Returns a list of accounts with basic details.
    """

    accounts: list[dict] = []
    seen = set()

    user = user or frappe.session.user

    if user:
        user_emails = frappe.get_all(
            "User Email",
            filters={"parent": user, "enable_outgoing": 1},
            fields=["email_account", "email_id", "awaiting_password", "used_oauth"],
        )

        for ue in user_emails:
            email_account_name = ue.get("email_account")
            if not email_account_name or email_account_name in seen:
                continue
            try:
                doc = frappe.get_doc("Email Account", email_account_name)
            except Exception:
                continue

            entry = _format_account(doc, "user_email")
            entry.update(
                {
                    "user_email_id": ue.get("email_id"),
                    "awaiting_password": bool(ue.get("awaiting_password")),
                    "used_oauth": bool(ue.get("used_oauth")),
                }
            )
            accounts.append(entry)
            seen.add(email_account_name)

    # default outgoing
    try:
        default_doc = EmailAccount.find_default_outgoing()
    except Exception:
        default_doc = None

    if default_doc:
        if isinstance(default_doc, dict):
            default_doc = next(iter(default_doc.values()))
        if getattr(default_doc, "name", None) and default_doc.name not in seen:
            accounts.append(_format_account(default_doc, "default_outgoing"))
            seen.add(default_doc.name)

    # site config (explicit)
    try:
        site_doc = EmailAccount.find_from_config()
    except Exception:
        site_doc = None

    if site_doc:
        name = getattr(site_doc, "name", None)
        if name and name not in seen:
            accounts.append(_format_account(site_doc, "site_config"))
            seen.add(name)

    return {
        "status": "success",
        "accounts": accounts,
    }


@frappe.whitelist()
def ensure_outgoing_configured(
    user: str | None = None, company: str | None = None
) -> bool:
    """Return True if at least one outgoing Email Account candidate exists.

    Use this before sending an invoice to prompt the user to configure/select an account.
    """
    accounts = get_available_outgoing_accounts(user=user, company=company)
    return bool(accounts)
