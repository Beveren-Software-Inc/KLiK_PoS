// Copyright (c) 2025, Beveren Sooftware Inc and contributors
// For license information, please see license.txt

frappe.ui.form.on('WhatsApp Message Notification', {
    refresh: function(frm) {
        // Add custom button for triggering WhatsApp message
        if (frm.doc.reference_doctype === 'Sales Invoice') {
            frm.add_custom_button(__('Send WhatsApp Message'), function() {
                open_invoice_selection_modal(frm);
            }).addClass('btn-primary');
        }
    }
});

function open_invoice_selection_modal(frm) {
    // Create modal for invoice selection
    let d = new frappe.ui.Dialog({
        title: __('Select Invoice to Send WhatsApp'),
        fields: [
            {
                fieldtype: 'Link',
                fieldname: 'invoice',
                label: __('Sales Invoice'),
                options: 'Sales Invoice',
                reqd: 1,
                get_query: function() {
                    return {
                        filters: {
                            'docstatus': 1, // Only submitted invoices
                            'status': ['in', ['Paid', 'Unpaid', 'Overdue']]
                        }
                    };
                }
            },
            {
                fieldtype: 'Data',
                fieldname: 'mobile_number',
                label: __('Mobile Number'),
                description: __('Enter mobile number with country code (e.g., +1234567890)'),
                reqd: 1
            },
            {
                fieldtype: 'Data',
                fieldname: 'customer_name',
                label: __('Customer Name'),
                reqd: 1
            }
        ],
        primary_action_label: __('Send WhatsApp'),
        primary_action: function(values) {
            send_whatsapp_for_invoice(frm, values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function send_whatsapp_for_invoice(frm, values) {
    // Show loading state
    frappe.show_alert(__('Sending WhatsApp message...'), 3);

    // Get invoice details
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Sales Invoice',
            name: values.invoice
        },
        callback: function(r) {
            if (r.message) {
                const invoice = r.message;

                // Prepare template parameters
                const template_parameters = [
                    values.customer_name,
                    invoice.name,
                    frappe.format(invoice.rounded_total || invoice.grand_total, {
                        fieldtype: 'Currency',
                        currency: invoice.currency
                    })
                ];

                // Send WhatsApp message
                frappe.call({
                    method: 'klik_pos.api.whatsap.utils.send_whatsapp_message',
                    args: {
                        to_number: values.mobile_number,
                        message_type: 'template',
                        template_name: frm.doc.template,
                        template_parameters: template_parameters,
                        reference_doctype: 'Sales Invoice',
                        reference_name: invoice.name,
                        attach_document: frm.doc.attach_document_print
                    },
                    callback: function(response) {
                        if (response.message && response.message.success) {
                            frappe.show_alert(__('WhatsApp message sent successfully!'), 5, 'green');

                            // Show success details
                            frappe.msgprint({
                                title: __('Message Sent Successfully'),
                                message: __(`
                                    <div style="padding: 10px;">
                                        <p><strong>Invoice:</strong> ${invoice.name}</p>
                                        <p><strong>Customer:</strong> ${values.customer_name}</p>
                                        <p><strong>Mobile:</strong> ${values.mobile_number}</p>
                                        <p><strong>Amount:</strong> ${frappe.format(invoice.rounded_total || invoice.grand_total, {
                                            fieldtype: 'Currency',
                                            currency: invoice.currency
                                        })}</p>
                                        <p><strong>Message ID:</strong> ${response.message.message_id}</p>
                                    </div>
                                `),
                                indicator: 'green'
                            });
                        } else {
                            frappe.show_alert(__('Failed to send WhatsApp message: ') + (response.message?.error || 'Unknown error'), 5, 'red');
                        }
                    }
                });
            } else {
                frappe.show_alert(__('Invoice not found!'), 5, 'red');
            }
        }
    });
}

// Add a quick action button in the form
frappe.ui.form.on('WhatsApp Message Notification', {
    after_save: function(frm) {
        if (frm.doc.reference_doctype === 'Sales Invoice' && !frm.doc.disabled) {
            frm.add_custom_button(__('Quick Send'), function() {
                quick_send_modal(frm);
            }).addClass('btn-success');
        }
    }
});

function quick_send_modal(frm) {
    // Quick send modal with recent invoices
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Sales Invoice',
            filters: {
                'docstatus': 1,
                'status': ['in', ['Paid', 'Unpaid', 'Overdue']]
            },
            fields: ['name', 'customer', 'customer_name', 'rounded_total', 'grand_total', 'currency'],
            limit: 10,
            order_by: 'modified desc'
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                show_quick_send_dialog(frm, r.message);
            } else {
                frappe.show_alert(__('No recent invoices found!'), 5, 'orange');
            }
        }
    });
}

function show_quick_send_dialog(frm, invoices) {
    let invoice_options = invoices.map(inv =>
        `${inv.name} - ${inv.customer_name} (${frappe.format(inv.rounded_total || inv.grand_total, {
            fieldtype: 'Currency',
            currency: inv.currency
        })})`
    );

    let d = new frappe.ui.Dialog({
        title: __('Quick Send WhatsApp'),
        fields: [
            {
                fieldtype: 'Select',
                fieldname: 'invoice',
                label: __('Select Invoice'),
                options: invoice_options.join('\n'),
                reqd: 1
            },
            {
                fieldtype: 'Data',
                fieldname: 'mobile_number',
                label: __('Mobile Number'),
                description: __('Enter mobile number with country code'),
                reqd: 1
            }
        ],
        primary_action_label: __('Send'),
        primary_action: function(values) {
            const selected_invoice = invoices[values.invoice];
            send_quick_whatsapp(frm, selected_invoice, values.mobile_number);
            d.hide();
        }
    });

    d.show();
}

function send_quick_whatsapp(frm, invoice, mobile_number) {
    frappe.show_alert(__('Sending WhatsApp message...'), 3);

    const template_parameters = [
        invoice.customer_name,
        invoice.name,
        frappe.format(invoice.rounded_total || invoice.grand_total, {
            fieldtype: 'Currency',
            currency: invoice.currency
        })
    ];

    frappe.call({
        method: 'klik_pos.api.whatsap.utils.send_whatsapp_message',
        args: {
            to_number: mobile_number,
            message_type: 'template',
            template_name: frm.doc.template,
            template_parameters: template_parameters,
            reference_doctype: 'Sales Invoice',
            reference_name: invoice.name,
            attach_document: frm.doc.attach_document_print
        },
        callback: function(response) {
            if (response.message && response.message.success) {
                frappe.show_alert(__('WhatsApp message sent successfully!'), 5, 'green');
            } else {
                frappe.show_alert(__('Failed to send WhatsApp message: ') + (response.message?.error || 'Unknown error'), 5, 'red');
            }
        }
    });
}

// Add custom button to list view
frappe.listview_settings['WhatsApp Message Notification'] = {
    add_fields: ["reference_doctype", "template", "disabled"],
    get_indicator: function(doc) {
        if (doc.disabled) {
            return [__("Disabled"), "gray", "disabled,=,1"];
        } else {
            return [__("Active"), "green", "disabled,=,0"];
        }
    },
    onload: function(listview) {
        // Add custom button to list view
        listview.page.add_inner_button(__('Send WhatsApp'), function() {
            // Get selected items
            let selected = listview.get_checked_items();
            if (selected.length === 0) {
                frappe.msgprint(__('Please select a notification to send WhatsApp message.'));
                return;
            }

            if (selected.length > 1) {
                frappe.msgprint(__('Please select only one notification at a time.'));
                return;
            }

            let doc = selected[0];
            if (doc.reference_doctype === 'Sales Invoice') {
                // Open the form and trigger the send button
                frappe.set_route('Form', 'WhatsApp Message Notification', doc.name);
                setTimeout(function() {
                    let frm = frappe.get_form('WhatsApp Message Notification', doc.name);
                    if (frm) {
                        open_invoice_selection_modal(frm);
                    }
                }, 1000);
            } else {
                frappe.msgprint(__('This notification is not configured for Sales Invoice.'));
            }
        });
    }
};
