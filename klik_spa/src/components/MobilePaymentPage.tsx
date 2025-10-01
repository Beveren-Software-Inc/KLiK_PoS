"use client"

import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import PaymentDialog from "./PaymentDialog"
import BottomNavigation from "./BottomNavigation"
import { useCartStore } from "../stores/cartStore"
import { useProducts } from "../hooks/useProducts"
import { clearDraftInvoiceCache } from "../utils/draftInvoiceCache"

export default function MobilePaymentPage() {
  const navigate = useNavigate()
  const { cartItems, appliedCoupons, selectedCustomer, clearCart } = useCartStore()
  const { refetch: refetchProducts, refreshStockOnly, updateStockForItems, updateBatchQuantitiesForItems } = useProducts();

  const handleClose = async (paymentCompleted?: boolean) => {
    // Only clear cart if payment was completed
    if (paymentCompleted) {
      // console.log("MobilePaymentPage: Payment was completed - clearing cart for next order");
      clearCart();
      // Clear draft invoice cache since payment is completed
      clearDraftInvoiceCache();
    } else {
      console.log("MobilePaymentPage: Payment was not completed - keeping cart items");
    }

    // Simple stock refresh and navigate back
    try {
      await refreshStockOnly();
      console.log("Stock refreshed after payment modal close");

      // Also update batch quantities for items that were in the cart
      const cartItemCodes = cartItems.map(item => item.item_code || item.id);
      if (cartItemCodes.length > 0) {
        console.log("MobilePaymentPage: Updating batch quantities for cart items:", cartItemCodes);
        await updateBatchQuantitiesForItems(cartItemCodes);
        console.log("MobilePaymentPage: Batch quantities updated successfully");
      }
    } catch (error) {
      console.error("Failed to refresh stock:", error);
    }
    navigate(-1)
  }

  const handleCompletePayment = async (paymentData: any) => {
    console.log('Payment completed:', paymentData)
    // Don't clear cart immediately - let user see invoice preview
    // Cart will be cleared when user closes the payment page
    console.log("MobilePaymentPage: Payment completed - cart will be cleared when page is closed");
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
            <img src="/assets/klik_pos/klik_spa/beveren-logo-180.png" alt="KLiK PoS" className="w-8 h-8 rounded-full object-cover" />
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
