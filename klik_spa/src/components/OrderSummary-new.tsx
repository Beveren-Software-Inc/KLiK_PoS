"use client"

import { useState } from "react"
import { Minus, Plus, CreditCard, X, Tag, Search, UserPlus, User, Building } from "lucide-react"
import type { CartItem, GiftCoupon } from "../../types"
import GiftCouponSelector from "./GiftCouponSelector"
import { mockCustomers, type Customer } from "../data/mockCustomers"
import AddCustomerModal from "./AddCustomerModal"

interface OrderSummaryProps {
  cartItems: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  appliedCoupons: GiftCoupon[]
  onApplyCoupon: (coupon: GiftCoupon) => void
  onRemoveCoupon: (couponCode: string) => void
  isMobile?: boolean
}

export default function OrderSummary({
  cartItems,
  onUpdateQuantity,
  appliedCoupons,
  onApplyCoupon,
  onRemoveCoupon,
  isMobile = false,
}: OrderSummaryProps) {
  const [selectedPayment, setSelectedPayment] = useState("cash")
  const [showCouponSelector, setShowCouponSelector] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  // Calculate coupon discount
  const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)

  // Calculate tax after coupon discount
  const taxableAmount = Math.max(0, subtotal - couponDiscount)
  const tax = taxableAmount * 0.15
  const total = taxableAmount + tax

  // Filtered customers based on search query
  const filteredCustomers = mockCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    customer.phone.includes(customerSearchQuery) ||
    customer.tags.some(tag => tag.toLowerCase().includes(customerSearchQuery.toLowerCase()))
  )

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearchQuery(customer.name)
    setShowCustomerDropdown(false)
  }

  const handleSaveCustomer = (newCustomer: Partial<Customer>) => {
    // In a real app, this would save to the backend
    console.log('Saving new customer:', newCustomer)
    setShowAddCustomerModal(false)
    // For now, we'll just close the modal
  }

  const getCustomerTypeIcon = (customer: Customer) => {
    switch (customer.type) {
      case 'company':
        return <Building size={14} className="text-purple-600" />
      case 'walk-in':
        return <User size={14} className="text-gray-600" />
      default:
        return <User size={14} className="text-blue-600" />
    }
  }

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-gray-800 ${!isMobile ? "border-l" : ""} border-gray-200 dark:border-gray-700`}
    >
      {/* Header */}
      {!isMobile && (
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold font-medium text-gray-900 dark:text-white mb-3">Shopping Cart</h2>
          
          {/* Customer Search */}
          <div className="relative">
            <div className="flex items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value)
                    setShowCustomerDropdown(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowCustomerDropdown(customerSearchQuery.length > 0)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                
                {/* Customer Dropdown */}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {filteredCustomers.slice(0, 8).map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex items-center space-x-2">
                          {getCustomerTypeIcon(customer)}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {customer.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {customer.email} • {customer.phone}
                            </div>
                          </div>
                          {customer.status === 'vip' && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded">
                              VIP
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="ml-2 p-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
                title="Add New Customer"
              >
                <UserPlus size={16} />
              </button>
            </div>
            
            {/* Selected Customer Display */}
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getCustomerTypeIcon(selectedCustomer)}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedCustomer.loyaltyPoints} points • {selectedCustomer.totalOrders} orders
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null)
                      setCustomerSearchQuery("")
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Customer Search */}
      {isMobile && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers..."
                value={customerSearchQuery}
                onChange={(e) => {
                  setCustomerSearchQuery(e.target.value)
                  setShowCustomerDropdown(e.target.value.length > 0)
                }}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="p-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
            >
              <UserPlus size={16} />
            </button>
          </div>
          
          {selectedCustomer && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getCustomerTypeIcon(selectedCustomer)}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {selectedCustomer.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedCustomer.loyaltyPoints} points
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null)
                    setCustomerSearchQuery("")
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "p-4" : "p-6"} cart-scroll`}>
        <div className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your cart is empty</h3>
              <p className="text-gray-500 dark:text-gray-400">Add some items to get started!</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center space-x-3 ${isMobile ? "bg-gray-50 dark:bg-gray-700 p-3 rounded-lg" : ""}`}
              >
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  className={`${isMobile ? "w-16 h-16" : "w-12 h-12"} rounded-lg object-cover`}
                  crossOrigin="anonymous"
                />
                <div className="flex-1">
                  <h4 className={`font-semibold text-gray-900 dark:text-white ${isMobile ? "text-base" : "text-sm"}`}>
                    {item.name}
                  </h4>
                  <p
                    className={`text-gray-500 dark:text-gray-400 capitalize font-medium ${isMobile ? "text-sm" : "text-xs"}`}
                  >
                    {item.category}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    className={`${isMobile ? "w-8 h-8" : "w-6 h-6"} rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600`}
                  >
                    <Minus size={isMobile ? 16 : 12} className="text-gray-600 dark:text-gray-400" />
                  </button>
                  <span
                    className={`${isMobile ? "w-10" : "w-8"} text-center font-semibold text-gray-900 dark:text-white`}
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className={`${isMobile ? "w-8 h-8" : "w-6 h-6"} rounded-full bg-beveren-600 text-white flex items-center justify-center hover:bg-beveren-700`}
                  >
                    <Plus size={isMobile ? 16 : 12} />
                  </button>
                </div>
                <div className="text-right">
                  <p
                    className={`text-beveren-600 dark:text-beveren-400 font-semibold ${isMobile ? "text-base" : "text-sm"}`}
                  >
                    {item.quantity} x ${item.price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      {cartItems.length > 0 && (
        <div className={`${isMobile ? "p-4" : "p-6"} border-t border-gray-100 dark:border-gray-700 space-y-4`}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Items</span>
              <span className="font-semibold text-gray-900 dark:text-white">{cartItems.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Subtotal</span>
              <span className="font-semibold text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
            </div>

            {/* Gift Coupons */}
            {appliedCoupons.length > 0 && (
              <div className="space-y-2">
                {appliedCoupons.map((coupon) => (
                  <div key={coupon.code} className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span className="font-medium flex items-center">
                      <Tag size={14} className="mr-1" />
                      {coupon.code}
                      <button
                        onClick={() => onRemoveCoupon(coupon.code)}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </span>
                    <span className="font-semibold">-${coupon.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gift Coupon Button */}
            <button
              onClick={() => setShowCouponSelector(true)}
              className="w-full py-2 px-3 text-sm border-2 border-dashed border-beveren-300 dark:border-beveren-600 rounded-xl text-beveren-600 dark:text-beveren-400 hover:bg-beveren-50 dark:hover:bg-beveren-900/20 transition-colors font-medium flex items-center justify-center"
            >
              <Tag size={16} className="mr-2" />
              Add Gift Coupon
            </button>

            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Tax (15%)</span>
              <span className="font-semibold text-gray-900 dark:text-white">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Payment Method</h3>
            <div className={`grid ${isMobile ? "grid-cols-1 gap-2" : "grid-cols-2 gap-3"}`}>
              <button
                onClick={() => setSelectedPayment("cash")}
                className={`p-3 rounded-xl border-2 text-center transition-colors ${
                  selectedPayment === "cash"
                    ? "border-beveren-600 bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                <div className="text-2xl mb-1">💵</div>
                <div className="text-xs font-semibold">Cash</div>
              </button>
              <button
                onClick={() => setSelectedPayment("debit")}
                className={`p-3 rounded-xl border-2 text-center transition-colors ${
                  selectedPayment === "debit"
                    ? "border-beveren-600 bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                }`}
              >
                <CreditCard className="mx-auto mb-1 text-gray-600 dark:text-gray-400" size={20} />
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Debit</div>
              </button>
            </div>
          </div>

          {/* Pay Button */}
          <button
            className={`w-full bg-beveren-600 text-white rounded-2xl font-semibold hover:bg-beveren-700 transition-colors ${isMobile ? "py-4 text-lg" : "py-4"}`}
          >
            Pay ${total.toFixed(2)}
          </button>
        </div>
      )}

      {/* Gift Coupon Selector Modal */}
      {showCouponSelector && (
        <GiftCouponSelector
          onClose={() => setShowCouponSelector(false)}
          onApplyCoupon={onApplyCoupon}
          appliedCoupons={appliedCoupons}
        />
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSave={handleSaveCustomer}
        />
      )}
    </div>
  )
}
