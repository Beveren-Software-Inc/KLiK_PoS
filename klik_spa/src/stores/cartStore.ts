import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, GiftCoupon, Customer } from '../../types'

interface CartState {
  cartItems: CartItem[]
  appliedCoupons: GiftCoupon[]
  selectedCustomer: Customer | null
  
  // Actions
  addToCart: (item: Omit<CartItem, 'quantity'>) => void
  updateQuantity: (id: string, quantity: number) => void
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
        if (existingItem) {
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
        return {
          cartItems: state.cartItems.map((item) =>
            item.id === id ? { ...item, quantity } : item
          )
        }
      }),
      
      removeItem: (id) => set((state) => ({
        cartItems: state.cartItems.filter((item) => item.id !== id)
      })),
      
      clearCart: () => set(() => ({
        cartItems: [],
        appliedCoupons: [],
        selectedCustomer: null
      })),
      
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