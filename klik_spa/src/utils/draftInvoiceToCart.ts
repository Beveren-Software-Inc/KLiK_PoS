import { getDraftInvoiceItems } from '../services/salesInvoice';
import { toast } from 'react-toastify';
import { extractErrorFromException } from './errorExtraction';
import { cacheDraftInvoiceItems } from './draftInvoiceCache';
import type { Customer } from '../../types';

export interface InvoiceItem {
  name?: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  price_list_rate?: number;
  discount_amount?: number;
  discount_percentage?: number;
  amount: number;
  uom?: string;
  description?: string;
}

export interface CartItem {
  id: string;
  item_code?: string;
  name: string;
  category: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  discount_percentage?: number;
  custom_rate?: number;
  image: string;
  quantity: number;
  uom?: string;
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
    for (const [index, item] of invoiceData.items.entries()) {
      const discountAmount = Number(item.discount_amount) || 0;
      const discountPercentage = Number(item.discount_percentage) || 0;
      const priceListRate = Number(item.price_list_rate) || 0;
      const originalRate = priceListRate > 0 ? priceListRate : Number(item.rate || 0) + discountAmount;
      const cartItem: CartItem = {
        // Keep each draft line unique so duplicate item codes don't collapse into one cart row.
        id: item.name || `${item.item_code}-${index}`,
        item_code: item.item_code,
        name: item.item_name,
        category: 'General',
        price: originalRate,
        original_price: originalRate,
        discount_amount: discountAmount,
        discount_percentage: discountPercentage,
        image: '',
        quantity: item.qty,
        uom: item.uom,
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
