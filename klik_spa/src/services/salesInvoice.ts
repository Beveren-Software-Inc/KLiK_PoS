
import { getCSRFToken } from "../utils/csrf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createDraftSalesInvoice(data: any) {
  // const csrfToken = getCSRFToken();
const csrfToken = window.csrf_token;
  const response = await fetch('/api/method/klik_pos.api.sales_invoice.create_draft_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ data }),
    credentials: 'include'
  });

  const result = await response.json();
  console.log("Invoice create result:", result);

  if (!response.ok || !result.message || result.message.success === false) {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to create invoice';
    throw new Error(serverMsg);
  }

  return result.message;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createSalesInvoice(data: any) {

const csrfToken = window.csrf_token;

  const response = await fetch('/api/method/klik_pos.api.sales_invoice.create_and_submit_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ data }),
    credentials: 'include'
  });

  const result = await response.json();
  console.log("Invoice create result:", result);

  if (!response.ok || !result.message || result.message.success === false) {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to create invoice';
    throw new Error(serverMsg);
  }

  return result.message;
}

export async function createSalesReturn(invoiceName: string) {
  const csrfToken = window.csrf_token;

  const response = await fetch('/api/method/klik_pos.api.sales_invoice.return_sales_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ invoice_name: invoiceName }),
    credentials: 'include'
  });

  const result = await response.json();
  console.log("Return Invoice result:", result);

  if (!response.ok || !result.message || result.message.success === false) {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : result.message?.message || 'Failed to return invoice';
    throw new Error(serverMsg);
  }

  return result.message;
}
