import frappe

def execute():
    """
    Sync custom_default_view based on hide_images for all POS Profile records.
    """
    profiles = frappe.get_all(
        "POS Profile",
        fields=["name", "hide_images"]
    )

    for p in profiles:
        new_view = "List View" if p.hide_images else "Grid View"

        frappe.db.set_value(
            "POS Profile",
            p.name,
            "custom_default_view",
            new_view,
            update_modified=False
        )

    frappe.db.commit()