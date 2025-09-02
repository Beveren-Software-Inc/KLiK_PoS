
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendEmails(data: any) {
  const csrfToken = window.csrf_token;

console.log("data", data)
  const response = await fetch('/api/method/klik_pos.api.email.send_invoice_email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Send email result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send email';
    throw new Error(serverMsg);
  }

  return result.message;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendWhatsApp(data: any) {
  const csrfToken = window.csrf_token;

  console.log("WhatsApp data", data);
  const response = await fetch('/api/method/klik_pos.api.whatsapp.send_invoice_whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Send WhatsApp result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send WhatsApp message';
    throw new Error(serverMsg);
  }

  return result.message;
}
