import { useEffect, useState, useCallback } from "react";
import type { SalesInvoice } from "../../types";

export function useCustomerInvoices(customerName: string) {
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
    if (!customerName) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const start = page * LIMIT;
      console.log(`Fetching customer invoices - customer: ${customerName}, page: ${page}, start: ${start}, limit: ${LIMIT}`);

      // Search for invoices by customer name
      const searchParam = `&search=${encodeURIComponent(customerName)}`;
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

      console.log('Customer invoices response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      console.log('Customer invoices data:', resData);

      if (!resData.message || !resData.message.success) {
        throw new Error(resData.message?.error || resData.error || "Failed to fetch customer invoices");
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
        cashier: invoice.cashier_name || "Unknown",
        customer: invoice.customer_name || invoice.customer || "Walk-in Customer",
        totalAmount: Number(invoice.base_grand_total) || 0,
        status: invoice.status || "Draft",
        paymentMethod: invoice.payment_method || "-",
        discount: Number(invoice.discount_amount) || 0,
        tax: Number(invoice.total_taxes_and_charges) || 0,
        items: invoice.items || [],
        posProfile: invoice.pos_profile || "",
        customPosOpeningEntry: invoice.custom_pos_opening_entry || "",
        currency: invoice.currency || "USD",
        name: invoice.name,
        customZatcaSubmitStatus: invoice.custom_zatca_submit_status || null
      }));

      // Filter to only include invoices for this specific customer
      const customerSpecificInvoices = transformed.filter(invoice =>
        invoice.customer === customerName
      );

      if (append) {
        setInvoices(prev => [...prev, ...customerSpecificInvoices]);
        setTotalLoaded(prev => prev + customerSpecificInvoices.length);
      } else {
        setInvoices(customerSpecificInvoices);
        setTotalLoaded(customerSpecificInvoices.length);
      }

      setCurrentPage(page);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching customer invoices:', err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [customerName]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && customerName) {
      fetchInvoices(currentPage + 1, true);
    }
  }, [currentPage, isLoadingMore, hasMore, fetchInvoices, customerName]);

  const refetch = useCallback(() => {
    if (customerName) {
      setCurrentPage(0);
      setTotalLoaded(0);
      setHasMore(true);
      fetchInvoices(0, false);
    }
  }, [fetchInvoices, customerName]);

  useEffect(() => {
    if (customerName) {
      fetchInvoices(0, false);
    } else {
      setInvoices([]);
      setIsLoading(false);
    }
  }, [fetchInvoices, customerName]);

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
