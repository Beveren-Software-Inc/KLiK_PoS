import { useCartStore } from '../stores/cartStore';
import { getDraftInvoiceItems } from '../services/salesInvoice';
import { toast } from 'react-toastify';
import { cacheDraftInvoiceItems } from './draftInvoiceCache';

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
    console.log('Fetching draft invoice items for:', invoiceId);
    // Fetch draft invoice items
    const invoiceData = await getDraftInvoiceItems(invoiceId);
    console.log('Invoice data received:', invoiceData);

    if (!invoiceData || !invoiceData.items || !Array.isArray(invoiceData.items)) {
      console.error('No items found in draft invoice. Invoice data:', invoiceData);
      throw new Error('No items found in draft invoice');
    }

    console.log('Items found:', invoiceData.items.length);

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

    // Cache the items instead of adding directly to cart
    cacheDraftInvoiceItems(invoiceId, cartItems);

    return true;

  } catch (error: any) {
    console.error('Error caching draft invoice items:', error);
    toast.error(error.message || 'Failed to cache draft invoice items');
    return false;
  }
}
