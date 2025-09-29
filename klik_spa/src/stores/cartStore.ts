import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, GiftCoupon, Customer } from '../../types'
import { toast } from 'react-toastify'
import { clearDraftInvoiceCache } from '../utils/draftInvoiceCache'

interface CartState {
  cartItems: CartItem[]
  appliedCoupons: GiftCoupon[]
  selectedCustomer: Customer | null

  // Actions
  addToCart: (item: Omit<CartItem, 'quantity'>) => void
  updateQuantity: (id: string, quantity: number) => void
  updateUOM: (id: string, uom: string, price: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  applyCoupon: (coupon: GiftCoupon) => void
  removeCoupon: (couponCode: string) => void
  setSelectedCustomer: (customer: Customer | null) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],
      appliedCoupons: [],
      selectedCustomer: null,

      addToCart: (item) => set((state) => {
        const existingItem = state.cartItems.find((cartItem) => cartItem.id === item.id)

        // Check if item has available quantity
        if (item.available !== undefined && item.available <= 0) {
          toast.error(`${item.name} is out of stock`)
          return state
        }

        if (existingItem) {
          // Check if adding one more would exceed available stock
          if (item.available !== undefined && existingItem.quantity >= item.available) {
            toast.error(`Only ${item.available} ${item.uom || 'units'} of ${item.name} available`)
            return state
          }

          return {
            cartItems: state.cartItems.map((cartItem) =>
              cartItem.id === item.id
                ? { ...cartItem, quantity: cartItem.quantity + 1 }
                : cartItem
            )
          }
        } else {
          return {
            cartItems: [...state.cartItems, { ...item, quantity: 1 }]
          }
        }
      }),

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
        console.log(`Cart Store: Updating UOM for item ${id} to ${uom} with price ${price}`);
        set((state) => {
          const updatedItems = state.cartItems.map((item) =>
            item.id === id ? { ...item, uom, price } : item
          );
          console.log(`Cart Store: Updated items:`, updatedItems);
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
      }))
    }),
    {
      name: 'beveren-cart-storage'
    }
  )
)
