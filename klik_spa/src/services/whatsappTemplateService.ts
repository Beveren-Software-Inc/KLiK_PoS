export interface WhatsAppTemplate {
  name: string;
  template_name: string;
  template: string;
  status: string;
  category: string;
  language: string;
  language_code: string;
  header_type?: string;
  header?: string;
  footer?: string;
  sample_values?: string;
  field_names?: string;
}

export interface POSProfileWhatsAppSettings {
  custom_whatsap_template?: string;
}

/**
 * Fetch all WhatsApp message templates
 */
export async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const csrfToken = window.csrf_token;

  try {
    const response = await fetch('/api/method/klik_pos.api.whatsapp.get_whatsapp_templates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken,
      },
      credentials: 'include',
    });

    const result = await response.json();
    
    if (!response.ok || !result.message) {
      throw new Error('Failed to fetch WhatsApp templates');
    }

    return result.message;
  } catch (error) {
    console.error('Error fetching WhatsApp templates:', error);
    throw error;
  }
}

/**
 * Get the default WhatsApp template from POS Profile
 */
export async function getDefaultWhatsAppTemplate(): Promise<string | null> {
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

    return result.message.custom_whatsap_template || null;
  } catch (error) {
    console.error('Error fetching default WhatsApp template:', error);
    return null;
  }
}

/**
 * Get a specific WhatsApp template by name
 */
export async function getWhatsAppTemplate(templateName: string): Promise<WhatsAppTemplate | null> {
  const csrfToken = window.csrf_token;

  try {
    const response = await fetch(`/api/method/klik_pos.api.whatsapp.get_whatsapp_template`, {
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
    console.error('Error fetching WhatsApp template:', error);
    return null;
  }
}

/**
 * Process template with parameters
 */
export function processTemplate(template: string, parameters: Record<string, any> = {}): string {
  let processedTemplate = template;
  
  // Replace common placeholders
  const commonReplacements = {
    '{{customer_name}}': parameters.customer_name || 'there',
    '{{invoice_total}}': parameters.invoice_total || '0',
    '{{invoice_number}}': parameters.invoice_number || '',
    '{{company_name}}': parameters.company_name || 'KLiK PoS',
    '{{date}}': parameters.date || new Date().toLocaleDateString(),
  };

  Object.entries(commonReplacements).forEach(([placeholder, value]) => {
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return processedTemplate;
}

/**
 * Get default message template
 */
export function getDefaultMessageTemplate(): string {
  return `Hi {{customer_name}}!

Thank you for shopping with us at {{company_name}}!

Invoice Total: *{{invoice_total}}*

We appreciate your business!`;
}
