



export async function createDraftSalesInvoice(data: any) {
  const response = await fetch('/api/method/klik_pos.api.sales_invoice.create_draft_invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data })
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
