frappe.ui.form.on('POS Profile', {
    refresh(frm) {
        set_default_view(frm);
    },

    hide_images(frm) {
        set_default_view(frm);
    }
});

function set_default_view(frm) {
    if (frm.doc.hide_images) {
        frm.set_value('custom_default_view', 'List View');
    } else {
        frm.set_value('custom_default_view', 'Grid View');
    }
}