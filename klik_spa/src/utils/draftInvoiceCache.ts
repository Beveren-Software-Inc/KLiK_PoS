import { useCartStore } from '../stores/cartStore';
import type { CartItem } from '../../types';

interface DraftInvoiceCache {
  items: CartItem[];
  timestamp: number;
  invoiceId: string;
}

const CACHE_KEY = 'draft-invoice-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function cacheDraftInvoiceItems(invoiceId: string, items: CartItem[]): void {
  const cache: DraftInvoiceCache = {
    items,
    timestamp: Date.now(),
    invoiceId
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedDraftInvoiceItems(): CartItem[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);

    if (!cached) {
      return null;
    }

    const cache: DraftInvoiceCache = JSON.parse(cached);

    // Check if cache is expired
    const now = Date.now();
    const age = now - cache.timestamp;

    if (age > CACHE_DURATION) {
      clearDraftInvoiceCache();
      return null;
    }

    return cache.items;
  } catch (error) {
    console.error('Error retrieving cached draft invoice items:', error);
    clearDraftInvoiceCache();
    return null;
  }
}

export function clearDraftInvoiceCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

export function loadCachedItemsToCart(): boolean {
  const cachedItems = getCachedDraftInvoiceItems();
  if (!cachedItems || cachedItems.length === 0) {
    return false;
  }

  const { addToCart, updateQuantity } = useCartStore.getState();

  // Add cached items to cart
  for (const item of cachedItems) {
    // Convert CartItem to the format expected by addToCart
    const cartItem = {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      image: item.image,
    };

    // Add item to cart (addToCart adds quantity: 1 by default)
    addToCart(cartItem);

    // Update quantity if needed
    if (item.quantity > 1) {
      updateQuantity(item.id, item.quantity);
    }
  }

  return true;
}

export function hasCachedDraftInvoiceItems(): boolean {
  const cached = localStorage.getItem(CACHE_KEY);

  if (!cached) {
    return false;
  }

  try {
    const cache: DraftInvoiceCache = JSON.parse(cached);
    const isValid = Date.now() - cache.timestamp <= CACHE_DURATION;
    return isValid;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
}
