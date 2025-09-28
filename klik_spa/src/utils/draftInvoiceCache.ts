import { useCartStore } from '../stores/cartStore';
import type { CartItem, Customer } from '../../types';

interface DraftInvoiceCache {
  items: CartItem[];
  timestamp: number;
  invoiceId: string;
  customer: Customer | null;
  originalDraftInvoiceId: string; // Track the original draft invoice to delete later
}

const CACHE_KEY = 'draft-invoice-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function cacheDraftInvoiceItems(invoiceId: string, items: CartItem[], customer: Customer | null): void {
  const cache: DraftInvoiceCache = {
    items,
    timestamp: Date.now(),
    invoiceId,
    customer,
    originalDraftInvoiceId: invoiceId // Store the original draft invoice ID
  };

  console.log("cacheDraftInvoiceItems - storing cache:", cache);
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getCachedDraftInvoiceItems(): DraftInvoiceCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    console.log("getCachedDraftInvoiceItems - raw cached data:", cached);

    if (!cached) {
      console.log("getCachedDraftInvoiceItems - no cached data found");
      return null;
    }

    const cache: DraftInvoiceCache = JSON.parse(cached);
    console.log("getCachedDraftInvoiceItems - parsed cache:", cache);

    // Check if cache is expired
    const now = Date.now();
    const age = now - cache.timestamp;
    console.log("getCachedDraftInvoiceItems - cache age:", age, "ms, max age:", CACHE_DURATION, "ms");

    if (age > CACHE_DURATION) {
      console.log("getCachedDraftInvoiceItems - cache expired, clearing");
      clearDraftInvoiceCache();
      return null;
    }

    console.log("getCachedDraftInvoiceItems - returning valid cache");
    return cache;
  } catch (error) {
    console.error('Error retrieving cached draft invoice items:', error);
    clearDraftInvoiceCache();
    return null;
  }
}

export function clearDraftInvoiceCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log('Draft invoice cache cleared');
}

export function loadCachedItemsToCart(): boolean {
  const cachedData = getCachedDraftInvoiceItems();
  if (!cachedData || cachedData.items.length === 0) {
    return false;
  }

  const { addToCart, updateQuantity, setSelectedCustomer } = useCartStore.getState();

  // Set customer if available
  if (cachedData.customer) {
    setSelectedCustomer(cachedData.customer);
  }

  // Add cached items to cart
  for (const item of cachedData.items) {
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

export function getOriginalDraftInvoiceId(): string | null {
  const cachedData = getCachedDraftInvoiceItems();
  console.log("getOriginalDraftInvoiceId - cachedData:", cachedData);
  console.log("getOriginalDraftInvoiceId - originalDraftInvoiceId:", cachedData?.originalDraftInvoiceId);
  return cachedData?.originalDraftInvoiceId || null;
}
