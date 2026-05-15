// stores/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, GiftCoupon } from '../../types'
import type { Customer } from '../types/customer'
import { toast } from 'react-toastify'
import { clearDraftInvoiceCache } from '../utils/draftInvoiceCache'
import { usePOSProfileStore } from './posProfileStore'

interface SerialBatchEntry {
  serial_no?: string;
  batch_no?: string;
  qty?: number;
}

interface ItemTaxDetailsPayload {
  item_tax_template?: string;
  item_tax_rate?: Record<string, number>;
  rate?: number;
  tax_info?: {
    tax_templates?: Array<{ account: string; rate: number; is_inclusive: boolean }>;
    total_tax_rate?: number;
  };
}

interface PricedItemPayload {
  id?: string;
  item_code?: string;
  price?: number;
  original_price?: number;
  discount_percentage?: number;
  discount_amount?: number;
  pricing_rules?: unknown;
  has_pricing_rule?: boolean;
}

const getCurrencyPrecision = (): number => {
  const maybeFrappe = (window as unknown as {
    frappe?: { boot?: { sysdefaults?: { currency_precision?: string | number } } }
  }).frappe;
  const precision = Number(maybeFrappe?.boot?.sysdefaults?.currency_precision);
  return Number.isFinite(precision) && precision >= 0 ? precision : 2;
};

const roundToCurrencyPrecision = (value: number): number => {
  const precision = getCurrencyPrecision();
  return Number(Number(value || 0).toFixed(precision));
};

const fetchItemTaxDetails = async (
  itemCode: string,
  customerId?: string,
  quantity: number = 1,
  uom?: string,
) => {
  try {
    const params = new URLSearchParams({
      item_code: itemCode,
      qty: String(quantity > 0 ? quantity : 1),
      uom: uom || 'Nos',
    });

    if (customerId) {
      params.append('customer', customerId);
    }

    const response = await fetch(
      `/api/method/klik_pos.api.item.item_tax_details.get_item_tax_details?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const message: ItemTaxDetailsPayload & { success?: boolean } = result?.message || {};

    if (!message.success) {
      return {
        item_tax_template: '',
        item_tax_rate: {},
        rate: 0,
        tax_templates: [],
        total_tax_rate: 0,
      };
    }

    return {
      item_tax_template: message.item_tax_template || '',
      item_tax_rate: message.item_tax_rate || {},
      rate: roundToCurrencyPrecision(Number(message.rate || 0)),
      tax_templates: message.tax_info?.tax_templates || [],
      total_tax_rate: Number(message.tax_info?.total_tax_rate || 0),
    };
  } catch (error) {
    console.error('Error fetching item tax details:', error);
    return {
      item_tax_template: '',
      item_tax_rate: {},
      rate: 0,
      tax_templates: [],
      total_tax_rate: 0,
    };
  }
};

interface CartState {
  cartItems: CartItem[]
  appliedCoupons: GiftCoupon[]
  selectedCustomer: Customer | null
  isPricingLoading: boolean
  pricingError: string | null

  addToCart: (item: Omit<CartItem, 'quantity'>) => Promise<void>
  addToCartWithQuantity: (item: Omit<CartItem, 'quantity'>, quantity: number) => Promise<void>
  updateQuantity: (id: string, quantity: number) => Promise<void>
  updateUOM: (id: string, uom: string, price: number) => Promise<void>
  removeItem: (id: string) => void
  clearCart: () => void
  applyCoupon: (coupon: GiftCoupon) => void
  removeCoupon: (couponCode: string) => void
  setSelectedCustomer: (customer: Customer | null) => Promise<void>
  refreshCartPricing: () => Promise<void>
  updateItemBundleEntries: (id: string, entries: SerialBatchEntry[]) => void
}

const shouldInsertNewItemsAtTop = (): boolean => {
  const position = usePOSProfileStore.getState().posDetails?.custom_cart_item_insertion_position;
  return position === 'Top';
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      appliedCoupons: [],
      selectedCustomer: null,
      isPricingLoading: false,
      pricingError: null,

      refreshCartPricing: async () => {
        const state = get();
        if (state.cartItems.length === 0) return;

        set({ isPricingLoading: true, pricingError: null });

        try {
          const itemsForPricing = state.cartItems.map(item => ({
            id: item.id,
            item_code: item.item_code || item.id,
            quantity: item.quantity,
            price: item.price,
            uom: item.uom,
          }));

          const customerId = state.selectedCustomer?.id;
          const url = `/api/method/klik_pos.api.item.pricing.get_cart_pricing?cart_items=${encodeURIComponent(JSON.stringify(itemsForPricing))}${customerId ? `&customer=${customerId}` : ''}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();
          const pricingData = result.message;

          if (pricingData?.items) {
            set((state) => ({
              cartItems: state.cartItems.map(item => {
                const pricedItem = (pricingData.items as PricedItemPayload[]).find((p) => 
                  (p.id === item.id) || (p.item_code === (item.item_code || item.id))
                );
                if (pricedItem) {
                  const basePrice = Number(pricedItem.price || 0);

                  return {
                    ...item,
                    price: roundToCurrencyPrecision(basePrice),
                    original_price: pricedItem.original_price,
                    discount_percentage: pricedItem.discount_percentage,
                    discount_amount: pricedItem.discount_amount,
                    pricing_rules: pricedItem.pricing_rules,
                    has_pricing_rule: pricedItem.has_pricing_rule,
                  };
                }
                return item;
              }),
              isPricingLoading: false,
            }));
          } else {
            set({ isPricingLoading: false });
          }
        } catch (error) {
          console.error('Error refreshing cart pricing:', error);
          set({ 
            pricingError: error instanceof Error ? error.message : 'Failed to update prices',
            isPricingLoading: false 
          });
        }
      },

      addToCart: async (item) => {
        const state = get();
        const incomingCode = item.item_code || item.id;
        const customerId = state.selectedCustomer?.id;
        const existingItem = state.cartItems.find((cartItem) =>
          cartItem.id === item.id || (cartItem.item_code || cartItem.id) === incomingCode
        );
        const totalMatchingQty = state.cartItems
          .filter((cartItem) => (cartItem.item_code || cartItem.id) === incomingCode)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

        if (item.available !== undefined && item.available <= 0) {
          toast.error(`${item.name} is out of stock`);
          return;
        }

        if (existingItem) {
          if (item.available !== undefined && totalMatchingQty >= item.available) {
            toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
            return;
          }

          const targetId = existingItem.id;
          const updatedQty = existingItem.quantity + 1;
          const taxDetails = await fetchItemTaxDetails(
            incomingCode,
            customerId,
            updatedQty,
            existingItem.uom || item.uom,
          );

          set((state) => ({
            cartItems: state.cartItems.map((cartItem) =>
              cartItem.id === targetId
                ? {
                    ...cartItem,
                    quantity: updatedQty,
                    item_tax_template: taxDetails.item_tax_template,
                    item_tax_rate: taxDetails.item_tax_rate,
                    tax_templates: taxDetails.tax_templates,
                    total_tax_rate: taxDetails.total_tax_rate,
                  }
                : cartItem
            )
          }));
        } else {
          const taxDetails = await fetchItemTaxDetails(
            incomingCode,
            customerId,
            1,
            item.uom,
          );

          const newItem = {
            ...item, 
            quantity: 1,
            bundle_entries: [],
            item_tax_template: taxDetails.item_tax_template,
            item_tax_rate: taxDetails.item_tax_rate,
            tax_templates: taxDetails.tax_templates,
            total_tax_rate: taxDetails.total_tax_rate,
          };
          const newCartItems = shouldInsertNewItemsAtTop()
            ? [newItem, ...state.cartItems]
            : [...state.cartItems, newItem];
          set({ cartItems: newCartItems });
        }

        await get().refreshCartPricing();
      },

      addToCartWithQuantity: async (item, quantity) => {
        const state = get();
        const incomingCode = item.item_code || item.id;
        const customerId = state.selectedCustomer?.id;
        const existingItem = state.cartItems.find((cartItem) =>
          cartItem.id === item.id || (cartItem.item_code || cartItem.id) === incomingCode
        );
        const totalMatchingQty = state.cartItems
          .filter((cartItem) => (cartItem.item_code || cartItem.id) === incomingCode)
          .reduce((sum, cartItem) => sum + cartItem.quantity, 0);

        if (item.available !== undefined && item.available < quantity) {
          toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
          return;
        }

        if (existingItem) {
          if (item.available !== undefined && (totalMatchingQty + quantity) > item.available) {
            toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
            return;
          }

          const targetId = existingItem.id;
          const updatedQty = existingItem.quantity + quantity;
          const taxDetails = await fetchItemTaxDetails(
            incomingCode,
            customerId,
            updatedQty,
            existingItem.uom || item.uom,
          );

          set((state) => ({
            cartItems: state.cartItems.map((cartItem) =>
              cartItem.id === targetId
                ? {
                    ...cartItem,
                    quantity: updatedQty,
                    item_tax_template: taxDetails.item_tax_template,
                    item_tax_rate: taxDetails.item_tax_rate,
                    tax_templates: taxDetails.tax_templates,
                    total_tax_rate: taxDetails.total_tax_rate,
                  }
                : cartItem
            )
          }));
        } else {
          const taxDetails = await fetchItemTaxDetails(
            incomingCode,
            customerId,
            quantity,
            item.uom,
          );

          const newItem = {
            ...item, 
            quantity,
            bundle_entries: [],
            item_tax_template: taxDetails.item_tax_template,
            item_tax_rate: taxDetails.item_tax_rate,
            tax_templates: taxDetails.tax_templates,
            total_tax_rate: taxDetails.total_tax_rate,
          };
          const newCartItems = shouldInsertNewItemsAtTop()
            ? [newItem, ...state.cartItems]
            : [...state.cartItems, newItem];
          set({ cartItems: newCartItems });
        }

        await get().refreshCartPricing();
      },

      updateQuantity: async (id, quantity) => {
        const state = get();
        if (quantity <= 0) {
          set({
            cartItems: state.cartItems.filter((item) => item.id !== id)
          });
          await get().refreshCartPricing();
          return;
        }

        const item = state.cartItems.find((cartItem) => cartItem.id === id);
        if (item && item.available !== undefined && quantity > item.available) {
          toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
          return;
        }

        set({
          cartItems: state.cartItems.map((item) =>
            item.id === id ? { ...item, quantity } : item
          )
        });

        await get().refreshCartPricing();
      },

      updateUOM: async (id, uom, price) => {
        set((state) => ({
          cartItems: state.cartItems.map((item) => {
            if (item.id === id) {
              return { ...item, uom, price };
            }
            return item;
          })
        }));
        await get().refreshCartPricing();
      },

      removeItem: (id) => {
        set((state) => ({
          cartItems: state.cartItems.filter((item) => item.id !== id)
        }));
        get().refreshCartPricing();
      },

      clearCart: () => {
        clearDraftInvoiceCache();
        set(() => ({
          cartItems: [],
          appliedCoupons: [],
          selectedCustomer: null
        }));
      },

      applyCoupon: (coupon) => set((state) => {
        if (!state.appliedCoupons.some((c) => c.code === coupon.code)) {
          return {
            appliedCoupons: [...state.appliedCoupons, coupon]
          }
        }
        return state
      }),

      removeCoupon: (couponCode) => set((state) => ({
        appliedCoupons: state.appliedCoupons.filter((coupon) => coupon.code !== couponCode)
      })),

      setSelectedCustomer: async (customer) => {
        set({ selectedCustomer: customer });
        const state = get();
        if (state.cartItems.length > 0) {
          await state.refreshCartPricing();
        }
      },

      updateItemBundleEntries: (id: string, entries: SerialBatchEntry[]) => {
        set((state) => ({
          cartItems: state.cartItems.map((item) =>
            item.id === id
              ? { ...item, bundle_entries: entries }
              : item
          )
        }));
      },
    }),
    {
      name: 'beveren-cart-storage'
    }
  )
)