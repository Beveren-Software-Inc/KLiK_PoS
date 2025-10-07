frappe.ui.form.on("Sales Invoice", {
	refresh: function (frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Send via WhatsApp"), function () {
				// Prefill mobile from invoice (if available)
				let mobile_no = frm.doc.contact_mobile || frm.doc.mobile_no || "";

				let d = new frappe.ui.Dialog({
					title: "Send Invoice via WhatsApp",
					fields: [
						{
							label: "Mobile Number",
							fieldname: "mobile",
							fieldtype: "Data",
							reqd: 1,
							default: mobile_no,
						},
						{
							label: "Message",
							fieldname: "message",
							fieldtype: "Small Text",
							default: `Hello ${frm.doc.customer_name}, your invoice ${frm.doc.name} is ready!`,
						},
					],
					primary_action_label: "Send",
					primary_action(values) {
						frappe.call({
							method: "klik_pos.api.whatsapp.deliver_invoice_via_whatsapp_doc",
							args: {
								invoice_name: frm.doc.name,
								mobile_no: values.mobile,
								message: values.message,
							},
							callback: function (r) {
								if (r.message && r.message.status === "success") {
									frappe.msgprint(
										`WhatsApp message sent to ${r.message.recipient}`
									);
								}
								d.hide();
							},
						});
					},
				});

				d.show();
			});
		}
	},
});
