import frappe, json
from frappe.utils import now, fmt_money
from klik_pos.klik_pos.utils import get_current_pos_profile
from frappe.core.doctype.sms_settings.sms_settings import send_sms

@frappe.whitelist()
def send_invoice_sms(**kwargs):
    """
    Accepts frontend payload and sends invoice SMS using ERPNext's built-in SMS functionality.
    """
    data = kwargs

    mobile = data.get("mobile_no")
    customer_name = data.get("customer_name")
    invoice_no = data.get("invoice_data")
    message_text = data.get("message", "Your invoice is ready!")

    if not (mobile and invoice_no):
        frappe.throw("Mobile number and invoice number are required.")

    try:
        doc = frappe.get_doc("Sales Invoice", invoice_no)

        # Get POS print format
        pos_profile = get_current_pos_profile()
        print_format = pos_profile.custom_pos_printformat or "Standard"

        # Format invoice amount
        invoice_amount = fmt_money(doc.rounded_total or doc.grand_total, currency=doc.currency)

        # Create SMS message with invoice details
        sms_message = f"""
Hi {customer_name}!
Thank you for your purchase at {frappe.defaults.get_user_default('Company')}.
Invoice: {doc.name}
Amount: {invoice_amount}
Thank you!
        """.strip()

        # Use custom message if provided
        if message_text and message_text != "Your invoice is ready!":
            sms_message = message_text

        # Send SMS using ERPNext's built-in SMS functionality
        send_sms(
            receiver_list=[mobile],
            msg=sms_message,
            success_msg=True
        )

        return {
            "status": "success",
            "recipient": mobile,
            "invoice": invoice_no,
            "amount": invoice_amount,
            "print_format": print_format,
            "message": sms_message,
            "timestamp": now(),
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Invoice SMS Failed")
        frappe.throw(f"Failed to send SMS: {str(e)}")


@frappe.whitelist()
def send_sms_message(**kwargs):
    """
    Send a simple SMS message using ERPNext's built-in SMS functionality.
    """
    data = kwargs

    mobile = data.get("mobile_no")
    message_text = data.get("message")
    customer_name = data.get("customer_name", "")

    if not mobile:
        frappe.throw("Mobile number is required.")

    if not message_text:
        frappe.throw("Message content is required.")

    try:
        # Format message with customer name if provided
        if customer_name:
            formatted_message = f"Hi {customer_name}!\n\n{message_text}"
        else:
            formatted_message = message_text

        # Send SMS using ERPNext's built-in SMS functionality
        send_sms(
            receiver_list=[mobile],
            msg=formatted_message,
            success_msg=True
        )

        return {
            "status": "success",
            "recipient": mobile,
            "message": formatted_message,
            "timestamp": now(),
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send SMS Failed")
        frappe.throw(f"Failed to send SMS: {str(e)}")


@frappe.whitelist()
def get_sms_settings():
    """
    Get SMS settings from ERPNext to check if SMS is configured.
    """
    try:
        # Check if SMS settings exist
        sms_settings = frappe.get_single("SMS Settings")

        return {
            "status": "success",
            "enabled": sms_settings.enabled if sms_settings else False,
            "gateway": sms_settings.sms_gateway_url if sms_settings else None,
            "message": "SMS settings retrieved successfully"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get SMS Settings Failed")
        return {
            "status": "error",
            "enabled": False,
            "message": f"Failed to get SMS settings: {str(e)}"
        }
