import { getDraftInvoiceItems } from '../services/salesInvoice';
import { toast } from 'react-toastify';
import { extractErrorFromException } from './errorExtraction';
import { cacheDraftInvoiceItems } from './draftInvoiceCache';
import type { Customer } from '../../types';

export interface InvoiceItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  description?: string;
}

export interface CartItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  quantity: number;
}

export async function addDraftInvoiceToCart(invoiceId: string): Promise<boolean> {
  try {
    // Fetch draft invoice items
    const invoiceData = await getDraftInvoiceItems(invoiceId);

    if (!invoiceData || !invoiceData.items || !Array.isArray(invoiceData.items)) {
      throw new Error('No items found in draft invoice');
    }

    // Convert invoice items to cart items
    const cartItems: CartItem[] = [];
    for (const item of invoiceData.items) {
      const cartItem: CartItem = {
        id: item.item_code,
        name: item.item_name,
        category: 'General',
        price: item.rate,
        image: '',
        quantity: item.qty,
      };
      cartItems.push(cartItem);
    }

    // Extract customer information from invoice data
    const customer: Customer | null = invoiceData.customer ? {
      id: invoiceData.customer,
      name: invoiceData.customer_name || invoiceData.customer,
      customer_name: invoiceData.customer_name || invoiceData.customer,
      email: invoiceData.customer_email || '',
      email_id: invoiceData.customer_email || '',
      phone: invoiceData.customer_mobile_no || '',
      mobile_no: invoiceData.customer_mobile_no || '',
      is_walkin: invoiceData.customer_is_walkin || 0,
      territory: '',
      customer_group: '',
      customer_type: 'individual',
      type: 'individual' as const,
      address: {
        addressType: 'Billing' as const,
        street: invoiceData.customer_address_line1 || '',
        city: invoiceData.customer_city || '',
        state: invoiceData.customer_state || '',
        zipCode: invoiceData.customer_pincode || '',
        country: invoiceData.customer_country || invoiceData.customer_address_doc?.country || '',
      },
      status: 'active' as const,
      preferredPaymentMethod: 'Cash' as const,
      loyaltyPoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      tags: [],
      createdAt: new Date().toISOString(),
    } : null;

    // Cache the items and customer instead of adding directly to cart
    cacheDraftInvoiceItems(invoiceId, cartItems, customer);

    return true;

  } catch (error: unknown) {
    console.error('Error caching draft invoice items:', error);
    const errorMessage = extractErrorFromException(error, 'Failed to cache draft invoice items');
    toast.error(errorMessage);
    return false;
  }
}
