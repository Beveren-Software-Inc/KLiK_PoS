import frappe, json
from frappe.utils import now, fmt_money
from klik_pos.klik_pos.utils import get_current_pos_profile
from klik_pos.api.whatsap.utils import send_whatsapp_message

@frappe.whitelist()
def deliver_invoice_via_whatsapp(**kwargs):
    """
    Send simple text WhatsApp message from frontend
    """
    data = kwargs
    print("Simple WhatsApp data", data)

    mobile = data.get("mobile_no")
    customer_name = data.get("customer_name")
    invoice_name = data.get("invoice_data")
    message = data.get("message", "Your invoice is ready! Mania Go pick it lol")
    if not mobile:
        frappe.throw("Mobile number is required.")

    try:
        # Debug logging
        frappe.logger().debug(f"Frontend call - Mobile: {mobile}, Invoice: {invoice_name}, Message: {message}")

        # If we have invoice data, send as document with PDF
        if invoice_name:
            result = send_whatsapp_message(
                to_number=mobile,
                message_type="text",
                message_content=message,
                reference_doctype="Sales Invoice",
                reference_name=invoice_name,
                attach_document=True
            )
        else:
            # Send simple text message
            result = send_whatsapp_message(
                to_number=mobile,
                message_type="text",
                message_content=message
            )

        if result.get("success"):
            return {
                "status": "success",
                "recipient": mobile,
                "message": message,
                "invoice": invoice_name,
                "customer_name": customer_name,
                "message_id": result.get("message_id"),
                "timestamp": now(),
            }
        else:
            frappe.throw(f"Failed to send WhatsApp message: {result.get('error')}")

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Simple WhatsApp Failed")
        frappe.log_error(f"Error details: {str(e)}", "Send Simple WhatsApp Failed")
        frappe.log_error(f"Input data: {data}", "Send Simple WhatsApp Failed")
        frappe.throw(f"Failed to send WhatsApp message: {str(e)}")


@frappe.whitelist()
def send_invoice_whatsapp(**kwargs):
    """
    Accepts frontend payload and sends invoice WhatsApp message with PDF attachment.
    """
    data = kwargs
    print("Invoice WhatsApp data", data)
    mobile = data.get("mobile_no")
    customer_name = data.get("customer_name")
    invoice_no = data.get("invoice_data")
    message_text = data.get("message", "Your invoice is ready! Mania")

    if not (mobile and invoice_no):
        frappe.throw("Mobile number and invoice number are required.")

    try:
        doc = frappe.get_doc("Sales Invoice", invoice_no)

        # Get POS print format
        pos_profile = get_current_pos_profile()
        print_format = pos_profile.custom_pos_printformat or "Standard"

        # Format invoice amount
        invoice_amount = fmt_money(doc.rounded_total or doc.grand_total, currency=doc.currency)

        # Send WhatsApp message with document attachment using the utility function
        result = send_whatsapp_message(
            to_number=mobile,
            message_type="text",  # Use text message with attachment
            message_content=message_text,
            reference_doctype="Sales Invoice",
            reference_name=invoice_no,
            attach_document=True
        )

        if result.get("success"):
            return {
                "status": "success",
                "recipient": mobile,
                "invoice": invoice_no,
                "amount": invoice_amount,
                "print_format": print_format,
                "message_id": result.get("message_id"),
                "timestamp": now(),
            }
        else:
            frappe.throw(f"Failed to send WhatsApp message: {result.get('error')}")

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Invoice WhatsApp Failed")
        frappe.throw(f"Failed to send WhatsApp message: {str(e)}")

@frappe.whitelist()
def send_template_whatsapp(**kwargs):
    """
    Send template WhatsApp message from frontend
    """
    data = kwargs
    print("Template WhatsApp data", data)

    mobile = data.get("mobile_no")
    template_name = data.get("template_name")
    template_parameters = data.get("template_parameters")

    if not mobile:
        frappe.throw("Mobile number is required.")

    if not template_name:
        frappe.throw("Template name is required.")

    try:
        # Use the utility function from utils.py
        result = send_whatsapp_message(
            to_number=mobile,
            message_type="template",
            template_name=template_name,
            template_parameters=template_parameters
        )

        if result.get("success"):
            return {
                "status": "success",
                "recipient": mobile,
                "template": template_name,
                "parameters": template_parameters,
                "message_id": result.get("message_id"),
                "timestamp": now(),
            }
        else:
            frappe.throw(f"Failed to send WhatsApp message: {result.get('error')}")

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Template WhatsApp Failed")
        frappe.throw(f"Failed to send WhatsApp message: {str(e)}")


@frappe.whitelist()
def deliver_invoice_via_whatsapp_doc(invoice_name, mobile_no=None, message=None):
    """
    Send WhatsApp message for a Sales Invoice directly from the invoice form
    """
    invoice = frappe.get_doc("Sales Invoice", invoice_name)
    customer = frappe.get_doc("Customer", invoice.customer)

    mobile = mobile_no or customer.mobile_no or invoice.contact_mobile
    customer_name = invoice.customer_name
    message = message or f"Hello {customer_name}, your invoice {invoice.name} is ready! Thank you for shopping with us."


    if not mobile:
        frappe.throw("No mobile number found or entered.")

    result = send_whatsapp_message(
        to_number=mobile,
        message_type="text",
        message_content=message,
        reference_doctype="Sales Invoice",
        reference_name=invoice.name,
        attach_document=True
    )

    if result.get("success"):
        return {
            "status": "success",
            "recipient": mobile,
            "message": message,
            "invoice": invoice.name,
            "customer_name": customer_name,
            "message_id": result.get("message_id"),
            "timestamp": now(),
        }
    else:
        frappe.throw(f"Failed to send WhatsApp message: {result.get('error')}")
