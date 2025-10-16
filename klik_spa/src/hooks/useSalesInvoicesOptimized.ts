import { useState, useEffect, useCallback } from 'react';
import { getSalesInvoicesLightweight, getInvoicePaymentMethods } from '../services/salesInvoice';
import type { SalesInvoice } from '../../types';

const LIMIT = 50; // Reduced limit for faster loading

export function useSalesInvoicesOptimized(searchTerm: string = "") {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Debounce search term to avoid too many API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

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
      console.log(`🚀 Fetching lightweight invoices - page: ${page}, start: ${start}, limit: ${LIMIT}, search: ${debouncedSearchTerm}`);

      const result = await getSalesInvoicesLightweight(LIMIT, start, debouncedSearchTerm);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch invoices');
      }

      const rawInvoices = result.data;
      const newInvoicesCount = rawInvoices.length;
      const totalCountFromAPI = result.total_count || 0;

      // Check if we have more invoices to load
      setHasMore(newInvoicesCount === LIMIT);
      setTotalCount(totalCountFromAPI);

      // Transform invoices to match expected format
      const transformed: SalesInvoice[] = rawInvoices.map((invoice: Record<string, unknown>) => ({
        id: invoice.name,
        date: invoice.posting_date || new Date().toISOString().split("T")[0],
        time: invoice.posting_time || "00:00:00",
        cashier: invoice.cashier_name || "Unknown",
        customer: invoice.customer_name || invoice.customer || "Walk-in Customer",
        totalAmount: Number(invoice.base_grand_total) || 0,
        status: invoice.status || "Draft",
        paymentMethod: invoice.mode_of_payment || "-",
        discount: Number(invoice.discount_amount) || 0,
        tax: Number(invoice.total_taxes_and_charges) || 0,
        items: invoice.items || [],
        posProfile: invoice.pos_profile || "",
        customPosOpeningEntry: invoice.custom_pos_opening_entry || "",
        currency: invoice.currency || "USD",
        name: invoice.name,
        customZatcaSubmitStatus: invoice.custom_zatca_submit_status || null
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

      // Load payment methods in background for visible invoices
      if (transformed.length > 0) {
        loadPaymentMethodsInBackground(transformed.map(inv => inv.name));
      }

    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearchTerm]);

  const loadPaymentMethodsInBackground = useCallback(async (invoiceNames: string[]) => {
    try {
      console.log('🔄 Loading payment methods in background for', invoiceNames.length, 'invoices');
      const paymentData = await getInvoicePaymentMethods(invoiceNames);

      // Update invoices with payment method data
      setInvoices(prev => prev.map(invoice => {
        const paymentInfo = paymentData[invoice.name];
        if (paymentInfo) {
          return {
            ...invoice,
            paymentMethod: paymentInfo.mode_of_payment,
            paymentMethods: paymentInfo.payment_methods
          };
        }
        return invoice;
      }));

      console.log('✅ Payment methods loaded successfully');
    } catch (error) {
      console.warn('Failed to load payment methods in background:', error);
      // Don't show error to user as this is background loading
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchInvoices(currentPage + 1, true);
    }
  }, [currentPage, isLoadingMore, hasMore, fetchInvoices]);

  const refetch = useCallback(() => {
    setCurrentPage(0);
    setTotalLoaded(0);
    fetchInvoices(0, false);
  }, [fetchInvoices]);

  // Initial load and when search term changes
  useEffect(() => {
    setCurrentPage(0);
    setTotalLoaded(0);
    fetchInvoices(0, false);
  }, [fetchInvoices]);

  return {
    invoices,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    totalLoaded,
    totalCount,
    loadMore,
    refetch
  };
}
