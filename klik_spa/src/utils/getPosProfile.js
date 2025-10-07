// utils/getPOSProfile.js
export async function getPOSProfile(posProfileName) {
	const res = await frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: "POS Profile",
			name: posProfileName,
		},
	});

	return res.message?.print_format;
}
