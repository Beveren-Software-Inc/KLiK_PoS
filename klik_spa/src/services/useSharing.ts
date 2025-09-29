
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendEmails(data: any) {
  const csrfToken = window.csrf_token;

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


// Extend Window interface to include csrf_token
declare global {
  interface Window {
    csrf_token: string;
  }
}

interface WhatsAppData {
  mobile_no?: string;
  message?: string;
  customer_name?: string;
  invoice_data?: string;
  template_name?: string;
  template_parameters?: string[];
}

// export async function sendWhatsApp(data: WhatsAppData) {
//   const csrfToken = window.csrf_token;

//   console.log("WhatsApp data", data);

//   // Determine which API to call based on data
//   const hasInvoice = data.invoice_data;
//   const hasTemplate = data.template_name;

//   let apiEndpoint: string;
//   let requestData: WhatsAppData;

//   if (hasInvoice) {
//     // Invoice message
//     apiEndpoint = '/api/method/klik_pos.api.whatsapp.send_invoice_whatsapp';
//     requestData = data;
//   } else if (hasTemplate) {
//     // Template message
//     apiEndpoint = '/api/method/klik_pos.api.whatsapp.send_template_whatsapp';
//     requestData = data;
//   } else {
//     // Simple text message
//     apiEndpoint = '/api/method/klik_pos.api.whatsapp.send_simple_whatsapp';
//     requestData = {
//       mobile_no: data.mobile_no,
//       message: data.message || 'Hello from KLiK PoS!'
//     };
//   }

//   const response = await fetch(apiEndpoint, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'X-Frappe-CSRF-Token': csrfToken,
//     },
//     body: JSON.stringify(requestData),
//     credentials: 'include',
//   });

//   const result = await response.json();
//   console.log("Send WhatsApp result:", result);

//   if (!response.ok || !result.message || result.message.status !== "success") {
//     const serverMsg = result._server_messages
//       ? JSON.parse(result._server_messages)[0]
//       : 'Failed to send WhatsApp message';
//     throw new Error(serverMsg);
//   }

//   return result.message;
// }

// New function specifically for simple text messages
export async function sendWhatsAppMessage(data: WhatsAppData) {
  const csrfToken = window.csrf_token;

  console.log("Simple WhatsApp data", data);

  const response = await fetch('/api/method/klik_pos.api.whatsapp.deliver_invoice_via_whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Send Simple WhatsApp result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send WhatsApp message';
    throw new Error(serverMsg);
  }

  return result.message;
}

// Function for sending template messages
export async function sendTemplateWhatsApp(mobile: string, templateName: string, parameters?: string[]) {
  const csrfToken = window.csrf_token;

  console.log("Template WhatsApp data", {
    mobile_no: mobile,
    template_name: templateName,
    template_parameters: parameters
  });

  const response = await fetch('/api/method/klik_pos.api.whatsapp.send_template_whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      mobile_no: mobile,
      template_name: templateName,
      template_parameters: parameters || []
    }),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Send Template WhatsApp result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send WhatsApp message';
    throw new Error(serverMsg);
  }

  return result.message;
}

// Function for sending invoice with PDF attachment
export async function sendInvoiceWithPDF(mobile: string, invoiceNo: string, message?: string) {
  const csrfToken = window.csrf_token;

  console.log("Invoice PDF data", {
    mobile_no: mobile,
    invoice_data: invoiceNo,
    message: message || 'Your invoice is ready!'
  });

  const response = await fetch('/api/method/klik_pos.api.whatsapp.send_invoice_whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      mobile_no: mobile,
      invoice_data: invoiceNo,
      message: message || 'Your invoice is ready!'
    }),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Send Invoice PDF result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send invoice WhatsApp message';
    throw new Error(serverMsg);
  }

  return result.message;
}

// Function for sending invoice with customer data (from frontend)
export async function sendInvoiceWhatsApp(data: {
  mobile_no: string;
  customer_name: string;
  invoice_data: string;
  message?: string;
}) {
  const csrfToken = window.csrf_token;

  console.log("Frontend Invoice WhatsApp data", data);

  const response = await fetch('/api/method/klik_pos.api.whatsapp.send_invoice_whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      mobile_no: data.mobile_no,
      customer_name: data.customer_name,
      invoice_data: data.invoice_data,
      message: data.message || 'Your invoice is ready! Please find the PDF attached.'
    }),
    credentials: 'include',
  });

  const result = await response.json();
  console.log("Frontend Invoice WhatsApp result:", result);

  if (!response.ok || !result.message || result.message.status !== "success") {
    const serverMsg = result._server_messages
      ? JSON.parse(result._server_messages)[0]
      : 'Failed to send invoice WhatsApp message';
    throw new Error(serverMsg);
  }

  return result.message;
}
