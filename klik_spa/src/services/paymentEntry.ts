import { extractErrorMessage } from "../utils/errorExtraction";

export interface CustomerPaymentEntryRequest {
  customer: string;
  amount: number;
  mode_of_payment: string;
  sales_invoice?: string;
  allocated_amount?: number;
  reference_no?: string;
  reference_date?: string;
  remarks?: string;
}

export interface CustomerPaymentEntryResponse {
  success: boolean;
  name: string;
  customer: string;
  amount: number;
  mode_of_payment: string;
  sales_invoice?: string | null;
  allocated_amount?: number | null;
  opening_entry: string;
  posting_date: string;
}

export interface OutstandingSalesInvoice {
  name: string;
  posting_date: string;
  due_date?: string;
  customer: string;
  customer_name: string;
  company: string;
  currency: string;
  grand_total: number;
  rounded_total?: number;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
}

export interface OutstandingSalesInvoicesResponse {
  success: boolean;
  data: OutstandingSalesInvoice[];
  total_count: number;
  start: number;
  limit: number;
}

export interface UnallocatedCustomerPaymentEntry {
  name: string;
  posting_date: string;
  customer: string;
  customer_name?: string;
  company: string;
  mode_of_payment?: string;
  paid_amount: number;
  unallocated_amount: number;
  currency: string;
  reference_no?: string;
  remarks?: string;
}

export interface UnallocatedCustomerPaymentEntriesResponse {
  success: boolean;
  data: UnallocatedCustomerPaymentEntry[];
  total_count: number;
  start: number;
  limit: number;
}

export async function createCustomerPaymentEntry(
  payload: CustomerPaymentEntryRequest
): Promise<CustomerPaymentEntryResponse> {
  const csrfToken = window.csrf_token;

  const response = await fetch("/api/method/klik_pos.api.payment.create_customer_payment_entry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  const result = await response.json();

  if (!response.ok || !result.message || result.message.success === false) {
    throw new Error(extractErrorMessage(result, "Failed to receive customer payment"));
  }

  return result.message;
}

export async function getOutstandingSalesInvoices(
  search = "",
  start = 0,
  limit = 100
): Promise<OutstandingSalesInvoicesResponse> {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
  });
  if (search.trim()) params.set("search", search.trim());

  const response = await fetch(
    `/api/method/klik_pos.api.payment.get_outstanding_sales_invoices?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.message || result.message.success === false) {
    throw new Error(extractErrorMessage(result, "Failed to fetch outstanding invoices"));
  }

  return result.message;
}

export async function getUnallocatedCustomerPaymentEntries(
  search = "",
  start = 0,
  limit = 100
): Promise<UnallocatedCustomerPaymentEntriesResponse> {
  const params = new URLSearchParams({
    start: String(start),
    limit: String(limit),
  });
  if (search.trim()) params.set("search", search.trim());

  const response = await fetch(
    `/api/method/klik_pos.api.payment.get_unallocated_customer_payment_entries?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.message || result.message.success === false) {
    throw new Error(extractErrorMessage(result, "Failed to fetch payment entries"));
  }

  return result.message;
}

export async function reconcilePaymentEntryWithInvoice(
  paymentEntry: string,
  salesInvoice: string,
  allocatedAmount: number
) {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.payment.reconcile_payment_entry_with_invoice",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        payment_entry: paymentEntry,
        sales_invoice: salesInvoice,
        allocated_amount: allocatedAmount,
      }),
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.message || result.message.success === false) {
    throw new Error(extractErrorMessage(result, "Failed to reconcile payment"));
  }

  return result.message;
}
