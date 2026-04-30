frappe.ui.form.on("Sales Person", {
	refresh(frm) {
		frm.add_custom_button(
			__("Set PIN"),
			function () {
				frappe.prompt(
					[
						{
							label: "Enter PIN",
							fieldname: "pos_pin",
							fieldtype: "Password",
						},
						{
							label: "Confirm PIN",
							fieldname: "confirm_pos_pin",
							fieldtype: "Password",
						},
					],
					(values) => {
						if (values.pos_pin) {
							if (!/^\d{4}$/.test(values.pos_pin)) {
								frappe.msgprint({
									title: __("Error"),
									message: __("PIN must contain only 4 numbers."),
									indicator: "red",
								});
								return;
							}
						}
						if (values.pos_pin !== values.confirm_pos_pin) {
							frappe.msgprint({
								title: __("Error"),
								message: __("PINs do not match. Please try again."),
								indicator: "red",
							});
							return;
						}
						frm.set_value("pos_pin", values.pos_pin);
						frappe.msgprint({
							title: __("Success"),
							message: __("PIN set successfully!"),
							indicator: "green",
						});
						frm.save();
					},
				);
			},
			__("Actions"),
		);
	},
});
