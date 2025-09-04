// Copyright (c) 2025, Beveren Sooftware Inc and contributors
// For license information, please see license.txt

// frappe.ui.form.on("WhatsApp Setup", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('WhatsApp Setup', {
    refresh: function(frm) {
        // Add test connection button
        frm.add_custom_button(__('Test Connection'), function() {
            test_whatsapp_connection(frm);
        }).addClass('btn-info');

        // Add validate settings button
        frm.add_custom_button(__('Validate Settings'), function() {
            validate_whatsapp_settings(frm);
        }).addClass('btn-warning');

        // Add send test message button
        frm.add_custom_button(__('Send Test Message'), function() {
            send_test_message(frm);
        }).addClass('btn-success');

        // Add validate template button
        frm.add_custom_button(__('Validate Template'), function() {
            validate_template_modal(frm);
        }).addClass('btn-secondary');

        // Add test template button
        frm.add_custom_button(__('Test Template'), function() {
            test_template_modal(frm);
        }).addClass('btn-primary');

        // Add test text message button
        frm.add_custom_button(__('Test Text Message'), function() {
            test_text_message_modal(frm);
        }).addClass('btn-info');

        // Add test invoice with PDF button
        frm.add_custom_button(__('Test Invoice PDF'), function() {
            test_invoice_pdf_modal(frm);
        }).addClass('btn-warning');
    }
});

function test_whatsapp_connection(frm) {
    frappe.show_alert(__('Testing WhatsApp connection...'), 3);

            frappe.call({
        method: 'klik_pos.api.whatsap.utils.test_whatsapp_connection',
                callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert(__('WhatsApp connection successful!'), 5, 'green');

                // Show connection details
                        frappe.msgprint({
                    title: __('Connection Test Successful'),
                    message: __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> Connected</p>
                            <p><strong>Phone Number:</strong> ${r.message.phone_info?.phone_number || 'N/A'}</p>
                            <p><strong>Verified Name:</strong> ${r.message.phone_info?.verified_name || 'N/A'}</p>
                            <p><strong>Code Verification Status:</strong> ${r.message.phone_info?.code_verification_status || 'N/A'}</p>
                        </div>
                    `),
                    indicator: 'green'
                });
            } else {
                frappe.show_alert(__('Connection test failed: ') + (r.message?.error || 'Unknown error'), 5, 'red');
                    }
                }
            });
}

function validate_whatsapp_settings(frm) {
    frappe.call({
        method: 'klik_pos.api.whatsap.utils.get_whatsapp_setup_status',
        callback: function(r) {
            if (r.message) {
                const status = r.message;
                let message = '';
                let indicator = 'green';

                if (status.configured) {
                    message = __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> ✅ Configured</p>
                            <p><strong>Enabled:</strong> ${status.enabled ? '✅ Yes' : '❌ No'}</p>
                            <p><strong>URL:</strong> ${status.url}</p>
                            <p><strong>Version:</strong> ${status.version}</p>
                            <p><strong>Phone ID:</strong> ${status.phone_id}</p>
                            <p><strong>API URL:</strong> ${status.api_url}</p>
                        </div>
                    `);
                } else {
                    indicator = 'red';
                    message = __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> ❌ Not Configured</p>
                            <p><strong>Issues:</strong></p>
                            <ul>
                                ${status.validation_errors?.map(error => `<li>❌ ${error}</li>`).join('') || '<li>Unknown configuration error</li>'}
                            </ul>
                        </div>
                    `);
                }

                frappe.msgprint({
                    title: __('WhatsApp Settings Validation'),
                    message: message,
                    indicator: indicator
                });
            }
        }
    });
}

function send_test_message(frm) {
    // Create modal for test message
    let d = new frappe.ui.Dialog({
        title: __('Send Test WhatsApp Message'),
        fields: [
            {
                fieldtype: 'Data',
                fieldname: 'mobile_number',
                label: __('Mobile Number'),
                description: __('Enter mobile number with country code (e.g., +1234567890)'),
                reqd: 1
            },
            {
                fieldtype: 'Data',
                fieldname: 'test_message',
                label: __('Test Message'),
                description: __('Enter a test message to send'),
                reqd: 1,
                default: 'Hello! This is a test message from KLIK POS WhatsApp integration.'
            }
        ],
        primary_action_label: __('Send Test'),
        primary_action: function(values) {
            send_test_whatsapp_message(values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function send_test_whatsapp_message(values) {
    frappe.show_alert(__('Sending test message...'), 3);

    frappe.call({
        method: 'klik_pos.api.whatsap.utils.send_whatsapp_message',
        args: {
            to_number: values.mobile_number,
            message_type: 'text',
            message_content: values.test_message
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert(__('Test message sent successfully!'), 5, 'green');

                frappe.msgprint({
                    title: __('Test Message Sent'),
                    message: __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> ✅ Sent</p>
                            <p><strong>To:</strong> ${values.mobile_number}</p>
                            <p><strong>Message:</strong> ${values.test_message}</p>
                            <p><strong>Message ID:</strong> ${r.message.message_id}</p>
                        </div>
                    `),
                    indicator: 'green'
                });
            } else {
                frappe.show_alert(__('Failed to send test message: ') + (r.message?.error || 'Unknown error'), 5, 'red');

                // Show detailed error
                if (r.message?.error_details) {
                    frappe.msgprint({
                        title: __('Test Message Failed'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${r.message.error}</p>
                                <p><strong>Details:</strong></p>
                                <pre>${JSON.stringify(r.message.error_details, null, 2)}</pre>
                            </div>
                        `),
                        indicator: 'red'
                    });
                }
            }
        }
    });
}

function validate_template_modal(frm) {
    // Create modal for template validation
    let d = new frappe.ui.Dialog({
        title: __('Validate WhatsApp Template'),
        fields: [
            {
                fieldtype: 'Link',
                fieldname: 'template_name',
                label: __('Template'),
                options: 'WhatsApp Message Templates',
                reqd: 1
            },
            {
                fieldtype: 'Small Text',
                fieldname: 'parameters',
                label: __('Parameters (comma-separated)'),
                description: __('Enter parameters separated by commas (e.g., "John Doe, INV-001, $100.00")'),
                reqd: 1
            }
        ],
        primary_action_label: __('Validate'),
        primary_action: function(values) {
            validate_template_parameters(values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function validate_template_parameters(values) {
    frappe.call({
        method: 'klik_pos.api.whatsap.utils.validate_template_parameters',
        args: {
            template_name: values.template_name,
            parameters: values.parameters.split(',').map(p => p.trim())
        },
        callback: function(r) {
            if (r.message) {
                const result = r.message;

                if (result.valid) {
                    frappe.show_alert(__('Template parameters are valid!'), 5, 'green');

                    frappe.msgprint({
                        title: __('Template Validation Successful'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Template:</strong> ${result.template_name}</p>
                                <p><strong>Expected Fields:</strong> ${result.expected_fields.join(', ')}</p>
                                <p><strong>Provided Parameters:</strong> ${result.provided_parameters.join(', ')}</p>
                                <p><strong>Parameter Count:</strong> ${result.parameter_count}/${result.expected_count}</p>
                            </div>
                        `),
                        indicator: 'green'
                    });
                } else {
                    frappe.show_alert(__('Template validation failed!'), 5, 'red');

                    frappe.msgprint({
                        title: __('Template Validation Failed'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Template:</strong> ${result.template_name}</p>
                                <p><strong>Expected Fields:</strong> ${result.expected_fields.join(', ')}</p>
                                <p><strong>Provided Parameters:</strong> ${result.provided_parameters.join(', ')}</p>
                                <p><strong>Issues:</strong></p>
                                <ul>
                                    ${result.issues.map(issue => `<li>❌ ${issue}</li>`).join('')}
                                </ul>
                            </div>
                        `),
                        indicator: 'red'
                    });
                }
            }
        }
    });
}

function test_template_modal(frm) {
    // Create modal for template testing
    let d = new frappe.ui.Dialog({
        title: __('Test WhatsApp Template'),
        fields: [
            {
                fieldtype: 'Link',
                fieldname: 'template_name',
                label: __('Template'),
                options: 'WhatsApp Message Templates',
                reqd: 1
            },
            {
                fieldtype: 'Data',
                fieldname: 'phone_number',
                label: __('Phone Number'),
                description: __('Enter phone number with country code (e.g., +254740743521)'),
                reqd: 1
            },
            {
                fieldtype: 'Small Text',
                fieldname: 'parameters',
                label: __('Parameters (comma-separated)'),
                description: __('Enter parameters separated by commas (e.g., "John Doe, INV-001, $100.00")'),
                reqd: 0
            }
        ],
        primary_action_label: __('Test Template'),
        primary_action: function(values) {
            test_template_with_parameters(values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function test_template_with_parameters(values) {
    frappe.show_alert(__('Testing template...'), 3);

    let parameters = null;
    if (values.parameters) {
        parameters = values.parameters.split(',').map(p => p.trim());
    }

    frappe.call({
        method: 'klik_pos.api.whatsap.utils.test_template_with_parameters',
        args: {
            template_name: values.template_name,
            phone_number: values.phone_number,
            parameters: parameters
        },
        callback: function(r) {
            if (r.message) {
                const result = r.message;

                if (result.success) {
                    frappe.show_alert(__('Template test successful!'), 5, 'green');

                    frappe.msgprint({
                        title: __('Template Test Successful'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Template:</strong> ${result.template_info.actual_name}</p>
                                <p><strong>Status:</strong> ${result.template_info.status}</p>
                                <p><strong>Language:</strong> ${result.template_info.language_code}</p>
                                <p><strong>Parameters Used:</strong> ${result.parameters_used.join(', ') || 'None'}</p>
                                <p><strong>Message ID:</strong> ${result.response?.messages?.[0]?.id || 'N/A'}</p>
                            </div>
                        `),
                        indicator: 'green'
                    });
                } else {
                    frappe.show_alert(__('Template test failed!'), 5, 'red');

                    frappe.msgprint({
                        title: __('Template Test Failed'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${result.error}</p>
                                <p><strong>Template:</strong> ${result.template_info?.actual_name || 'Unknown'}</p>
                                <p><strong>Parameters Used:</strong> ${result.parameters_used.join(', ') || 'None'}</p>
                                <p><strong>Request URL:</strong> ${result.request_url || 'N/A'}</p>
                                <p><strong>Error Details:</strong></p>
                                <pre>${JSON.stringify(result.error_details, null, 2)}</pre>
                            </div>
                        `),
                        indicator: 'red'
                    });
                }
            }
        }
    });
}

function test_text_message_modal(frm) {
    // Create modal for text message testing
    let d = new frappe.ui.Dialog({
        title: __('Test Simple Text Message'),
        fields: [
            {
                fieldtype: 'Data',
                fieldname: 'phone_number',
                label: __('Phone Number'),
                description: __('Enter phone number with country code (e.g., +254740743521)'),
                reqd: 1
            },
            {
                fieldtype: 'Small Text',
                fieldname: 'message',
                label: __('Message'),
                description: __('Enter a test message'),
                reqd: 1,
                default: 'Hello from KLIK POS!'
            }
        ],
        primary_action_label: __('Test Text Message'),
        primary_action: function(values) {
            test_text_message_with_details(values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function test_text_message_with_details(values) {
    frappe.show_alert(__('Testing text message...'), 3);

    frappe.call({
        method: 'klik_pos.api.whatsap.utils.test_simple_text_message',
        args: {
            phone_number: values.phone_number,
            message: values.message
        },
        callback: function(r) {
            if (r.message) {
                const result = r.message;

                if (result.success) {
                    frappe.show_alert(__('Text message test successful!'), 5, 'green');

                    frappe.msgprint({
                        title: __('Text Message Test Successful'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Phone Number:</strong> ${result.phone_number}</p>
                                <p><strong>Message:</strong> ${result.message_content}</p>
                                <p><strong>Message ID:</strong> ${result.response?.messages?.[0]?.id || 'N/A'}</p>
                                <p><strong>Request URL:</strong> ${result.request_url}</p>
                            </div>
                        `),
                        indicator: 'green'
                    });
                } else {
                    frappe.show_alert(__('Text message test failed!'), 5, 'red');

                    frappe.msgprint({
                        title: __('Text Message Test Failed'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${result.error}</p>
                                <p><strong>Phone Number:</strong> ${result.phone_number || 'N/A'}</p>
                                <p><strong>Message:</strong> ${result.message_content || 'N/A'}</p>
                                <p><strong>Request URL:</strong> ${result.request_url || 'N/A'}</p>
                                <p><strong>Error Details:</strong></p>
                                <pre>${JSON.stringify(result.error_details, null, 2)}</pre>
                            </div>
                        `),
                        indicator: 'red'
                    });
                }
            }
        }
    });
}

function test_invoice_pdf_modal(frm) {
    // Create modal for invoice PDF testing
    let d = new frappe.ui.Dialog({
        title: __('Test Invoice with PDF'),
        fields: [
            {
                fieldtype: 'Data',
                fieldname: 'phone_number',
                label: __('Phone Number'),
                description: __('Enter phone number with country code (e.g., +254740743521)'),
                reqd: 1
            },
            {
                fieldtype: 'Link',
                fieldname: 'invoice_no',
                label: __('Invoice Number'),
                options: 'Sales Invoice',
                description: __('Select an invoice to send'),
                reqd: 1
            },
            {
                fieldtype: 'Small Text',
                fieldname: 'message',
                label: __('Message'),
                description: __('Message to send with the PDF'),
                reqd: 1,
                default: 'Your invoice is ready! Please find the PDF attached.'
            }
        ],
        primary_action_label: __('Test Invoice PDF'),
        primary_action: function(values) {
            test_invoice_pdf_with_details(values);
            d.hide();
        },
        secondary_action_label: __('Cancel'),
        secondary_action: function() {
            d.hide();
        }
    });

    d.show();
}

function test_invoice_pdf_with_details(values) {
    frappe.show_alert(__('Testing invoice PDF...'), 3);

    frappe.call({
        method: 'klik_pos.api.whatsap.utils.test_invoice_with_pdf',
        args: {
            phone_number: values.phone_number,
            invoice_no: values.invoice_no,
            message: values.message
        },
        callback: function(r) {
            if (r.message) {
                const result = r.message;

                if (result.success) {
                    frappe.show_alert(__('Invoice PDF test successful!'), 5, 'green');

                    frappe.msgprint({
                        title: __('Invoice PDF Test Successful'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Phone Number:</strong> ${result.phone_number}</p>
                                <p><strong>Invoice:</strong> ${result.invoice_no}</p>
                                <p><strong>Message:</strong> ${result.message_content}</p>
                                <p><strong>PDF URL:</strong> ${result.document_url}</p>
                                <p><strong>Message ID:</strong> ${result.response?.messages?.[0]?.id || 'N/A'}</p>
                            </div>
                        `),
                        indicator: 'green'
                    });
                } else {
                    frappe.show_alert(__('Invoice PDF test failed!'), 5, 'red');

                    frappe.msgprint({
                        title: __('Invoice PDF Test Failed'),
                        message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${result.error}</p>
                                <p><strong>Phone Number:</strong> ${result.phone_number || 'N/A'}</p>
                                <p><strong>Invoice:</strong> ${result.invoice_no || 'N/A'}</p>
                                <p><strong>PDF URL:</strong> ${result.document_url || 'N/A'}</p>
                                <p><strong>Request URL:</strong> ${result.request_url || 'N/A'}</p>
                                <p><strong>Error Details:</strong></p>
                                <pre>${JSON.stringify(result.error_details, null, 2)}</pre>
                            </div>
                        `),
                        indicator: 'red'
                    });
                }
            }
        }
    });
}
