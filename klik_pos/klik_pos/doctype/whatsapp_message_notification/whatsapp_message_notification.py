# Copyright (c) 2025, Beveren Sooftware Inc and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _dict, _
from frappe.model.document import Document
from frappe.utils.safe_exec import get_safe_globals, safe_exec
from frappe.integrations.utils import make_post_request
from frappe.desk.form.utils import get_pdf_link
from frappe.utils import add_to_date, nowdate, datetime
from klik_pos.api.whatsap.utils import send_whatsapp_message


class WhatsAppMessageNotification(Document):
    """WhatsApp Message Notification for KLiK PoS"""

    def validate(self):
        """Validate the notification configuration"""
        if self.notification_type == "DocType Event":
            fields = frappe.get_doc("DocType", self.reference_doctype).fields
            fields += frappe.get_all(
                "Custom Field",
                filters={"dt": self.reference_doctype},
                fields=["fieldname"]
            )
            if not any(field.fieldname == self.field_name for field in fields):
                frappe.throw(_("Field name {0} does not exist").format(self.field_name))

        if self.custom_attachment:
            if not self.attach and not self.attach_from_field:
                frappe.throw(_("Either {0} a file or add a {1} to send attachment").format(
                    frappe.bold(_("Attach")),
                    frappe.bold(_("Attach from field")),
                ))

        if self.set_property_after_alert:
            meta = frappe.get_meta(self.reference_doctype)
            if not meta.get_field(self.set_property_after_alert):
                frappe.throw(_("Field {0} not found on DocType {1}").format(
                    self.set_property_after_alert,
                    self.reference_doctype,
                ))

    def send_scheduled_message(self) -> dict:
        """Send scheduled messages"""
        safe_exec(
            self.condition, get_safe_globals(), dict(doc=self)
        )

        template = frappe.db.get_value(
            "WhatsApp Message Templates", self.template,
            fieldname='*'
        )

        if template and template.language_code:
            if self.get("_contact_list"):
                # send simple template without a doc to get field data
                self.send_simple_template(template)
            elif self.get("_data_list"):
                # allow send a dynamic template using schedule event config
                # _doc_list should be [{"name": "xxx", "phone_no": "123"}]
                for data in self._data_list:
                    doc = frappe.get_doc(self.reference_doctype, data.get("name"))
                    self.send_template_message(doc, data.get("phone_no"), template, True)

    def send_simple_template(self, template):
        """Send simple template without a doc to get field data"""
        for contact in self._contact_list:
            result = send_whatsapp_message(
                to_number=contact,
                message_type="template",
                template_name=template.name,
                template_parameters=[]
            )

            if result.get("success"):
                frappe.msgprint(f"WhatsApp message sent to {contact}", indicator="green")
            else:
                frappe.msgprint(f"Failed to send WhatsApp message to {contact}: {result.get('error')}", indicator="red")

    def send_template_message(self, doc: Document, phone_no=None, default_template=None, ignore_condition=False):
        """Send template message for document events"""
        if self.disabled:
            return

        doc_data = doc.as_dict()
        if self.condition and not ignore_condition:
            # check if condition satisfies
            if not frappe.safe_eval(
                self.condition, get_safe_globals(), dict(doc=doc_data)
            ):
                return

        template = default_template or frappe.db.get_value(
            "WhatsApp Message Templates", self.template,
            fieldname='*'
        )

        if template:
            if self.field_name:
                phone_number = phone_no or doc_data[self.field_name]
            else:
                phone_number = phone_no

            # Prepare template parameters
            template_parameters = []
            if self.fields:
                for field in self.fields:
                    if isinstance(doc, Document):
                        # get field with prettier value
                        value = doc.get_formatted(field.field_name)
                    else:
                        value = doc_data[field.field_name]
                        if isinstance(doc_data[field.field_name], (datetime.date, datetime.datetime)):
                            value = str(doc_data[field.field_name])

                    template_parameters.append(value)

            # Handle attachments
            attach_document = self.attach_document_print
            custom_attachment = None
            file_name = None

            if self.custom_attachment:
                if self.attach_from_field:
                    custom_attachment = doc_data[self.attach_from_field]
                    if not custom_attachment.startswith("http"):
                        # get share key so that private files can be sent
                        key = doc.get_document_share_key()
                        custom_attachment = f'{frappe.utils.get_url()}{custom_attachment}&key={key}'
                else:
                    custom_attachment = self.attach
                    if not custom_attachment.startswith("http"):
                        custom_attachment = f'{frappe.utils.get_url()}{custom_attachment}'

                file_name = self.file_name

            # Send the message
            result = send_whatsapp_message(
                to_number=phone_number,
                message_type="template",
                template_name=template.name,
                template_parameters=template_parameters,
                reference_doctype=doc_data.get("doctype"),
                reference_name=doc_data.get("name"),
                attach_document=attach_document,
                custom_attachment=custom_attachment,
                file_name=file_name
            )

            if result.get("success"):
                # Set property after alert if configured
                if doc_data and self.set_property_after_alert and self.property_value:
                    if doc_data.doctype and doc_data.name:
                        fieldname = self.set_property_after_alert
                        value = self.property_value
                        meta = frappe.get_meta(doc_data.get("doctype"))
                        df = meta.get_field(fieldname)
                        if df:
                            if df.fieldtype in frappe.model.numeric_fieldtypes:
                                value = frappe.utils.cint(value)
                            frappe.db.set_value(doc_data.get("doctype"), doc_data.get("name"), fieldname, value)

                frappe.msgprint("WhatsApp Message Triggered", indicator="green", alert=True)
            else:
                frappe.msgprint(
                    f"Failed to trigger WhatsApp message: {result.get('error')}",
                    indicator="red",
                    alert=True
                )

    def on_trash(self):
        """On delete remove from schedule"""
        frappe.cache().delete_value("whatsapp_notification_map")

    def format_number(self, number):
        """Format phone number"""
        if number.startswith("+"):
            number = number[1:len(number)]
        return number

    def get_documents_for_today(self):
        """Get list of documents that will be triggered today"""
        docs = []

        diff_days = self.days_in_advance
        if self.doctype_event == "Days After":
            diff_days = -diff_days

        reference_date = add_to_date(nowdate(), days=diff_days)
        reference_date_start = reference_date + " 00:00:00.000000"
        reference_date_end = reference_date + " 23:59:59.000000"

        doc_list = frappe.get_all(
            self.reference_doctype,
            fields="name",
            filters=[
                {self.date_changed: (">=", reference_date_start)},
                {self.date_changed: ("<=", reference_date_end)},
            ],
        )

        for d in doc_list:
            doc = frappe.get_doc(self.reference_doctype, d.name)
            self.send_template_message(doc)


@frappe.whitelist()
def call_trigger_notifications():
    """Trigger notifications"""
    try:
        trigger_notifications()
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Error in call_trigger_notifications")
        raise e

def trigger_notifications(method="daily"):
    """Trigger notifications based on method"""
    if frappe.flags.in_import or frappe.flags.in_patch:
        # don't send notifications while syncing or patching
        return

    if method == "daily":
        doc_list = frappe.get_all(
            "WhatsApp Message Notification",
            filters={"doctype_event": ("in", ("Days Before", "Days After")), "disabled": 0}
        )
        for d in doc_list:
            alert = frappe.get_doc("WhatsApp Message Notification", d.name)
            alert.get_documents_for_today()


@frappe.whitelist()
def send_whatsapp_for_specific_invoice(notification_name, invoice_name, mobile_number, customer_name):
    """
    Send WhatsApp message for a specific invoice

    Args:
        notification_name (str): Name of the WhatsApp Message Notification
        invoice_name (str): Sales Invoice name
        mobile_number (str): Mobile number with country code
        customer_name (str): Customer name

    Returns:
        dict: Response with success status
    """
    try:
        # Get the notification configuration
        notification = frappe.get_doc("WhatsApp Message Notification", notification_name)

        if notification.disabled:
            return {"success": False, "error": "Notification is disabled"}

        # Get the invoice
        invoice = frappe.get_doc("Sales Invoice", invoice_name)

        # Prepare template parameters
        template_parameters = [
            customer_name,
            invoice.name,
            frappe.utils.fmt_money(invoice.rounded_total or invoice.grand_total, currency=invoice.currency)
        ]

        # Send WhatsApp message
        result = send_whatsapp_message(
            to_number=mobile_number,
            message_type="template",
            template_name=notification.template,
            template_parameters=template_parameters,
            reference_doctype="Sales Invoice",
            reference_name=invoice.name,
            attach_document=notification.attach_document_print
        )

        return result

    except Exception as e:
        frappe.log_error(f"Error sending WhatsApp for invoice: {str(e)}", "WhatsApp Invoice Send")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_recent_invoices(limit=10):
    """
    Get recent submitted invoices for quick selection

    Args:
        limit (int): Number of invoices to return

    Returns:
        list: List of recent invoices
    """
    try:
        invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "docstatus": 1,
                "status": ["in", ["Paid", "Unpaid", "Overdue"]]
            },
            fields=["name", "customer", "customer_name", "rounded_total", "grand_total", "currency", "modified"],
            limit=limit,
            order_by="modified desc"
        )

        return invoices

    except Exception as e:
        frappe.log_error(f"Error getting recent invoices: {str(e)}", "WhatsApp Invoice List")
        return []


@frappe.whitelist()
def get_invoice_details(invoice_name):
    """
    Get detailed invoice information

    Args:
        invoice_name (str): Sales Invoice name

    Returns:
        dict: Invoice details
    """
    try:
        invoice = frappe.get_doc("Sales Invoice", invoice_name)

        return {
            "name": invoice.name,
            "customer": invoice.customer,
            "customer_name": invoice.customer_name,
            "rounded_total": invoice.rounded_total,
            "grand_total": invoice.grand_total,
            "currency": invoice.currency,
            "status": invoice.status,
            "posting_date": invoice.posting_date,
            "due_date": invoice.due_date
        }

    except Exception as e:
        frappe.log_error(f"Error getting invoice details: {str(e)}", "WhatsApp Invoice Details")
        return None
