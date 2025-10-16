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

      // IMPORTANT: Filter by raw customer id BEFORE transforming labels to names
      const rawCustomerInvoices = (rawInvoices as Array<Record<string, unknown>>).filter((inv) => {
        const rawCustomerId = (inv && (inv as any).customer) as string | undefined;
        return !!rawCustomerId && rawCustomerId === customerName;
      });

      const transformed: SalesInvoice[] = rawCustomerInvoices.map((invoice: Record<string, unknown>) => ({
        id: invoice.name as string,
        date: (invoice.posting_date as string) || new Date().toISOString().split("T")[0],
        time: (invoice.posting_time as string) || "00:00:00",
        cashier: (invoice.cashier_name as string) || "Unknown",
        // Use customer_name for display, but keep id separately for future if needed
        customer: (invoice.customer_name as string) || (invoice.customer as string) || "Walk-in Customer",
        totalAmount: Number(invoice.base_grand_total) || 0,
        status: (invoice.status as string) || "Draft",
        // FIX: payment_method isn't provided by backend; use mode_of_payment or derive from payment_methods
        paymentMethod: (invoice.mode_of_payment as string)
          || (((invoice.payment_methods as Array<{ mode_of_payment: string }> | undefined)?.length || 0) > 1
                ? (invoice.payment_methods as Array<{ mode_of_payment: string }>).map(pm => pm.mode_of_payment).join("/")
                : ((invoice.payment_methods as Array<{ mode_of_payment: string }> | undefined)?.[0]?.mode_of_payment))
          || "-",
        discount: Number(invoice.discount_amount) || 0,
        tax: Number(invoice.total_taxes_and_charges) || 0,
        items: (invoice.items as any[]) || [],
        posProfile: (invoice.pos_profile as string) || "",
        customPosOpeningEntry: (invoice.custom_pos_opening_entry as string) || "",
        currency: (invoice.currency as string) || "USD",
        name: invoice.name as string,
        customZatcaSubmitStatus: (invoice.custom_zatca_submit_status as string) || null
      }));

      if (append) {
        setInvoices(prev => [...prev, ...transformed]);
        setTotalLoaded(prev => prev + transformed.length);
      } else {
        setInvoices(transformed);
        setTotalLoaded(transformed.length);
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
