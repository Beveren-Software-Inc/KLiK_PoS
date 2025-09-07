import { useState, useEffect } from "react";
import type { SalesInvoice } from "../../types";

export function useInvoiceDetails(invoiceId: string | null) {
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;

    const fetchInvoice = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching invoice details for:", invoiceId);

        const response = await fetch(`/api/method/klik_pos.api.sales_invoice.get_invoice_details?invoice_id=${invoiceId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include'
        });

        console.log('Invoice details response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const resData = await response.json();
        console.log("Invoice details data:", resData);

        if (!resData.message || !resData.message.success) {
          throw new Error(resData.message?.error || resData.error || "Failed to fetch invoice");
        }

        setInvoice(resData.message.data);
      } catch (err: unknown) {
        console.error("Error fetching invoice details:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  return { invoice, isLoading, error };
}
