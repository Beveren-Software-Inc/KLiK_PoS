frappe.ui.form.on('Company', {
  refresh(frm) {
    frm.add_custom_button(__('Create Random Customers'), async () => {
      const d = new frappe.ui.Dialog({
        title: __('Create Random Customers'),
        fields: [
          { fieldname: 'count', label: __('Count'), fieldtype: 'Int', default: 2000, reqd: 1 },
          { fieldname: 'name_prefix', label: __('Name Prefix'), fieldtype: 'Data', default: 'Test Customer ' },
        ],
        primary_action_label: __('Create'),
        primary_action: async (values) => {
          d.hide();
          try {
            frappe.show_alert({message: __('Creating customers...'), indicator: 'blue'});
            const res = await frappe.call({
              method: 'klik_pos.api.customer.create_random_customers',
              args: { count: values.count, name_prefix: values.name_prefix },
            });
            const created = res && res.message && res.message.created ? res.message.created : 0;
            frappe.msgprint(__('Created {0} customers', [created]));
          } catch (e) {
            frappe.msgprint({ message: __('Failed: {0}', [e.message || e]), indicator: 'red' });
          }
        }
      });
      d.show();
    });
  }
});


