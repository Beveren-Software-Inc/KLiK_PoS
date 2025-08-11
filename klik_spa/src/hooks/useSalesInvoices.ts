
import { useEffect, useState } from "react";
import type { SalesInvoice } from "../../types";

export function useSalesInvoices() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const fetchInvoices = async () => {

  setIsLoading(true); // ✅ MUST ENABLE THIS
  try {
    
    const response = await fetch(
      "/api/method/klik_pos.api.sales_invoice.get_sales_invoices"
    );
    const resData = await response.json();
    
    const rawInvoices = resData.message.data;
    
    const transformed: SalesInvoice[] = rawInvoices.map((invoice: any) => ({
      id: invoice.name,
      date: invoice.posting_date || new Date().toISOString().split("T")[0],
      time: invoice.posting_time || "00:00:00",
      cashier: invoice.cashier_name,
      cashierId: invoice.owner || "",
      customer: invoice.customer_name || "",
      customerId: invoice.customer || "",
      items: [],
      subtotal:
        (invoice.base_grand_total || 0) -
        (invoice.total_taxes_and_charges || 0) +
        (invoice.discount_amount || 0),
      giftCardDiscount: invoice.discount_amount || 0,
      giftCardCode: invoice.discount_code || "",
      taxAmount: invoice.total_taxes_and_charges || 0,
      totalAmount: invoice.base_grand_total || 0,
      paymentMethod: invoice.mode_of_payment || "Cash",
      amountPaid: invoice.base_rounded_total || 0,
      changeGiven: invoice.change_amount || 0,
      status:
        (invoice.status as
          | "Completed"
          | "Pending"
          | "Cancelled"
          | "Refunded") || "Completed",
      refundAmount:
        invoice.status === "Refunded" ? invoice.base_grand_total || 0 : 0,
      custom_zatca_submit_status:
        (invoice.custom_zatca_submit_status as
          | "Pending"
          | "Reported"
          | "Not Reported"
          | "Cleared"
          | "Not Cleared") || "Draft",
      
      notes: invoice.remarks || "",
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
