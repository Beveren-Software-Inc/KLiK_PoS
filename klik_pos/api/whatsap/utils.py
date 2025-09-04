"""
WhatsApp Utility Functions for KLIK POS
Standalone functions for sending WhatsApp messages from both backend and frontend
"""

import json
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.integrations.utils import make_post_request
from frappe.utils.safe_exec import get_safe_globals, safe_exec
from frappe.desk.form.utils import get_pdf_link
from frappe.utils import add_to_date, nowdate, datetime


@frappe.whitelist()
def send_whatsapp_message(
    to_number,
    message_type="text",
    message_content=None,
    template_name=None,
    template_parameters=None,
    reference_doctype=None,
    reference_name=None,
    attach_document=False,
    custom_attachment=None,
    file_name=None
):
    """
    Standalone function to send WhatsApp messages

    Args:
        to_number (str): Phone number with country code (e.g., "1234567890")
        message_type (str): "text" or "template"
        message_content (str): Text message content (for text messages)
        template_name (str): Template name from WhatsApp Message Templates
        template_parameters (list): List of parameters for template
        reference_doctype (str): Reference doctype name
        reference_name (str): Reference document name
        attach_document (bool): Whether to attach document PDF
        custom_attachment (str): Custom file URL or path
        file_name (str): Name for the attachment

    Returns:
        dict: Response with success status and message details
    """
    try:
        # Get WhatsApp settings
        settings = frappe.get_doc("WhatsApp Setup", "WhatsApp Setup")
        if not settings.enabled:
            return {"success": False, "error": "WhatsApp is not enabled"}

        token = settings.get_password("token")
        if not token:
            return {"success": False, "error": "WhatsApp token not configured"}

        # Format phone number
        formatted_number = format_phone_number(to_number)

        if message_type == "text":
            return send_text_message(
                formatted_number,
                message_content,
                settings,
                token,
                reference_doctype,
                reference_name,
                attach_document
            )
        elif message_type == "template":
            return send_template_message(
                formatted_number,
                template_name,
                template_parameters,
                settings,
                token,
                reference_doctype,
                reference_name,
                attach_document,
                custom_attachment,
                file_name
            )
        else:
            return {"success": False, "error": f"Unsupported message type: {message_type}"}

    except Exception as e:
        frappe.log_error(f"WhatsApp Message Error: {str(e)}", "WhatsApp Messaging")
        return {"success": False, "error": str(e)}


def send_text_message(to_number, message_content, settings, token, reference_doctype=None, reference_name=None, attach_document=False):
    """Send a simple text message with optional document attachment"""

    # If we need to attach a document, we need to send as a document message
    if attach_document and reference_doctype and reference_name:
        # Get document URL
        document_url = get_document_attachment_url(reference_doctype, reference_name)

        if document_url:
            data = {
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "document",
                "document": {
                    "link": document_url,
                    "filename": "REPC-SRET-000001_PDFA3.pdf",
                    "caption": message_content
                }
            }
        else:
            # Fallback to text message with PDF generation instructions
            enhanced_message = f"{message_content}\n\n📄 PDF Generation: Your invoice PDF is ready but cannot be sent via WhatsApp in development mode. Please contact support to get your PDF."
            data = {
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "text",
                "text": {
                    "preview_url": True,
                    "body": enhanced_message
                }
            }
    else:
        # Regular text message
        data = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {
                "preview_url": True,
                "body": message_content
            }
        }

    # Log the exact request being sent
    frappe.logger().debug(f"Text message request data: {json.dumps(data, indent=2)}")
    frappe.logger().debug(f"Phone number: {to_number}")
    frappe.logger().debug(f"Message content: {message_content}")
    frappe.logger().debug(f"Attach document: {attach_document}")
    frappe.logger().debug(f"Document URL: {document_url if attach_document and reference_doctype and reference_name else 'N/A'}")

    return make_whatsapp_api_call(data, settings, token, reference_doctype, reference_name, "Manual")


def send_template_message(
    to_number,
    template_name,
    template_parameters,
    settings,
    token,
    reference_doctype=None,
    reference_name=None,
    attach_document=False,
    custom_attachment=None,
    file_name=None
):
    """Send a template message"""
    # Get template details
    template = frappe.get_doc("WhatsApp Message Templates", template_name)

    # Validate template parameters
    if template_parameters:
        # Ensure template_parameters is a list
        if isinstance(template_parameters, str):
            try:
                template_parameters = json.loads(template_parameters)
            except:
                template_parameters = [template_parameters]

        # Validate each parameter
        validated_parameters = []
        for i, param in enumerate(template_parameters):
            if param is not None:
                validated_parameters.append(str(param).strip())
            else:
                validated_parameters.append("")

        template_parameters = validated_parameters

        # Log the parameters for debugging
        frappe.logger().debug(f"Template parameters: {template_parameters}")
        frappe.logger().debug(f"Template field names: {template.field_names}")
        frappe.logger().debug(f"Template sample values: {template.sample_values}")

    data = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template.actual_name or template.template_name,
            "language": {"code": template.language_code},
            "components": []
        }
    }

    # Add body parameters if provided
    if template_parameters:
        parameters = []
        for param in template_parameters:
            # Ensure parameter is a string and not split into characters
            param_text = str(param).strip()
            if param_text:  # Only add non-empty parameters
                parameters.append({
                    "type": "text",
                    "text": param_text
                })

        if parameters:  # Only add components if we have parameters
            data["template"]["components"].append({
                "type": "body",
                "parameters": parameters
            })

    # Handle attachments
    if attach_document and reference_doctype and reference_name:
        url = get_document_attachment_url(reference_doctype, reference_name)
        if url:
            data["template"]["components"].append({
                "type": "header",
                "parameters": [{
                    "type": "document",
                    "document": {
                        "link": url,
                        "filename": f"{reference_name}.pdf"
                    }
                }]
            })
    elif custom_attachment:
        url = get_custom_attachment_url(custom_attachment)
        if url:
            data["template"]["components"].append({
                "type": "header",
                "parameters": [{
                    "type": "document",
                    "document": {
                        "link": url,
                        "filename": file_name or "attachment.pdf"
                    }
                }]
            })

    return make_whatsapp_api_call(data, settings, token, reference_doctype, reference_name, "Template", template_name, template_parameters)


def make_whatsapp_api_call(data, settings, token, reference_doctype=None, reference_name=None, message_type="Manual", template_name=None, template_parameters=None):
    """Make the actual API call to WhatsApp"""
    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "application/json"
    }

    # Debug logging
    frappe.logger().debug(f"WhatsApp API Request URL: {settings.url}/{settings.version}/{settings.phone_id}/messages")
    frappe.logger().debug(f"WhatsApp API Headers: {headers}")
    frappe.logger().debug(f"WhatsApp API Data: {json.dumps(data, indent=2)}")

    try:
        # Validate required settings
        if not settings.url:
            return {"success": False, "error": "WhatsApp URL is not configured"}
        if not settings.version:
            return {"success": False, "error": "WhatsApp API version is not configured"}
        if not settings.phone_id:
            return {"success": False, "error": "WhatsApp Phone ID is not configured"}
        if not token:
            return {"success": False, "error": "WhatsApp token is not configured"}

        # Validate phone number format
        if not data.get("to") or not data["to"].isdigit():
            return {"success": False, "error": f"Invalid phone number format: {data.get('to')}. Must be digits only (without +)"}
        print(str(data))
        # Make the API call
        response = make_post_request(
            f"{settings.url}/{settings.version}/{settings.phone_id}/messages",
            headers=headers,
            data=json.dumps(data)
        )

        frappe.logger().debug(f"WhatsApp API Response: {json.dumps(response, indent=2)}")

        # Create WhatsApp message record
        message_doc = frappe.new_doc("WhatsApp Chat")
        message_doc.type = "Outgoing"
        message_doc.to = data["to"]
        message_doc.message_type = message_type
        message_doc.content_type = "text"
        message_doc.status = "Success"

        if message_type == "Template":
            message_doc.template = template_name
            message_doc.use_template = 1
            if template_parameters:
                message_doc.template_parameters = json.dumps(template_parameters)
            message_doc.message = str(data["template"])
        elif data.get("type") == "document":
            # Handle document messages
            message_doc.content_type = "document"
            message_doc.message = data["document"].get("caption", "Document sent")
        else:
            message_doc.message = data["text"]["body"]

        if reference_doctype and reference_name:
            message_doc.reference_doctype = reference_doctype
            message_doc.reference_name = reference_name

        if "messages" in response:
            message_doc.message_id = response["messages"][0]["id"]

        message_doc.insert(ignore_permissions=True)

        return {
            "success": True,
            "message_id": response.get("messages", [{}])[0].get("id"),
            "whatsapp_message_name": message_doc.name
        }

    except Exception as e:
        error_message = str(e)
        error_details = {}

        # Try to get detailed error information
        if frappe.flags.integration_request:
            try:
                error_response = frappe.flags.integration_request.json()
                error_details = error_response
                if 'error' in error_response:
                    error_message = error_response['error'].get('message', error_response['error'].get('Error', error_message))
            except:
                pass

        # Log detailed error information
        frappe.log_error(
            f"WhatsApp API Error Details:\n"
            f"Error: {error_message}\n"
            f"URL: {settings.url}/{settings.version}/{settings.phone_id}/messages\n"
            f"Data: {json.dumps(data, indent=2)}\n"
            f"Error Details: {json.dumps(error_details, indent=2)}\n"
            f"Response Status: {getattr(frappe.flags.integration_request, 'status_code', 'Unknown') if frappe.flags.integration_request else 'Unknown'}\n"
            f"Response Text: {getattr(frappe.flags.integration_request, 'text', 'Unknown') if frappe.flags.integration_request else 'Unknown'}",
            "WhatsApp Messaging"
        )

        return {
            "success": False,
            "error": error_message,
            "error_details": error_details
        }


def format_phone_number(number):
    """Format phone number for WhatsApp API"""
    if number.startswith("+"):
        number = number[1:]
    return number


def get_document_attachment_url(doctype, docname):
    """Get PDF attachment URL for a document"""
    try:
        # For testing purposes, use the static PDF URL
        if doctype == "Sales Invoice":
            pdf_url = get_invoice_pdf_url(doctype, docname)

            return "https://clik-pos.k.frappe.cloud/files/REPC-SRET-000001_PDFA3%20(14).pdf"

        doc = frappe.get_doc(doctype, docname)
        key = doc.get_document_share_key()
        frappe.db.commit()

        print_format = "Standard"
        doctype_meta = frappe.get_doc("DocType", doctype)
        if doctype_meta.custom:
            if doctype_meta.default_print_format:
                print_format = doctype_meta.default_print_format
        else:
            default_print_format = frappe.db.get_value(
                "Property Setter",
                filters={
                    "doc_type": doctype,
                    "property": "default_print_format"
                },
                fieldname="value"
            )
            print_format = default_print_format if default_print_format else print_format

        link = get_pdf_link(doctype, docname, print_format=print_format)
        site_url = frappe.utils.get_url()

        # Check if we're using a local URL
        if '127.0.0.1' in site_url or 'localhost' in site_url:
            frappe.logger().warning(f"Local URL detected: {site_url}. Document sharing may not work with WhatsApp API.")
            return None 

        return f'{site_url}{link}&key={key}'
    except Exception as e:
        frappe.log_error(f"Error getting document attachment URL: {str(e)}", "WhatsApp Messaging")
        return None


def get_custom_attachment_url(attachment_path):
    """Get URL for custom attachment"""
    if attachment_path.startswith("http"):
        return attachment_path
    else:
        return f'{frappe.utils.get_url()}{attachment_path}'


# Frontend-friendly wrapper functions
@frappe.whitelist()
def send_whatsapp_text(to_number, message_content, reference_doctype=None, reference_name=None):
    """Whitelisted function for sending text messages from frontend"""
    return send_whatsapp_message(
        to_number=to_number,
        message_type="text",
        message_content=message_content,
        reference_doctype=reference_doctype,
        reference_name=reference_name
    )


@frappe.whitelist()
def send_whatsapp_template(to_number, template_name, template_parameters=None, reference_doctype=None, reference_name=None):
    """Whitelisted function for sending template messages from frontend"""
    if template_parameters and isinstance(template_parameters, str):
        template_parameters = json.loads(template_parameters)

    return send_whatsapp_message(
        to_number=to_number,
        message_type="template",
        template_name=template_name,
        template_parameters=template_parameters,
        reference_doctype=reference_doctype,
        reference_name=reference_name
    )


@frappe.whitelist()
def get_whatsapp_templates():
    """Get list of available WhatsApp templates"""
    templates = frappe.get_all(
        "WhatsApp Message Templates",
        filters={"status": "Approved"},
        fields=["name", "template_name", "actual_name", "category", "language"]
    )
    return templates


@frappe.whitelist()
def test_whatsapp_connection():
    """Test WhatsApp API connection"""
    try:
        settings = frappe.get_doc("WhatsApp Setup", "WhatsApp Setup")
        token = settings.get_password("token")

        if not all([settings.enabled, token, settings.url, settings.version, settings.phone_id]):
            return {
                "success": False,
                "error": "All WhatsApp settings must be configured before testing"
            }

        # Test with a simple request to get phone number info
        headers = {
            "authorization": f"Bearer {token}",
            "content-type": "application/json"
        }

        test_url = f"{settings.url}/{settings.version}/{settings.phone_id}"

        response = frappe.integrations.utils.make_get_request(
            test_url,
            headers=headers
        )

        return {
            "success": True,
            "message": "WhatsApp API connection successful",
            "phone_info": response
        }

    except Exception as e:
        error_message = str(e)
        if frappe.flags.integration_request:
            try:
                error_response = frappe.flags.integration_request.json()
                error_message = error_response.get('error', {}).get('message', error_message)
            except:
                pass

        return {
            "success": False,
            "error": f"Connection test failed: {error_message}"
        }


@frappe.whitelist()
def troubleshoot_whatsapp_error(error_message):
    """
    Troubleshoot common WhatsApp API errors and provide solutions

    Args:
        error_message (str): The error message from the API

    Returns:
        dict: Troubleshooting information and solutions
    """
    common_errors = {
        "400": {
            "title": "Bad Request (400)",
            "description": "The request was malformed or contains invalid parameters",
            "common_causes": [
                "Invalid phone number format",
                "Missing required parameters",
                "Invalid template name",
                "Template not approved",
                "Invalid API version",
                "Incorrect phone ID"
            ],
            "solutions": [
                "Ensure phone number is in international format without + (e.g., 1234567890)",
                "Verify all required template parameters are provided",
                "Check that template name matches exactly with approved template",
                "Ensure template is approved in WhatsApp Business Manager",
                "Verify API version is correct (usually v17.0 or v18.0)",
                "Confirm phone ID is correct and active"
            ]
        },
        "401": {
            "title": "Unauthorized (401)",
            "description": "Authentication failed",
            "common_causes": [
                "Invalid access token",
                "Token expired",
                "Incorrect token format"
            ],
            "solutions": [
                "Regenerate access token in WhatsApp Business Manager",
                "Ensure token is copied correctly without extra spaces",
                "Check token permissions include messaging"
            ]
        },
        "403": {
            "title": "Forbidden (403)",
            "description": "Access denied",
            "common_causes": [
                "Insufficient permissions",
                "Phone number not verified",
                "Business account not approved"
            ],
            "solutions": [
                "Verify business account is approved",
                "Ensure phone number is verified",
                "Check account permissions"
            ]
        },
        "404": {
            "title": "Not Found (404)",
            "description": "Resource not found",
            "common_causes": [
                "Invalid phone ID",
                "Template not found",
                "Incorrect API endpoint"
            ],
            "solutions": [
                "Verify phone ID is correct",
                "Check template name spelling",
                "Ensure API URL is correct"
            ]
        }
    }

    # Extract error code from message
    error_code = None
    for code in common_errors.keys():
        if code in error_message:
            error_code = code
            break

    if error_code and error_code in common_errors:
        return {
            "error_code": error_code,
            "troubleshooting": common_errors[error_code],
            "raw_error": error_message
        }
    else:
        return {
            "error_code": "unknown",
            "troubleshooting": {
                "title": "Unknown Error",
                "description": "This error is not in our common error database",
                "common_causes": ["Unknown API error"],
                "solutions": [
                    "Check WhatsApp Business Manager for detailed error information",
                    "Verify all settings are correct",
                    "Contact WhatsApp support if issue persists"
                ]
            },
            "raw_error": error_message
        }


@frappe.whitelist()
def validate_phone_number_format(phone_number):
    """
    Validate and format phone number for WhatsApp API

    Args:
        phone_number (str): Phone number to validate

    Returns:
        dict: Validation result and formatted number
    """
    try:
        # Remove all non-digit characters
        cleaned = ''.join(filter(str.isdigit, phone_number))

        # Validation rules
        if len(cleaned) < 10:
            return {
                "valid": False,
                "error": "Phone number too short (minimum 10 digits)"
            }

        if len(cleaned) > 15:
            return {
                "valid": False,
                "error": "Phone number too long (maximum 15 digits)"
            }

        # Check if it starts with country code
        if len(cleaned) == 10:
            return {
                "valid": False,
                "error": "Phone number should include country code (e.g., 1 for US, 44 for UK)"
            }

        return {
            "valid": True,
            "formatted": cleaned,
            "original": phone_number,
            "length": len(cleaned)
        }

    except Exception as e:
        return {
            "valid": False,
            "error": f"Validation error: {str(e)}"
        }


@frappe.whitelist()
def get_whatsapp_template_status(template_name):
    """
    Check the status of a WhatsApp template

    Args:
        template_name (str): Name of the template to check

    Returns:
        dict: Template status information
    """
    try:
        template = frappe.get_doc("WhatsApp Message Templates", template_name)

        return {
            "name": template.name,
            "template_name": template.template_name,
            "actual_name": template.actual_name,
            "status": template.status,
            "language_code": template.language_code,
            "category": template.category,
            "field_names": template.field_names,
            "sample_values": template.sample_values,
            "is_approved": template.status == "Approved",
            "can_send": template.status == "Approved"
        }

    except Exception as e:
        return {
            "error": f"Template not found or error: {str(e)}",
            "template_name": template_name
        }


@frappe.whitelist()
def send_invoice_whatsapp_enhanced(**kwargs):
    """
    Enhanced version of send_invoice_whatsapp with better error handling and flexibility
    """
    data = kwargs
    mobile = data.get("mobile_no")
    customer_name = data.get("customer_name")
    invoice_no = data.get("invoice_data")
    template_name = data.get("template_name", "invoice_notification")

    if not (mobile and invoice_no):
        return {"success": False, "error": "Mobile number and invoice number are required."}

    try:
        doc = frappe.get_doc("Sales Invoice", invoice_no)

        # Format invoice amount
        invoice_amount = frappe.utils.fmt_money(doc.rounded_total or doc.grand_total, currency=doc.currency)

        # Prepare template parameters
        template_parameters = [customer_name, doc.name, invoice_amount]

        # Send WhatsApp message with document attachment
        result = send_whatsapp_message(
            to_number=mobile,
            message_type="template",
            template_name=template_name,
            template_parameters=template_parameters,
            reference_doctype="Sales Invoice",
            reference_name=invoice_no,
            attach_document=True
        )

        if result.get("success"):
            return {
                "success": True,
                "status": "success",
                "recipient": mobile,
                "invoice": invoice_no,
                "amount": invoice_amount,
                "message_id": result.get("message_id"),
                "timestamp": frappe.utils.now(),
            }
        else:
            return {
                "success": False,
                "error": result.get("error"),
                "recipient": mobile,
                "invoice": invoice_no
            }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Send Invoice WhatsApp Enhanced Failed")
        return {"success": False, "error": f"Failed to send WhatsApp message: {str(e)}"}


@frappe.whitelist()
def send_bulk_whatsapp_messages(recipients, message_type="text", message_content=None, template_name=None, template_parameters=None):
    """
    Send WhatsApp messages to multiple recipients

    Args:
        recipients (list): List of phone numbers
        message_type (str): "text" or "template"
        message_content (str): Text message content
        template_name (str): Template name
        template_parameters (list): Template parameters

    Returns:
        dict: Results for each recipient
    """
    if isinstance(recipients, str):
        recipients = json.loads(recipients)

    if isinstance(template_parameters, str):
        template_parameters = json.loads(template_parameters)

    results = []

    for recipient in recipients:
        result = send_whatsapp_message(
            to_number=recipient,
            message_type=message_type,
            message_content=message_content,
            template_name=template_name,
            template_parameters=template_parameters
        )

        results.append({
            "recipient": recipient,
            "success": result.get("success"),
            "error": result.get("error"),
            "message_id": result.get("message_id")
        })

    return {
        "total_sent": len([r for r in results if r.get("success")]),
        "total_failed": len([r for r in results if not r.get("success")]),
        "results": results
    }


@frappe.whitelist()
def test_invoice_with_pdf(phone_number, invoice_no, message="Your invoice is ready! Maniac"):
    """
    Test sending invoice with PDF attachment

    Args:
        phone_number (str): Phone number to send to
        invoice_no (str): Invoice number
        message (str): Message to send with the PDF

    Returns:
        dict: Test result with detailed debugging info
    """
    try:
        # Get settings
        settings = frappe.get_doc("WhatsApp Setup", "WhatsApp Setup")
        token = settings.get_password("token")

        # Format phone number
        formatted_number = format_phone_number(phone_number)

        # Get document URL
        document_url = get_document_attachment_url("Sales Invoice", invoice_no)

        if not document_url:
            # Send text message instead with PDF generation notice
            data = {
                "messaging_product": "whatsapp",
                "to": formatted_number,
                "type": "text",
                "text": {
                    "preview_url": True,
                    "body": f"{message}\n\n📄 PDF Generation: Your invoice PDF is ready but cannot be sent via WhatsApp in development mode. Please contact support to get your PDF."
                }
            }
        else:
            # Prepare the request data for document message
            data = {
                "messaging_product": "whatsapp",
                "to": formatted_number,
                "type": "document",
                "document": {
                    "link": document_url,
                    "filename": "REPC-SRET-000001_PDFA3.pdf",
                    "caption": message
                }
            }

        headers = {
            "authorization": f"Bearer {token}",
            "content-type": "application/json"
        }

        # Log the exact request that will be sent
        request_url = f"{settings.url}/{settings.version}/{settings.phone_id}/messages"
        request_data = json.dumps(data, indent=2)

        frappe.logger().debug(f"Test Invoice PDF Request URL: {request_url}")
        frappe.logger().debug(f"Test Invoice PDF Request Data: {request_data}")
        # frappe.throw(str(data))
        # Make the actual request
        response = frappe.integrations.utils.make_post_request(
            request_url,
            headers=headers,
            data=request_data
        )

        return {
            "success": True,
            "message": "Invoice PDF test successful",
            "request_url": request_url,
            "request_data": data,
            "response": response,
            "phone_number": formatted_number,
            "invoice_no": invoice_no,
            "document_url": document_url,
            "message_content": message
        }

    except Exception as e:
        error_message = str(e)
        error_details = {}

        if frappe.flags.integration_request:
            try:
                error_response = frappe.flags.integration_request.json()
                error_details = error_response
                if 'error' in error_response:
                    error_message = error_response['error'].get('message', error_response['error'].get('Error', error_message))
            except:
                pass

        return {
            "success": False,
            "error": error_message,
            "error_details": error_details,
            "request_url": request_url if 'request_url' in locals() else None,
            "request_data": data if 'data' in locals() else None,
            "phone_number": formatted_number if 'formatted_number' in locals() else None,
            "invoice_no": invoice_no,
            "document_url": document_url if 'document_url' in locals() else None,
            "message_content": message
        }


@frappe.whitelist()
def test_simple_text_message(phone_number, message="Test message"):
    """
    Test simple text message to debug the 400 error

    Args:
        phone_number (str): Phone number to send to
        message (str): Test message

    Returns:
        dict: Test result with detailed debugging info
    """
    try:
        # Get settings
        settings = frappe.get_doc("WhatsApp Setup", "WhatsApp Setup")
        token = settings.get_password("token")

        # Format phone number
        formatted_number = format_phone_number(phone_number)

        # Prepare the request data exactly as it will be sent
        data = {
            "messaging_product": "whatsapp",
            "to": formatted_number,
            "type": "text",
            "text": {
                "preview_url": True,
                "body": message
            }
        }

        headers = {
            "authorization": f"Bearer {token}",
            "content-type": "application/json"
        }

        # Log the exact request that will be sent
        request_url = f"{settings.url}/{settings.version}/{settings.phone_id}/messages"
        request_data = json.dumps(data, indent=2)

        frappe.logger().debug(f"Test Text Request URL: {request_url}")
        frappe.logger().debug(f"Test Text Request Data: {request_data}")

        # Make the actual request
        response = frappe.integrations.utils.make_post_request(
            request_url,
            headers=headers,
            data=request_data
        )

        return {
            "success": True,
            "message": "Text message test successful",
            "request_url": request_url,
            "request_data": data,
            "response": response,
            "phone_number": formatted_number,
            "message_content": message
        }

    except Exception as e:
        error_message = str(e)
        error_details = {}

        if frappe.flags.integration_request:
            try:
                error_response = frappe.flags.integration_request.json()
                error_details = error_response
                if 'error' in error_response:
                    error_message = error_response['error'].get('message', error_response['error'].get('Error', error_message))
            except:
                pass

        return {
            "success": False,
            "error": error_message,
            "error_details": error_details,
            "request_url": request_url if 'request_url' in locals() else None,
            "request_data": data if 'data' in locals() else None,
            "phone_number": formatted_number if 'formatted_number' in locals() else None,
            "message_content": message
        }


@frappe.whitelist()
def test_template_with_parameters(template_name, phone_number, parameters=None):
    """
    Test a specific template with parameters to debug the 400 error

    Args:
        template_name (str): Name of the template to test
        phone_number (str): Phone number to send to
        parameters (list): Template parameters

    Returns:
        dict: Test result with detailed debugging info
    """
    try:
        # Get template details
        template = frappe.get_doc("WhatsApp Message Templates", template_name)

        # Prepare the request data exactly as it will be sent
        data = {
            "messaging_product": "whatsapp",
            "to": format_phone_number(phone_number),
            "type": "template",
            "template": {
                "name": template.actual_name or template.template_name,
                "language": {"code": template.language_code},
                "components": []
            }
        }

        # Process parameters
        if parameters:
            if isinstance(parameters, str):
                try:
                    parameters = json.loads(parameters)
                except:
                    parameters = [parameters]

            # Validate and clean parameters
            cleaned_parameters = []
            for param in parameters:
                if param is not None:
                    cleaned_parameters.append(str(param).strip())
                else:
                    cleaned_parameters.append("")

            # Add body parameters
            if cleaned_parameters:
                parameters_data = []
                for param in cleaned_parameters:
                    parameters_data.append({
                        "type": "text",
                        "text": param
                    })

                data["template"]["components"].append({
                    "type": "body",
                    "parameters": parameters_data
                })

        # Get settings
        settings = frappe.get_doc("WhatsApp Setup", "WhatsApp Setup")
        token = settings.get_password("token")

        headers = {
            "authorization": f"Bearer {token}",
            "content-type": "application/json"
        }

        # Log the exact request that will be sent
        request_url = f"{settings.url}/{settings.version}/{settings.phone_id}/messages"
        request_data = json.dumps(data, indent=2)

        frappe.logger().debug(f"Test Template Request URL: {request_url}")
        frappe.logger().debug(f"Test Template Request Data: {request_data}")

        # Make the actual request
        response = frappe.integrations.utils.make_post_request(
            request_url,
            headers=headers,
            data=request_data
        )

        return {
            "success": True,
            "message": "Template test successful",
            "request_url": request_url,
            "request_data": data,
            "response": response,
            "template_info": {
                "name": template.name,
                "actual_name": template.actual_name,
                "template_name": template.template_name,
                "language_code": template.language_code,
                "status": template.status,
                "field_names": template.field_names,
                "sample_values": template.sample_values
            },
            "parameters_used": cleaned_parameters if parameters else []
        }

    except Exception as e:
        error_message = str(e)
        error_details = {}

        if frappe.flags.integration_request:
            try:
                error_response = frappe.flags.integration_request.json()
                error_details = error_response
                if 'error' in error_response:
                    error_message = error_response['error'].get('message', error_response['error'].get('Error', error_message))
            except:
                pass

        return {
            "success": False,
            "error": error_message,
            "error_details": error_details,
            "request_url": request_url if 'request_url' in locals() else None,
            "request_data": data if 'data' in locals() else None,
            "template_info": {
                "name": template.name if 'template' in locals() else None,
                "actual_name": template.actual_name if 'template' in locals() else None,
                "template_name": template.template_name if 'template' in locals() else None,
                "language_code": template.language_code if 'template' in locals() else None,
                "status": template.status if 'template' in locals() else None,
                "field_names": template.field_names if 'template' in locals() else None,
                "sample_values": template.sample_values if 'template' in locals() else None
            },
            "parameters_used": cleaned_parameters if 'cleaned_parameters' in locals() else []
        }


@frappe.whitelist()
def test_document_url():
    """Test if the document URL is accessible"""
    try:
        url = "https://clik-pos.k.frappe.cloud/files/REPC-SRET-000001_PDFA3%20(14).pdf"

        # Test URL accessibility
        import requests
        response = requests.head(url, timeout=10)

        return {
            "success": True,
            "url": url,
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "accessible": response.status_code == 200
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": url
        }

def get_invoice_pdf_url(invoice_name, print_format="Standard", lang="en"):
    """
    Return the URL to download the PDF of a Sales Invoice.
    """
    site_url = frappe.utils.get_url() 
    
    # gives https://clik-pos.k.frappe.cloud. WE ca use this since we are not live
    pdf_url = f"{site_url}/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name={invoice_name}&format={print_format}&no_letterhead=0&_lang={lang}"
    return pdf_url
