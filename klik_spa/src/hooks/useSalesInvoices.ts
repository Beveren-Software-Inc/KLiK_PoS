
import { useEffect, useState } from "react";
import type { SalesInvoice } from "../../types";

export function useSalesInvoices() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const fetchInvoices = async () => {
  setIsLoading(true);
  try {
    console.log('Fetching sales invoices...');

    const response = await fetch(
      "/api/method/klik_pos.api.sales_invoice.get_sales_invoices",
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include'
      }
    );

    console.log('Sales invoices response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const resData = await response.json();
    console.log('Sales invoices data:', resData);

    if (!resData.message || !resData.message.success) {
      throw new Error(resData.message?.error || resData.error || "Failed to fetch invoices");
    }

    const rawInvoices = resData.message.data;

    const transformed: SalesInvoice[] = rawInvoices.map((invoice: Record<string, unknown>) => ({
      id: invoice.name,
      date: invoice.posting_date || new Date().toISOString().split("T")[0],
      time: invoice.posting_time || "00:00:00",
      cashier: invoice.cashier_name,
      cashierId: invoice.owner || "",
      customer: invoice.customer_name || "",
      customerId: invoice.customer || "",
      items: invoice.items || [],
      subtotal:
        (Number(invoice.base_grand_total) || 0) -
        (Number(invoice.total_taxes_and_charges) || 0) +
        (Number(invoice.discount_amount) || 0),
      giftCardDiscount: Number(invoice.discount_amount) || 0,
      giftCardCode: String(invoice.discount_code) || "",
      taxAmount: Number(invoice.total_taxes_and_charges) || 0,
      totalAmount: Number(invoice.base_grand_total) || 0,
      paymentMethod: invoice.mode_of_payment || "Cash",
      amountPaid: Number(invoice.base_rounded_total) || 0,
      changeGiven: Number(invoice.change_amount) || 0,
      status:
        (invoice.status as
          | "Completed"
          | "Pending"
          | "Cancelled"
          | "Refunded") || "Completed",
      refundAmount:
        invoice.status === "Refunded" ? Number(invoice.base_grand_total) || 0 : 0,
      custom_zatca_submit_status:
        (invoice.custom_zatca_submit_status as
          | "Pending"
          | "Reported"
          | "Not Reported"
          | "Cleared"
          | "Not Cleared") || "Draft",
      currency: invoice.currency || "USD",
      notes: invoice.remarks || "",
      posProfile: invoice.pos_profile || "",
      custom_pos_opening_entry: invoice.custom_pos_opening_entry || "",
    }));
    // console.log("Transformed", transformed)
    setInvoices(transformed);
    setError(null); // Reset error if successful
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    setError(err.message || "Unknown error occurred");
  } finally {
    setIsLoading(false); // ✅ VERY IMPORTANT
  }
};


  useEffect(() => {
    fetchInvoices();
  }, []);

  return {
    invoices,
    isLoading,
    error,
    refetch: fetchInvoices,
  };
}
