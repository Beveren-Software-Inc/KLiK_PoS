"use client"

import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import PaymentDialog from "./PaymentDialog"
import BottomNavigation from "./BottomNavigation"
import { useCartStore } from "../stores/cartStore"

export default function MobilePaymentPage() {
  const navigate = useNavigate()
  const { cartItems, appliedCoupons, selectedCustomer, clearCart } = useCartStore()

  const handleClose = () => {
    navigate(-1)
  }

  const handleCompletePayment = (paymentData: any) => {
    console.log('Payment completed:', paymentData)
    clearCart()
    navigate('/pos')
  }

  const handleHoldOrder = (orderData: any) => {
    console.log('Order held:', orderData)
    clearCart()
    navigate('/pos')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
            <img src="/assets/klik_pos/klik_spa/beveren-logo-180.png" alt="KLIK POS" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-bold text-xl text-gray-900 dark:text-white">Payment</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pb-20">
        <PaymentDialog
          isOpen={true}
          onClose={handleClose}
          cartItems={cartItems}
          appliedCoupons={appliedCoupons}
          selectedCustomer={selectedCustomer}
          onCompletePayment={handleCompletePayment}
          onHoldOrder={handleHoldOrder}
          isMobile={true}
          isFullPage={true}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}
