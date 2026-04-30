
import { useEffect, useState, useCallback } from "react";
import type { SalesInvoice, SalesInvoiceItem } from "../../types";

export function useSalesInvoices(
  searchTerm: string = "",
  skipOpeningEntryFilter: boolean = false,
  cashierName?: string,
  submittedOnly: boolean = false
) {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const LIMIT = 100;

  // Debounced search term state
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchInvoices = useCallback(async (page = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const start = page * LIMIT;

      const searchParam = debouncedSearchTerm ? `&search=${encodeURIComponent(debouncedSearchTerm)}` : '';
      // Skip opening entry filter for Invoice History page - show all invoices for cashier
      const skipOpeningFilter = skipOpeningEntryFilter ? '&skip_opening_entry_filter=true' : '';
      // Filter by cashier name if provided
      const cashierParam = cashierName && cashierName !== 'all' ? `&cashier_name=${encodeURIComponent(cashierName)}` : '';
      // Only submitted invoices (exclude Draft and Cancelled) - for Sales Dashboard
      const submittedOnlyParam = submittedOnly ? '&submitted_only=true' : '';
      const response = await fetch(
        `/api/method/klik_pos.api.sales_invoice.get_sales_invoices?limit=${LIMIT}&start=${start}${searchParam}${skipOpeningFilter}${cashierParam}${submittedOnlyParam}`,
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
        throw new Error(resData.message?.error || resData.error || "Failed to fetch invoices");
      }

      const rawInvoices = resData.message.data;
      const newInvoicesCount = rawInvoices.length;
      const totalCountFromAPI = resData.message.total_count || 0;

      // Check if we have more invoices to load
      setHasMore(newInvoicesCount === LIMIT);
      setTotalCount(totalCountFromAPI);

      const transformed: SalesInvoice[] = rawInvoices.map((invoice: Record<string, unknown>) => {
        const status = invoice.status as string;
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: SalesInvoiceItem[] = Array.isArray((invoice as any).items)
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (((invoice as any).items as unknown[]) as SalesInvoiceItem[])
          : [];

        let canReturn = true;

        if (status === "Credit Note Issued") {
          const itemsWithAvailableQty = items.filter((item: SalesInvoiceItem & { available_qty?: number }) => (item.available_qty || 0) > 0);
          canReturn = itemsWithAvailableQty.length > 0;


        } else {
          // For all other invoices (Paid, Draft, etc.), show return button by default
          canReturn = true;
        }

        // @ts-expect-error - intentional type assertion for transformed invoice shape
        return {
          id: invoice.name,
          date: invoice.posting_date || new Date().toISOString().split("T")[0],
          time: invoice.posting_time || "00:00:00",
          cashier: invoice.cashier_name,
          cashierId: invoice.owner || "",
          customer: invoice.customer_name || "",
          customerId: invoice.customer || "",
          items: items,
          subtotal:
            (Number(invoice.base_grand_total) || 0) -
            (Number(invoice.total_taxes_and_charges) || 0) +
            (Number(invoice.discount_amount) || 0),
          giftCardDiscount: Number(invoice.discount_amount) || 0,
          giftCardCode: String(invoice.discount_code) || "",
          taxAmount: Number(invoice.total_taxes_and_charges) || 0,
          totalAmount: Number(invoice.base_grand_total) || 0,
          paymentMethod: invoice.mode_of_payment || "-",
          payment_methods: invoice.payment_methods || [],
          amountPaid: Number(invoice.base_rounded_total) || 0,
          changeGiven: Number(invoice.change_amount) || 0,
          status:
            (status as
              | "Draft"
              | "Unpaid"
              | "Partly Paid"
              | "Paid"
              | "Overdue"
              | "Cancelled"
              | "Return"
              | "Credit Note Issued"
              | "Completed"
              | "Pending"
              | "Refunded") || "Completed",
          refundAmount:
            status === "Refunded" ? Number(invoice.base_grand_total) || 0 : 0,
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
          queueStatus: (invoice.queue_status as string) || "",
          queueError: (invoice.queue_error as string) || "",
          queueAttempts: Number(invoice.queue_attempts) || 0,
          queueLastAttemptAt: (invoice.queue_last_attempt_at as string) || "",
          canReturn: canReturn,
        } as SalesInvoice & {
          queueStatus?: string;
          queueError?: string;
          queueAttempts?: number;
          queueLastAttemptAt?: string;
        };
      });

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
  }, [debouncedSearchTerm, skipOpeningEntryFilter, cashierName, submittedOnly]);

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

  // Initial load and refetch when debounced search term changes
  useEffect(() => {
    setCurrentPage(0);
    setTotalLoaded(0);
    setHasMore(true);
    fetchInvoices(0, false);
  }, [debouncedSearchTerm, fetchInvoices]);

  // Auto-load all invoices if total count is reasonable (for better client-side filtering)
  // This helps when client-side filtering reduces the visible count significantly
  // Auto-loads up to 10 pages (1000 invoices) to ensure users see all their filtered invoices
  useEffect(() => {
    if (!isLoading && !isLoadingMore && totalCount > 0 && totalCount <= 1000 && hasMore) {
      const remainingPages = Math.ceil((totalCount - totalLoaded) / LIMIT);
      if (remainingPages > 0 && remainingPages <= 10) {
        // Only auto-load if there are 10 or fewer pages remaining (to avoid too many requests)
        const loadAllPages = async () => {
          for (let page = currentPage + 1; page <= currentPage + remainingPages; page++) {
            if (!hasMore) break; // Stop if we've loaded everything
            await fetchInvoices(page, true);
          }
        };
        loadAllPages();
      }
    }
  }, [totalCount, totalLoaded, hasMore, isLoading, isLoadingMore, currentPage, fetchInvoices]);

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
