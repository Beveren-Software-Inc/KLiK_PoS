import { extractErrorMessage } from "../utils/errorExtraction";

export interface MpesaInitResponse {
  status: string;
  duplicate_prevented: boolean;
  request_name: string;
  request_status: string;
  checkout_request_id?: string;
  transaction_id?: string;
  amount: number;
  phone_number?: string;
}

export interface MpesaStatusResponse {
  request_name: string;
  status: string;
  result_code?: string;
  result_desc?: string;
  transaction_id?: string;
  checkout_request_id?: string;
  amount: number;
  phone_number?: string;
  is_reconciled?: number;
  reference?: {
    reference_doctype?: string;
    reference_name?: string;
  };
}

export interface MpesaRegisterPayment {
  name: string;
  full_name?: string;
  transamount: number;
  transid?: string;
  msisdn?: string;
  posting_date?: string;
  billrefnumber?: string;
  businessshortcode?: string;
  creation?: string;
}

export interface MpesaPaymentsResponse {
  count: number;
  payments: MpesaRegisterPayment[];
  shortcodes: string[];
}

export interface MpesaQuickPayResponse {
  success: boolean;
  payments_added?: Array<{
    mode_of_payment: string;
    amount: number;
    reference: string;
    account?: string;
  }>;
  mpesa_payments?: Array<{ name: string; amount: number }>;
  total_amount?: number;
  merged?: boolean;
  saved?: boolean;
  submitted?: boolean;
  error?: string;
}

export async function initiateKlikPosStkPush(payload: {
  phone_number: string;
  amount: number;
  mode_of_payment: string;
  company: string;
  account_reference: string;
  reference_doctype?: string;
  reference_name?: string;
  currency?: string;
  prevent_duplicates?: 0 | 1;
}) {
  const csrfToken = window.csrf_token;
  const response = await fetch(
    "/api/method/frappe_mpsa_payments.frappe_mpsa_payments.api.sales_invoice.initiate_klik_pos_stk_push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );

  const result = await response.json();
  if (!response.ok || !result.message || result.message.status !== "success") {
    const errorMessage = extractErrorMessage(result, "Failed to initiate M-Pesa STK push");
    throw new Error(errorMessage);
  }

  return result.message as MpesaInitResponse;
}

export async function fetchMpesaRegisterPayments(params: {
  company: string;
  pos_profile?: string;
  mode_of_payment?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  query.set("company", params.company);
  if (params.pos_profile) query.set("pos_profile", params.pos_profile);
  if (params.mode_of_payment) query.set("mode_of_payment", params.mode_of_payment);
  if (params.search) query.set("search", params.search);

  const response = await fetch(
    `/api/method/frappe_mpsa_payments.frappe_mpsa_payments.api.mpesa_quick_pay.get_mpesa_payments?${query.toString()}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }
  );

  const result = await response.json();
  if (!response.ok || !result.message) {
    const errorMessage = extractErrorMessage(result, "Failed to fetch Mpesa payments");
    throw new Error(errorMessage);
  }

  return result.message as MpesaPaymentsResponse;
}

export async function processKlikPosMpesaPayments(payload: {
  doctype: string;
  invoice_name: string;
  customer: string;
  mpesa_payments: string;
  auto_save?: 0 | 1;
  auto_submit?: 0 | 1;
  merge_payments?: 0 | 1;
}) {
  const csrfToken = window.csrf_token;
  const response = await fetch(
    "/api/method/frappe_mpsa_payments.frappe_mpsa_payments.api.mpesa_quick_pay.process_mpesa",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );

  const result = await response.json();
  if (!response.ok || !result.message || result.message.success !== true) {
    const errorMessage = extractErrorMessage(result, "Failed to reconcile Mpesa payments");
    throw new Error(errorMessage);
  }

  return result.message as MpesaQuickPayResponse;
}

export async function fetchKlikPosStkStatus(requestName: string) {
  const response = await fetch(
    `/api/method/frappe_mpsa_payments.frappe_mpsa_payments.api.sales_invoice.get_klik_pos_stk_status?request_name=${encodeURIComponent(requestName)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }
  );

  const result = await response.json();
  if (!response.ok || !result.message) {
    const errorMessage = extractErrorMessage(result, "Failed to fetch M-Pesa STK status");
    throw new Error(errorMessage);
  }

  return result.message as MpesaStatusResponse;
}

export async function linkKlikPosRequestToInvoice(payload: {
  request_name: string;
  invoice_name: string;
  invoice_doctype?: string;
}) {
  const csrfToken = window.csrf_token;
  const response = await fetch(
    "/api/method/frappe_mpsa_payments.frappe_mpsa_payments.api.sales_invoice.link_klik_pos_request_to_invoice",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );

  const result = await response.json();
  if (!response.ok || !result.message || result.message.success !== true) {
    const errorMessage = extractErrorMessage(result, "Failed to link M-Pesa request to invoice");
    throw new Error(errorMessage);
  }

  return result.message;
}
