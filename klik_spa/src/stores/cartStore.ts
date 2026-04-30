// stores/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, GiftCoupon } from '../../types'
import type { Customer } from '../types/customer'
import { toast } from 'react-toastify'
import { clearDraftInvoiceCache } from '../utils/draftInvoiceCache'

interface SerialBatchEntry {
  serial_no?: string;
  batch_no?: string;
  qty?: number;
}

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
                const pricedItem = pricingData.items.find((p: any) => 
                  (p.id === item.id) || (p.item_code === (item.item_code || item.id))
                );
                if (pricedItem) {
                  return {
                    ...item,
                    price: pricedItem.price,
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
        const existingItem = state.cartItems.find((cartItem) => cartItem.id === item.id);

        if (item.available !== undefined && item.available <= 0) {
          toast.error(`${item.name} is out of stock`);
          return;
        }

        if (existingItem) {
          if (item.available !== undefined && existingItem.quantity >= item.available) {
            toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
            return;
          }

          set((state) => ({
            cartItems: state.cartItems.map((cartItem) =>
              cartItem.id === item.id
                ? { ...cartItem, quantity: cartItem.quantity + 1 }
                : cartItem
            )
          }));
        } else {
          const newCartItems = [...state.cartItems, { 
            ...item, 
            quantity: 1,
            bundle_entries: []
          }];
          set({ cartItems: newCartItems });
        }

        await get().refreshCartPricing();
      },

      addToCartWithQuantity: async (item, quantity) => {
        const state = get();
        const existingItem = state.cartItems.find((cartItem) => cartItem.id === item.id);

        if (item.available !== undefined && item.available < quantity) {
          toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
          return;
        }

        if (existingItem) {
          if (item.available !== undefined && (existingItem.quantity + quantity) > item.available) {
            toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`);
            return;
          }

          set((state) => ({
            cartItems: state.cartItems.map((cartItem) =>
              cartItem.id === item.id
                ? { ...cartItem, quantity: cartItem.quantity + quantity }
                : cartItem
            )
          }));
        } else {
          const newCartItems = [...state.cartItems, { 
            ...item, 
            quantity,
            bundle_entries: []
          }];
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