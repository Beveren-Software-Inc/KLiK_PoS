import frappe, json
from frappe.utils import now, fmt_money
from klik_pos.klik_pos.utils import get_current_pos_profile

@frappe.whitelist()
def send_invoice_whatsapp(**kwargs):
    """
    Accepts frontend payload and sends invoice WhatsApp message with PDF attachment.
    """
    data = kwargs
    print("Data", data)
    mobile = data.get("mobile_no")
    customer_name = data.get("customer_name")
    invoice_no = data.get("invoice_data")

    if not (mobile and invoice_no):
        frappe.throw("Mobile number and invoice number are required.")

    try:
        doc = frappe.get_doc("Sales Invoice", invoice_no)

        # Get POS print format
        pos_profile = get_current_pos_profile()
        print_format = pos_profile.custom_pos_printformat or "Standard"

        # Generate PDF
        pdf_data = frappe.get_print(
            "Sales Invoice", 
            doc.name, 
            print_format=print_format, 
            as_pdf=True
        )

        # Format invoice amount
        invoice_amount = fmt_money(doc.rounded_total or doc.grand_total, currency=doc.currency)
        
        # WhatsApp Settings
        app_settings = frappe.get_doc("WhatsApp Settings", "WhatsApp Settings")
        token = app_settings.get_password("token")
        facebook_url = f"{app_settings.url}/{app_settings.version}/{app_settings.phone_id}/messages"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

        # Build WhatsApp template payload
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": mobile,
            "type": "template",
            "template": {
                "name": "invoice_notification",
                "language": {"code": "en_US"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": customer_name},
                            {"type": "text", "text": doc.name},
                            {"type": "text", "text": invoice_amount},
                        ],
                    }
                ],
            },
        }

        frappe.make_post_request(
            facebook_url,
            headers=headers,
            data=json.dumps(data, indent=4, sort_keys=True, default=str),
        )

        return {
            "status": "success",
            "recipient": mobile,
            "invoice": invoice_no,
            "amount": invoice_amount,
            "print_format": print_format,
            "timestamp": now(),
        }
                         
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Invoice WhatsApp Failed")
        frappe.throw(f"Failed to send WhatsApp message: {str(e)}")
