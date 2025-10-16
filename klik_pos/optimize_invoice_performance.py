"""
Database optimization script for Klik POS invoice performance.
Run this script to add indexes that will significantly improve query performance.
"""

import frappe


def add_invoice_performance_indexes():
	"""
	Add database indexes to improve invoice query performance.
	"""
	try:
		# Index on custom_pos_opening_entry for fast filtering
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_pos_opening_entry
            ON `tabSales Invoice` (custom_pos_opening_entry)
        """)

		# Composite index for common query patterns
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_pos_composite
            ON `tabSales Invoice` (custom_pos_opening_entry, docstatus, modified DESC)
        """)

		# Index on posting_date for date-based queries
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_posting_date
            ON `tabSales Invoice` (posting_date DESC)
        """)

		# Index on customer for customer-specific queries
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_customer
            ON `tabSales Invoice` (customer, docstatus)
        """)

		# Index on Sales Invoice Payment for payment queries
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_payment_parent
            ON `tabSales Invoice Payment` (parent)
        """)

		# Index on Sales Invoice Item for item queries
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_item_parent
            ON `tabSales Invoice Item` (parent)
        """)

		# Index on return_against for return queries
		frappe.db.sql("""
            CREATE INDEX IF NOT EXISTS idx_sales_invoice_return_against
            ON `tabSales Invoice` (return_against, is_return)
        """)

		frappe.db.commit()
		print("✅ Database indexes added successfully!")

	except Exception as e:
		frappe.log_error(f"Error adding database indexes: {e}")
		print(f"❌ Error adding indexes: {e}")


def remove_invoice_performance_indexes():
	"""
	Remove the performance indexes if needed.
	"""
	try:
		indexes_to_remove = [
			"idx_sales_invoice_pos_opening_entry",
			"idx_sales_invoice_pos_composite",
			"idx_sales_invoice_posting_date",
			"idx_sales_invoice_customer",
			"idx_sales_invoice_payment_parent",
			"idx_sales_invoice_item_parent",
			"idx_sales_invoice_return_against",
		]

		for index_name in indexes_to_remove:
			frappe.db.sql(f"DROP INDEX IF EXISTS {index_name} ON `tabSales Invoice`")
			frappe.db.sql(f"DROP INDEX IF EXISTS {index_name} ON `tabSales Invoice Payment`")
			frappe.db.sql(f"DROP INDEX IF EXISTS {index_name} ON `tabSales Invoice Item`")

		frappe.db.commit()
		print("✅ Database indexes removed successfully!")

	except Exception as e:
		frappe.log_error(f"Error removing database indexes: {e}")


if __name__ == "__main__":
	# Run the optimization
	add_invoice_performance_indexes()
