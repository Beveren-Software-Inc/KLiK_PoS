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
    // console.log("getCachedDraftInvoiceItems - raw cached data:", cached);

    if (!cached) {
      // console.log("getCachedDraftInvoiceItems - no cached data found");
      return null;
    }

    const cache: DraftInvoiceCache = JSON.parse(cached);
    // console.log("getCachedDraftInvoiceItems - parsed cache:", cache);

    // Check if cache is expired
    const now = Date.now();
    const age = now - cache.timestamp;
    // console.log("getCachedDraftInvoiceItems - cache age:", age, "ms, max age:", CACHE_DURATION, "ms");

    if (age > CACHE_DURATION) {
      clearDraftInvoiceCache();
      return null;
    }

    return cache;
  } catch (error) {
    console.error('Error retrieving cached draft invoice items:', error);
    clearDraftInvoiceCache();
    return null;
  }
}

export function clearDraftInvoiceCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

export async function loadCachedItemsToCart(): Promise<boolean> {
  const cachedData = getCachedDraftInvoiceItems();
  if (!cachedData || cachedData.items.length === 0) {
    return false;
  }

  const { setSelectedCustomer, addToCartWithQuantity } = useCartStore.getState();

  // Set customer if available
  if (cachedData.customer) {
    setSelectedCustomer(cachedData.customer);
  }

  // Add cached items to cart with correct quantities
  for (const item of cachedData.items) {
    const cartItem = {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      image: item.image,
      available: item.available,
      uom: item.uom,
      item_code: item.id,
    };

    // Use the new method to add items with specific quantities
    await addToCartWithQuantity(cartItem, item.quantity);
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
  // console.log("getOriginalDraftInvoiceId - cachedData:", cachedData);
  // console.log("getOriginalDraftInvoiceId - originalDraftInvoiceId:", cachedData?.originalDraftInvoiceId);
  return cachedData?.originalDraftInvoiceId || null;
}
