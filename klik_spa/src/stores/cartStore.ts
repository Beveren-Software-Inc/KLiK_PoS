import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, GiftCoupon, Customer } from '../../types'
import { toast } from 'react-toastify'
import { clearDraftInvoiceCache } from '../utils/draftInvoiceCache'
import { updateItemPricesForCustomer, getItemPriceForCustomer } from '../services/dynamicPricing'

interface CartState {
  cartItems: CartItem[]
  appliedCoupons: GiftCoupon[]
  selectedCustomer: Customer | null

  // Actions
  addToCart: (item: Omit<CartItem, 'quantity'>) => Promise<void>
  updateQuantity: (id: string, quantity: number) => void
  updateUOM: (id: string, uom: string, price: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  applyCoupon: (coupon: GiftCoupon) => void
  removeCoupon: (couponCode: string) => void
  setSelectedCustomer: (customer: Customer | null) => void
  updatePricesForCustomer: (customerId?: string) => Promise<void>
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      appliedCoupons: [],
      selectedCustomer: null,

      addToCart: async (item) => {
        const state = get();
        const existingItem = state.cartItems.find((cartItem) => cartItem.id === item.id);

        // Check if item has available quantity
        if (item.available !== undefined && item.available <= 0) {
          toast.error(`${item.name} is out of stock`);
          return;
        }

        if (existingItem) {
          // Check if adding one more would exceed available stock
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
          // New item - fetch correct price if customer is selected
          let finalPrice = item.price;

          if (state.selectedCustomer) {
            try {
              console.log(`🔄 Fetching correct price for ${item.name} with customer: ${state.selectedCustomer.name}`);
              const priceInfo = await getItemPriceForCustomer(item.id, state.selectedCustomer.id);
              if (priceInfo.success) {
                finalPrice = priceInfo.price;
                console.log(`💰 Updated price for ${item.name}: ${item.price} → ${finalPrice}`);
              }
            } catch (error) {
              console.error('❌ Error fetching price for customer:', error);
              // Continue with original price if API fails
            }
          }

          set((state) => ({
            cartItems: [...state.cartItems, { ...item, price: finalPrice, quantity: 1 }]
          }));
        }
      },

      updateQuantity: (id, quantity) => set((state) => {
        if (quantity <= 0) {
          return {
            cartItems: state.cartItems.filter((item) => item.id !== id)
          }
        }

        const item = state.cartItems.find((cartItem) => cartItem.id === id)
        if (item && item.available !== undefined && quantity > item.available) {
          toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`)
          return state
        }

        return {
          cartItems: state.cartItems.map((item) =>
            item.id === id ? { ...item, quantity } : item
          )
        }
      }),

      updateUOM: (id, uom, price) => {
        console.log(`🏪 Cart Store: Updating UOM for item ${id} to ${uom} with price ${price}`);
        set((state) => {
          const updatedItems = state.cartItems.map((item) => {
            if (item.id === id) {
              console.log(`🏪 Cart Store: Item ${id} updated:`, {
                before: { uom: item.uom, price: item.price },
                after: { uom, price }
              });
              return { ...item, uom, price };
            }
            return item;
          });
          console.log(`🏪 Cart Store: All items after update:`, updatedItems);
          return { cartItems: updatedItems };
        });
      },

      removeItem: (id) => set((state) => ({
        cartItems: state.cartItems.filter((item) => item.id !== id)
      })),

      clearCart: () => {
        // Clear draft invoice cache when clearing cart
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

      setSelectedCustomer: (customer) => set(() => ({
        selectedCustomer: customer
      })),

      updatePricesForCustomer: async (customerId) => {
        const state = get();
        if (state.cartItems.length === 0) return;

        try {
          console.log(`🔄 Updating prices for ${state.cartItems.length} items with customer: ${customerId || 'None'}`);

          // Get updated prices for all items
          const priceUpdates = await updateItemPricesForCustomer(state.cartItems, customerId);

          // Update cart items with new prices
          set((state) => ({
            cartItems: state.cartItems.map(item => {
              const priceUpdate = priceUpdates[item.id];
              if (priceUpdate && priceUpdate.success) {
                console.log(`💰 Updated price for ${item.name}: ${item.price} → ${priceUpdate.price}`);
                return { ...item, price: priceUpdate.price };
              }
              return item;
            })
          }));

        } catch (error) {
          console.error('❌ Error updating prices for customer:', error);
          toast.error('Failed to update prices for customer');
        }
      }
    }),
    {
      name: 'beveren-cart-storage'
    }
  )
)
