
import { useEffect, useState, useCallback } from "react";
import type { SalesInvoice } from "../../types";

export function useSalesInvoices(searchTerm: string = "") {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const LIMIT = 100;

  const fetchInvoices = useCallback(async (page = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const start = page * LIMIT;
      // console.log(`Fetching sales invoices - page: ${page}, start: ${start}, limit: ${LIMIT}, search: ${searchTerm}`);

      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      const response = await fetch(
        `/api/method/klik_pos.api.sales_invoice.get_sales_invoices?limit=${LIMIT}&start=${start}${searchParam}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include'
        }
      );

      // console.log('Sales invoices response:', {
      //   status: response.status,
      //   statusText: response.statusText,
      //   ok: response.ok
      // });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();

      if (!resData.message || !resData.message.success) {
        throw new Error(resData.message?.error || resData.error || "Failed to fetch invoices");
      }

      const rawInvoices = resData.message.data;
      const newInvoicesCount = rawInvoices.length;
      const totalCountFromAPI = resData.message.total_count || 0;

      // Check if we have more invoices to load
      setHasMore(newInvoicesCount === LIMIT);
      setTotalCount(totalCountFromAPI);

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
        paymentMethod: invoice.mode_of_payment || "-",
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

      if (append) {
        setInvoices(prev => [...prev, ...transformed]);
        setTotalLoaded(prev => prev + newInvoicesCount);
      } else {
        setInvoices(transformed);
        setTotalLoaded(newInvoicesCount);
      }

      setCurrentPage(page);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchTerm]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchInvoices(currentPage + 1, true);
    }
  }, [currentPage, isLoadingMore, hasMore, fetchInvoices]);

  const refetch = useCallback(() => {
    setCurrentPage(0);
    setTotalLoaded(0);
    setHasMore(true);
    fetchInvoices(0, false);
  }, [fetchInvoices]);

  useEffect(() => {
    fetchInvoices(0, false);
  }, [fetchInvoices]);

  // Refetch when search term changes
  useEffect(() => {
    if (searchTerm !== undefined) {
      setCurrentPage(0);
      setTotalLoaded(0);
      setHasMore(true);
      fetchInvoices(0, false);
    }
  }, [searchTerm, fetchInvoices]);

  return {
    invoices,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    totalLoaded,
    totalCount,
    loadMore,
    refetch,
  };
}
