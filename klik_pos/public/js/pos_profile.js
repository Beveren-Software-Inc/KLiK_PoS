frappe.ui.form.on('POS Profile', {
    hide_images(frm) {
        if (!frm.doc.custom_default_view) {
            frm.set_value('custom_default_view', frm.doc.hide_images ? 'List View' : 'Grid View');
        }
    }
});