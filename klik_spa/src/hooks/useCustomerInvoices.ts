import { useEffect, useState, useCallback } from "react";
import type { SalesInvoice, SalesInvoiceItem } from "../../types";

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();

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
                  //eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawCustomerId = (inv && (inv as any).customer) as string | undefined;
        return !!rawCustomerId && rawCustomerId === customerName;
      });

      const transformed: SalesInvoice[] = rawCustomerInvoices.map((invoice: Record<string, unknown>) => {
        const paymentMethods = (invoice.payment_methods as Array<{ mode_of_payment: string; amount?: number }> | undefined) || [];
                  //eslint-disable-next-line @typescript-eslint/no-explicit-any
        const primaryPaymentMethod = (invoice as any).mode_of_payment as string | undefined;

        return {
          id: invoice.name as string,
          date: (invoice.posting_date as string) || new Date().toISOString().split("T")[0],
          time: (invoice.posting_time as string) || "00:00:00",
          cashier: (invoice.cashier_name as string) || "Unknown",
          cashierId: (invoice.cashier as string) || "",
          // Use customer_name for display, but keep id separately
          customer: (invoice.customer_name as string) || (invoice.customer as string) || "Walk-in Customer",
          customerId: (invoice.customer as string) || null,
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: Array.isArray((invoice as any).items) ? ((invoice as any).items as SalesInvoiceItem[]) : [],
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          subtotal: Number((invoice as any).net_total) || 0,
          giftCardDiscount: 0,
          giftCardCode: null,
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          taxAmount: Number((invoice as any).total_taxes_and_charges) || 0,
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalAmount: Number((invoice as any).base_grand_total) || 0,
          paymentMethod: (primaryPaymentMethod as "Cash" | "Debit Card") || "Cash",
          payment_methods: paymentMethods.map(pm => ({ mode_of_payment: pm.mode_of_payment, amount: Number(pm.amount) || 0 })),
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          amountPaid: Number((invoice as any).paid_amount) || 0,
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          amountDue: Number((invoice as any).outstanding_amount) || 0,
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          changeGiven: Number((invoice as any).change_amount) || 0,
          status: (invoice.status as string) || "Draft",
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          refundAmount: Number((invoice as any).refund_amount) || 0,
                            //eslint-disable-next-line @typescript-eslint/no-explicit-any
          notes: ((invoice as any).remarks as string) || "",
          currency: (invoice.currency as string) || "USD",
          customer_address_doc: undefined,
          company_address_doc: undefined,
                    //eslint-disable-next-line @typescript-eslint/no-explicit-any
          company: ((invoice as any).company as string) || "",
          posting_date: (invoice.posting_date as string) || "",
          posting_time: (invoice.posting_time as string) || "",
          posProfile: (invoice.pos_profile as string) || undefined,
          custom_pos_opening_entry: (invoice.custom_pos_opening_entry as string) || undefined,
          name: invoice.name as string,
          custom_zatca_submit_status: (invoice.custom_zatca_submit_status as string) || undefined,
        } as SalesInvoice;
      });

      if (append) {
        setInvoices(prev => [...prev, ...transformed]);
        setTotalLoaded(prev => prev + transformed.length);
      } else {
        setInvoices(transformed);
        setTotalLoaded(transformed.length);
      }

      setCurrentPage(page);
      setError(null);
                //eslint-disable-next-line @typescript-eslint/no-explicit-any
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
