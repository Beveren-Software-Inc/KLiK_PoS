"use client"

import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import OrderSummary from "./OrderSummary"
import BottomNavigation from "./BottomNavigation"
import { useCartStore } from "../stores/cartStore"

export default function CartPage() {
  const navigate = useNavigate()
  const {
    cartItems,
    appliedCoupons,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon
  } = useCartStore()

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <img src="/assets/klik_pos/klik_spa/beveren-logo-180.png" alt="KLiK PoS" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-bold text-xl text-gray-900 dark:text-white">Shopping Cart</span>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>

      {/* Cart Content */}
      <div className="flex-1 pb-20">
        <OrderSummary
          cartItems={cartItems}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onClearCart={clearCart}
          appliedCoupons={appliedCoupons}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={removeCoupon}
          isMobile={true}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}
