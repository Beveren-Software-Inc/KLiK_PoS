import { useFrappeGetDocList } from "frappe-react-sdk";
import type { SalesInvoice } from "../../types";

// 1. Add this interface for raw ERPNext data
interface ERPSalesInvoice {
  name: string;
  posting_date?: string;
  posting_time?: string;
  owner?: string;
  customer_name?: string;
  customer?: string;
  base_grand_total?: number;
  base_rounded_total?: number;
  change_amount?: number;
  status?: string;
  mode_of_payment?: string;
  discount_amount?: number;
  discount_code?: string;
  total_taxes_and_charges?: number;
  remarks?: string;
}

export function useSalesInvoices() {
  // 2. Use the ERPSalesInvoice interface for the raw data
  const { data, error, isLoading, mutate } = useFrappeGetDocList<ERPSalesInvoice>("Sales Invoice", {
    fields: [
      "name",
      "posting_date",
      "posting_time",
      "owner",
      "customer_name",
      "customer",
      "base_grand_total",
      "base_rounded_total",
    //   "change_amount",
      "status",
    //   "mode_of_payment",
      "discount_amount",
    //   "discount_code",
      "total_taxes_and_charges",
    //   "remarks"
    ],
    limit: 100,
    orderBy: {
      field: "modified",
      order: "desc",
    }
  });

  // 3. Transform to your SalesInvoice type
  const invoices: SalesInvoice[] = (data || []).map(invoice => ({
    id: invoice.name,
    date: invoice.posting_date || new Date().toISOString().split('T')[0],
    time: invoice.posting_time || '00:00:00',
    cashier: "Cashier Name", // You'll need to fetch this from Users table
    cashierId: invoice.owner || '',
    customer: invoice.customer_name || '',
    customerId: invoice.customer || '',
    items: [], // Will need separate API call for items
    subtotal: (invoice.base_grand_total || 0) - (invoice.total_taxes_and_charges || 0) + (invoice.additional_discount_amount || 0),
    giftCardDiscount: invoice.additional_discount_amount || 0,
    giftCardCode: invoice.discount_code || '',
    taxAmount: invoice.total_taxes_and_charges || 0,
    totalAmount: invoice.base_grand_total || 0,
    paymentMethod: invoice.mode_of_payment || 'Cash',
    amountPaid: invoice.base_rounded_total || 0,
    changeGiven: invoice.change_amount || 0,
    status: (invoice.status as 'Completed' | 'Pending' | 'Cancelled' | 'Refunded') || 'Completed',
    refundAmount: invoice.status === 'Refunded' ? invoice.base_grand_total || 0 : 0,
    notes: invoice.remarks || ''
  }));

  return {
    invoices,
    isLoading,
    error,
    refetch: mutate
  };
}