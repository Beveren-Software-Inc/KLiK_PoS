import frappe, json
from frappe.utils import now, fmt_money
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

    if not (email and invoice_no):
        frappe.throw("Email and invoice number are required.")

    try:
        doc = frappe.get_doc("Sales Invoice", invoice_no)

        pos_profile = get_current_pos_profile()
        print_format = pos_profile.custom_pos_printformat or "Standard"

        pdf_data = frappe.get_print(
            "Sales Invoice",
            doc.name,
            print_format=print_format,
            as_pdf=True
        )

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
        frappe.throw(f"Failed to send invoice email: {str(e)}")


@frappe.whitelist()
def get_email_templates():
    """
    Get all Email templates
    """
    try:
        templates = frappe.get_all(
            "Email Template",
            filters={},
            fields=[
                "name",
                "subject",
                "response_html",
                "response"
            ]
        )
        return templates
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Email Templates Failed")
        frappe.throw(f"Failed to get Email templates: {str(e)}")


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
            "response": template.response
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Email Template Failed")
        frappe.throw(f"Failed to get Email template: {str(e)}")

