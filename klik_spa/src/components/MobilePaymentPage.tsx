"use client"

import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import PaymentDialog from "./PaymentDialog"
import BottomNavigation from "./BottomNavigation"
import { useCartStore } from "../stores/cartStore"
import { useProducts } from "../hooks/useProducts"

export default function MobilePaymentPage() {
  const navigate = useNavigate()
  const { cartItems, appliedCoupons, selectedCustomer, clearCart } = useCartStore()
  const { refetch: refetchProducts, updateStockForItems } = useProducts();

  const handleClose = async () => {
    // Silently refresh products to update stock availability
    try {
      await refetchProducts();
      console.log("Products refreshed after payment modal close");
    } catch (error) {
      console.error("Failed to refresh products:", error);
      // Don't show error to user as this is a background operation
    }
    navigate(-1)
  }

  const handleCompletePayment = async (paymentData: any) => {
    console.log('Payment completed:', paymentData)

    // Efficiently update stock only for sold items instead of reloading all products
    try {
      const soldItemCodes = cartItems.map(item => item.id);
      console.log("MobilePaymentPage: Updating stock for sold items:", soldItemCodes);
      await updateStockForItems(soldItemCodes);
      console.log("MobilePaymentPage: Stock updated successfully for sold items");
    } catch (error) {
      console.error("MobilePaymentPage: Failed to update stock for sold items:", error);
      // Fallback to full refresh if specific update fails
      try {
        console.log("MobilePaymentPage: Falling back to full product refresh...");
        await refetchProducts();
        console.log("MobilePaymentPage: Full product refresh completed");
      } catch (fallbackError) {
        console.error("MobilePaymentPage: Full refresh also failed:", fallbackError);
      }
    }

    clearCart()
    // Navigate after stock refresh is complete
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
