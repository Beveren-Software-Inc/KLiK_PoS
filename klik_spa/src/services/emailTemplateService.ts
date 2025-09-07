export interface EmailTemplate {
  name: string;
  subject: string;
  response_html: string;
  response: string;
}

export interface POSProfileEmailSettings {
  custom_email_template?: string;
}

/**
 * Fetch all Email templates
 */
export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const csrfToken = window.csrf_token;

  try {
    const response = await fetch('/api/method/klik_pos.api.email.get_email_templates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok || !result.message) {
      throw new Error('Failed to fetch Email templates');
    }

    return result.message;
  } catch (error) {
    console.error('Error fetching Email templates:', error);
    throw error;
  }
}

/**
 * Get the default Email template from POS Profile
 */
export async function getDefaultEmailTemplate(): Promise<string | null> {
  const csrfToken = window.csrf_token;

  try {
    const response = await fetch('/api/method/klik_pos.api.pos_profile.get_pos_details', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok || !result.message) {
      throw new Error('Failed to fetch POS profile details');
    }

    return result.message.custom_email_template || null;
  } catch (error) {
    console.error('Error fetching default Email template:', error);
    return null;
  }
}

/**
 * Get a specific Email template by name
 */
export async function getEmailTemplate(templateName: string): Promise<EmailTemplate | null> {
  const csrfToken = window.csrf_token;

  try {
    const response = await fetch(`/api/method/klik_pos.api.email.get_email_template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ template_name: templateName }),
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok || !result.message) {
      return null;
    }

    return result.message;
  } catch (error) {
    console.error('Error fetching Email template:', error);
    return null;
  }
}

/**
 * Process email template with parameters (supports HTML)
 */
export function processEmailTemplate(template: string, parameters: Record<string, any> = {}): string {
  let processedTemplate = template;

  // Replace common placeholders
  const commonReplacements = {
    '{{customer_name}}': parameters.customer_name || 'Customer',
    '{{customer}}': parameters.customer_name || 'Customer',
    '{{first_name}}': parameters.first_name || '',
    '{{last_name}}': parameters.last_name || '',
    '{{address}}': parameters.address || '',
    '{{customer_address}}': parameters.customer_address || '',
    '{{delivery_note}}': parameters.delivery_note || parameters.invoice_number || '',
    '{{grand_total}}': parameters.invoice_total || '0',
    '{{departure_time}}': parameters.departure_time || '',
    '{{estimated_arrival}}': parameters.estimated_arrival || '',
    '{{driver_name}}': parameters.driver_name || '',
    '{{cell_number}}': parameters.cell_number || '',
    '{{vehicle}}': parameters.vehicle || '',
    '{{invoice_total}}': parameters.invoice_total || '0',
    '{{invoice_number}}': parameters.invoice_number || '',
    '{{company_name}}': parameters.company_name || 'KLIK POS',
    '{{date}}': parameters.date || new Date().toLocaleDateString(),
  };

  Object.entries(commonReplacements).forEach(([placeholder, value]) => {
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return processedTemplate;
}

/**
 * Get default email message template
 */
export function getDefaultEmailMessageTemplate(): string {
  return `Dear {{customer_name}},

Thank you for your purchase. Here are your invoice details:

Invoice Total: {{invoice_total}}

Thank you for your business!

Best regards,
{{company_name}} Team`;
}
