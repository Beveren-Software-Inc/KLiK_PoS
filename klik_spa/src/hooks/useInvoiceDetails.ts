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
        console.log("Here")
        const response = await fetch(`/api/method/klik_pos.api.sales_invoice.get_invoice_details?invoice_id=${invoiceId}`);
        const resData = await response.json();
        if (!resData.message.success) {
          throw new Error(resData.error || "Failed to fetch invoice");
        }
        console.log("data",resData.message)
        setInvoice(resData.message.data);
      } catch (err: unknown) {
            if (err instanceof Error) {
              setError(err.message);
            } else {
              setError("Unknown error");
            }
          }
   finally {
        setIsLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  return { invoice, isLoading, error };
}
