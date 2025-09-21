

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createDraftSalesInvoice(data: any) {
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

  // Add performance timing
  const startTime = performance.now();
  console.log('Starting invoice creation...');

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
  const endTime = performance.now();
  const processingTime = endTime - startTime;

  console.log(`Invoice creation completed in ${processingTime.toFixed(2)}ms`);
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

export async function getInvoiceDetails(invoiceName: string) {
  try {
    console.log('Fetching invoice details for:', invoiceName);
    const response = await fetch(`/api/method/klik_pos.api.sales_invoice.get_invoice_details?invoice_id=${invoiceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const data = await response.json();
    console.log('Invoice details response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get invoice details');
    }

    return {
      success: true,
      data: data.message
    };
  } catch (error: any) {
    console.error('Error getting invoice details:', error);
    return {
      success: false,
      error: error.message || 'Failed to get invoice details'
    };
  }
}

export async function deleteDraftInvoice(invoiceId: string) {
  const csrfToken = window.csrf_token;

  const response = await fetch('/api/method/klik_pos.api.sales_invoice.delete_draft_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
    credentials: 'include'
  });

  const result = await response.json();
  console.log("Delete invoice result:", result);

  if (!response.ok || !result.message || result.message.success === false) {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : result.message?.error || 'Failed to delete invoice';
    throw new Error(serverMsg);
  }

  return result.message;
}
