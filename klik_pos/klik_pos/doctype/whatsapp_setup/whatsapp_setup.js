// Copyright (c) 2025, Beveren Sooftware Inc and contributors
// For license information, please see license.txt

frappe.ui.form.on("WhatsApp Setup", {
	refresh: function (frm) {
		//We will do away with most of those buttons since they were just for initial stage setting: Mania
		frm.add_custom_button(
			__("Test Connection"),
			function () {
				test_whatsapp_connection(frm);
			},
			__("WhatsApp Actions")
		).addClass("btn-info");

		frm.add_custom_button(
			__("Get Templates"),
			function () {
				fetch_whatsapp_approved_template(frm);
			},
			__("WhatsApp Actions")
		).addClass("btn-info");

		frm.add_custom_button(
			__("Send Test Message"),
			function () {
				send_test_message(frm);
			},
			__("WhatsApp Actions")
		).addClass("btn-success");

		frm.add_custom_button(
			__("Send Test Template"),
			function () {
				test_template_modal(frm);
			},
			__("WhatsApp Actions")
		).addClass("btn-primary");
	},
});

function test_whatsapp_connection(frm) {
	frappe.show_alert(__("Testing WhatsApp connection..."), 3);

	frappe.call({
		method: "klik_pos.api.whatsap.utils.test_whatsapp_connection",
		callback: function (r) {
			if (r.message && r.message.success) {
				frappe.show_alert(__("WhatsApp connection successful!"), 5, "green");

				// Show connection details
				frappe.msgprint({
					title: __("Connection Test Successful"),
					message: __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> Connected</p>
                            <p><strong>Phone Number:</strong> ${
								r.message.phone_info?.phone_number || "N/A"
							}</p>
                            <p><strong>Verified Name:</strong> ${
								r.message.phone_info?.verified_name || "N/A"
							}</p>
                            <p><strong>Code Verification Status:</strong> ${
								r.message.phone_info?.code_verification_status || "N/A"
							}</p>
                        </div>
                    `),
					indicator: "green",
				});
			} else {
				frappe.show_alert(
					__("Connection test failed: ") + (r.message?.error || "Unknown error"),
					5,
					"red"
				);
			}
		},
	});
}

function send_test_message(frm) {
	// Create modal for test message
	let d = new frappe.ui.Dialog({
		title: __("Send Test WhatsApp Message"),
		fields: [
			{
				fieldtype: "Data",
				fieldname: "mobile_number",
				label: __("Mobile Number"),
				description: __("Enter mobile number with country code (e.g., +1234567890)"),
				reqd: 1,
			},
			{
				fieldtype: "Data",
				fieldname: "test_message",
				label: __("Test Message"),
				description: __("Enter a test message to send"),
				reqd: 1,
				default: "Hello! This is a test message from KLiK PoS WhatsApp integration.",
			},
		],
		primary_action_label: __("Send Test"),
		primary_action: function (values) {
			send_test_whatsapp_message(values);
			d.hide();
		},
		secondary_action_label: __("Cancel"),
		secondary_action: function () {
			d.hide();
		},
	});

	d.show();
}

function send_test_whatsapp_message(values) {
	frappe.show_alert(__("Sending test message..."), 3);

	frappe.call({
		method: "klik_pos.api.whatsap.utils.send_whatsapp_message",
		args: {
			to_number: values.mobile_number,
			message_type: "text",
			message_content: values.test_message,
		},
		callback: function (r) {
			if (r.message && r.message.success) {
				frappe.show_alert(__("Test message sent successfully!"), 5, "green");

				frappe.msgprint({
					title: __("Test Message Sent"),
					message: __(`
                        <div style="padding: 10px;">
                            <p><strong>Status:</strong> ✅ Sent</p>
                            <p><strong>To:</strong> ${values.mobile_number}</p>
                            <p><strong>Message:</strong> ${values.test_message}</p>
                            <p><strong>Message ID:</strong> ${r.message.message_id}</p>
                        </div>
                    `),
					indicator: "green",
				});
			} else {
				frappe.show_alert(
					__("Failed to send test message: ") + (r.message?.error || "Unknown error"),
					5,
					"red"
				);

				// Show detailed error
				if (r.message?.error_details) {
					frappe.msgprint({
						title: __("Test Message Failed"),
						message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${r.message.error}</p>
                                <p><strong>Details:</strong></p>
                                <pre>${JSON.stringify(r.message.error_details, null, 2)}</pre>
                            </div>
                        `),
						indicator: "red",
					});
				}
			}
		},
	});
}

function test_template_modal(frm) {
	// Create modal for template testing
	let d = new frappe.ui.Dialog({
		title: __("Test WhatsApp Template"),
		fields: [
			{
				fieldtype: "Link",
				fieldname: "template_name",
				label: __("Template"),
				options: "WhatsApp Message Templates",
				reqd: 1,
			},
			{
				fieldtype: "Data",
				fieldname: "phone_number",
				label: __("Phone Number"),
				description: __("Enter phone number with country code (e.g., +254740743521)"),
				reqd: 1,
			},
			{
				fieldtype: "Small Text",
				fieldname: "parameters",
				label: __("Parameters (comma-separated)"),
				description: __(
					'Enter parameters separated by commas (e.g., "John Doe, INV-001, $100.00")'
				),
				reqd: 0,
			},
		],
		primary_action_label: __("Test Template"),
		primary_action: function (values) {
			test_template_with_parameters(values);
			d.hide();
		},
		secondary_action_label: __("Cancel"),
		secondary_action: function () {
			d.hide();
		},
	});

	d.show();
}

function test_template_with_parameters(values) {
	frappe.show_alert(__("Testing template..."), 3);

	let parameters = null;
	if (values.parameters) {
		parameters = values.parameters.split(",").map((p) => p.trim());
	}

	frappe.call({
		method: "klik_pos.api.whatsap.utils.test_template_with_parameters",
		args: {
			template_name: values.template_name,
			phone_number: values.phone_number,
			parameters: parameters,
		},
		callback: function (r) {
			if (r.message) {
				const result = r.message;

				if (result.success) {
					frappe.show_alert(__("Template test successful!"), 5, "green");

					frappe.msgprint({
						title: __("Template Test Successful"),
						message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Template:</strong> ${
									result.template_info.actual_name
								}</p>
                                <p><strong>Status:</strong> ${result.template_info.status}</p>
                                <p><strong>Language:</strong> ${
									result.template_info.language_code
								}</p>
                                <p><strong>Parameters Used:</strong> ${
									result.parameters_used.join(", ") || "None"
								}</p>
                                <p><strong>Message ID:</strong> ${
									result.response?.messages?.[0]?.id || "N/A"
								}</p>
                            </div>
                        `),
						indicator: "green",
					});
				} else {
					frappe.show_alert(__("Template test failed!"), 5, "red");

					frappe.msgprint({
						title: __("Template Test Failed"),
						message: __(`
                            <div style="padding: 10px;">
                                <p><strong>Error:</strong> ${result.error}</p>
                                <p><strong>Template:</strong> ${
									result.template_info?.actual_name || "Unknown"
								}</p>
                                <p><strong>Parameters Used:</strong> ${
									result.parameters_used.join(", ") || "None"
								}</p>
                                <p><strong>Request URL:</strong> ${result.request_url || "N/A"}</p>
                                <p><strong>Error Details:</strong></p>
                                <pre>${JSON.stringify(result.error_details, null, 2)}</pre>
                            </div>
                        `),
						indicator: "red",
					});
				}
			}
		},
	});
}

function fetch_whatsapp_approved_template(frm) {
	frappe.call({
		method: "klik_pos.klik_pos.doctype.whatsapp_message_templates.whatsapp_message_templates.fetch", // replace with your actual app + python file path
		freeze: true,
		freeze_message: __("Fetching templates from Meta..."),
		callback: function (r) {
			if (!r.exc) {
				frappe.msgprint({
					title: __("Success"),
					message: __("Templates synced successfully from Meta."),
					indicator: "green",
				});
				frm.reload_doc();
			}
		},
	});
}
