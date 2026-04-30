import frappe
from frappe.utils import flt
from erpnext.stock.doctype.batch.batch import get_batch_qty


@frappe.whitelist()
def get_available_batches_and_serials(item_code, warehouse):
    if not item_code or not warehouse:
        return {
            "batches": [],
            "serials": []
        }

    batch_docs = frappe.get_all(
        "Batch",
        filters={"item": item_code},
        fields=["name", "expiry_date", "manufacturing_date"]
    )

    batches = []

    for b in batch_docs:
        qty = flt(get_batch_qty(batch_no=b.name, warehouse=warehouse))

        if qty > 0:
            batches.append({
                "batch_no": b.name,
                "qty": qty,
                "expiry_date": b.expiry_date,
                "manufacturing_date": b.manufacturing_date
            })

    serial_docs = frappe.get_all(
        "Serial No",
        filters={
            "item_code": item_code,
            "warehouse": warehouse,
            "status": "Active"
        },
        fields=["name", "serial_no"]
    )

    serials = [
        {
            "serial_no": s.serial_no or s.name
        }
        for s in serial_docs
    ]

    return {
        "batches": batches,
        "serials": serials
    }
