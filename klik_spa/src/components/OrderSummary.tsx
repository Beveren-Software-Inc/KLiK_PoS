"use client"

import { useState, useRef, useEffect } from "react"
import { Minus, Plus, X, Tag, Search, UserPlus, User, Building } from "lucide-react"
import type { CartItem, GiftCoupon } from "../../types"
import GiftCouponPopover from "./GiftCouponPopover"
import PaymentDialog from "./PaymentDialog"
// import { mockCustomers, type Customer } from "../data/mockCustomers"
import AddCustomerModal from "./AddCustomerModal"
import { createDraftSalesInvoice } from "../services/salesInvoice"
import { useCustomers } from "../hooks/useCustomers"
import { toast } from "react-toastify"
import { useBatchData } from "../hooks/useProducts"
import { getBatches } from "../utils/batch"; // or wherever you put it
import { useNavigate } from "react-router-dom"


// Extended CartItem interface to include discount properties
interface ExtendedCartItem extends CartItem {
  discountPercentage?: number;
  discountAmount?: number;
  batchNumber?: string;
  serialNumber?: string;
  availableQuantity?: number;
}

interface OrderSummaryProps {
  cartItems: CartItem[]
  onUpdateQuantity: (id: string, quantity: number) => void
  onRemoveItem?: (id: string) => void
  onClearCart?: () => void
  appliedCoupons: GiftCoupon[]
  onApplyCoupon: (coupon: GiftCoupon) => void
  onRemoveCoupon: (couponCode: string) => void
  isMobile?: boolean
}

export default function OrderSummary({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  appliedCoupons,
  onApplyCoupon,
  onRemoveCoupon,
  isMobile = false,
}: OrderSummaryProps) {
  const [showCouponPopover, setShowCouponPopover] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const couponButtonRef = useRef<HTMLButtonElement>(null)
  const { customers, isLoading, error } = useCustomers()
  const navigate = useNavigate()

  
  // State for item-level discounts and details
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, {
    discountPercentage: number;
    discountAmount: number;
    batchNumber: string;
    serialNumber: string;
    availableQuantity: number;
  }>>({})
// const { getBatches } = useBatchData();

const [itemBatches, setItemBatches] = useState<Record<string, { batch_no: string; qty: number }[]>>({});

  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Helper function to calculate item price after discount
  const getDiscountedPrice = (item: CartItem) => {
    const itemDiscount = itemDiscounts[item.id] || { discountPercentage: 0, discountAmount: 0 }
    let discountedPrice = item.price

    // Apply percentage discount first
    if (itemDiscount.discountPercentage > 0) {
      discountedPrice = item.price * (1 - itemDiscount.discountPercentage / 100)
    }

    // Then apply fixed amount discount
    if (itemDiscount.discountAmount > 0) {
      discountedPrice = Math.max(0, discountedPrice - itemDiscount.discountAmount)
    }

    return Math.max(0, discountedPrice) // Ensure price doesn't go negative
  }

  // Calculate subtotal with item-level discounts
  const subtotal = cartItems.reduce((sum, item) => {
    const discountedPrice = getDiscountedPrice(item)
    return sum + discountedPrice * item.quantity
  }, 0)

  // Calculate total discount amount for display
  const totalItemDiscount = cartItems.reduce((sum, item) => {
    const originalAmount = item.price * item.quantity
    const discountedAmount = getDiscountedPrice(item) * item.quantity
    return sum + (originalAmount - discountedAmount)
  }, 0)

  // Calculate coupon discount
  const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)

  // Calculate final total
  const total = Math.max(0, subtotal - couponDiscount)

  // Function to update item discount
  const updateItemDiscount = (itemId: string, field: string, value: number | string) => {
    setItemDiscounts(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId] || { discountPercentage: 0, discountAmount: 0, batchNumber: '', serialNumber: '', availableQuantity: 150 },
        [field]: typeof value === 'string' ? value : Math.max(0, value)
      }
    }))
  }

  // Filtered customers based on search query
  const filteredCustomers = customerSearchQuery.trim() === ""
    ? customers
    : customers.filter((customer) =>
        customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.phone.includes(customerSearchQuery) ||
        customer.tags.some(tag => tag.toLowerCase().includes(customerSearchQuery.toLowerCase()))
      )

  const validateCustomer = () => {
    if (!selectedCustomer) {
      toast.error("Kindly choose customer")
      return false;
    }
    return true
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearchQuery(customer.name)
    setShowCustomerDropdown(false)
  }

  const handleSaveCustomer = (newCustomer: Partial<Customer>) => {
    console.log('Saving new customer:', newCustomer)
    setShowAddCustomerModal(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCompletePayment = (paymentData: any) => {
    // In a real app, this would process the payment and create invoice
    console.log('Processing payment:', paymentData)
    setShowPaymentDialog(false)
    handleClearCart()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleHoldOrder = (orderData: any) => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer")
      return;
    }
    // Creates a draft invoice and saves the order
    console.log('Creating draft invoice:', orderData)
    setShowPaymentDialog(false)
    createDraftSalesInvoice(orderData)
    handleClearCart()
    toast.success('Draft invoice created and order held successfully!')
  }

  const handleClearCart = () => {
    // Handle clearing the cart - remove all items immediately
    if (cartItems.length === 0) return
    
    // Use dedicated clear function if available
    if (onClearCart) {
      onClearCart()
    } else {
      // Fallback: create a copy of the array to avoid mutation during iteration
      const itemsToRemove = [...cartItems]
      itemsToRemove.forEach(item => {
        if (onRemoveItem) {
          onRemoveItem(item.id)
        }
      })
    }
    
    // Clear applied coupons
    appliedCoupons.forEach(coupon => {
      onRemoveCoupon(coupon.code)
    })
    
    // Clear item discounts
    setItemDiscounts({})
    
    // Reset customer selection
    setSelectedCustomer(null)
    setCustomerSearchQuery("")
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

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

useEffect(() => {
  // Auto-select customer if there's only one customer and none is currently selected
  if (customers.length === 1 && !selectedCustomer && !isLoading) {
    const singleCustomer = customers[0];
    setSelectedCustomer(singleCustomer);
    setCustomerSearchQuery(singleCustomer.name);
    setShowCustomerDropdown(false);
    
    // // Optional: Show a toast notification
    // toast.info(`Automatically selected customer: ${singleCustomer.name}`);
  }
}, [customers, selectedCustomer, isLoading]);

useEffect(() => {
  const fetchAndSetBatches = async () => {
    const newBatches = { ...itemBatches };

    for (const item of cartItems) {
      const key = `${item.item_code}`;
      if (!newBatches[key]) {
        try {
          const batches = await getBatches(item.id);
          if (Array.isArray(batches)) {
            newBatches[key] = batches;
          }
        } catch (err) {
          console.error("Error fetching batches", err);
        }
      }
    }

    setItemBatches(newBatches);
  };

  if (cartItems.length) {
    fetchAndSetBatches();
  }
}, [cartItems]);



  return (
    <div
      className={`${isMobile ? "h-full flex flex-col" : "h-full flex flex-col"} bg-white dark:bg-gray-800 ${!isMobile ? "border-l" : ""} border-gray-200 dark:border-gray-700`}
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
                  onFocus={() => setShowCustomerDropdown(true)}
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
          <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search customers..." // Fixed typo: "customeer" -> "customers"
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value)
                    setShowCustomerDropdown(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                
                {/* ADD THIS MISSING DROPDOWN - This was missing in mobile version */}
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

      {/* Cart Items - Scrollable on Mobile */}
      <div className={`${isMobile ? "flex-1 overflow-y-auto custom-scrollbar p-4" : "flex-1 overflow-y-auto p-6 cart-scroll"}`}>
        <div className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your cart is empty</h3>
              <p className="text-gray-500 dark:text-gray-400">Add some items to get started!</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const discountedPrice = getDiscountedPrice(item)
              const originalTotal = item.price * item.quantity
              const discountedTotal = discountedPrice * item.quantity
              const itemDiscount = itemDiscounts[item.id] || { discountPercentage: 0, discountAmount: 0, batchNumber: '', serialNumber: '', availableQuantity: 150 }
              
              return (
                <div key={item.id} className={`${isMobile ? "bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden" : ""}`}>
                  {/* Main item row */}
                  <div className={`flex items-center ${isMobile ? "p-3" : "py-2"}`}>
                    {/* Expand/Collapse Arrow */}
                    <div className="flex-shrink-0 mr-2">
                      <button
                        onClick={() => toggleItemExpansion(item.id)}
                        className={`${isMobile ? "w-5 h-5" : "w-5 h-5"} rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200`}
                        title="Show/Hide Details"
                      >
                        <svg 
                          className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} text-beveren-500 dark:text-gray-400 transform transition-transform duration-200 ${
                            expandedItems.has(item.id) ? 'rotate-90' : ''
                          }`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        className={`${isMobile ? "w-16 h-16" : "w-12 h-12"} rounded-lg object-cover`}
                        crossOrigin="anonymous"
                      />
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0 px-3">
                      <h4 className={`font-semibold text-gray-900 dark:text-white ${isMobile ? "text-base" : "text-sm"} truncate`}>
                        {item.name}
                      </h4>
                      <p className={`text-gray-500 dark:text-gray-400 capitalize font-medium ${isMobile ? "text-sm" : "text-xs"}`}>
                        {item.category}
                      </p>
                      <div className={`${isMobile ? "text-base" : "text-sm"}`}>
                        {discountedPrice < item.price ? (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 line-through text-xs">
                              ${item.price.toFixed(2)}
                            </span>
                            <span className="text-beveren-600 dark:text-beveren-400 font-semibold">
                              ${discountedPrice.toFixed(2)} each
                            </span>
                          </div>
                        ) : (
                          <div className="text-beveren-600 dark:text-beveren-400 font-semibold">
                            ${item.price.toFixed(2)} each
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Quantity Controls - Fixed Width Container */}
                    <div className="flex-shrink-0 flex items-center ml-10 space-x-1 min-w-[70px] justify-center">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className={`${isMobile ? "w-8 h-8" : "w-5 h-5"} rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors`}
                      >
                        <Minus size={isMobile ? 16 : 14} className="text-gray-600 dark:text-gray-400" />
                      </button>
                      <span className={`${isMobile ? "w-10" : "w-8"} text-center font-semibold text-gray-900 dark:text-white text-sm`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className={`${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-full bg-beveren-600 text-white flex items-center justify-center hover:bg-beveren-700 transition-colors`}
                      >
                        <Plus size={isMobile ? 16 : 14} />
                      </button>
                    </div>
                    
                    {/* Total Price - Fixed Width */}
                    <div className="flex-shrink-0 text-right min-w-[80px] px-2">
                      {discountedTotal < originalTotal ? (
                        <div>
                          <p className="text-gray-400 line-through text-xs">
                            ${originalTotal.toFixed(2)}
                          </p>
                          <p className={`text-beveren-600 dark:text-beveren-400 font-semibold ${isMobile ? "text-base" : "text-sm"}`}>
                            ${discountedTotal.toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className={`text-beveren-600 dark:text-beveren-400 font-semibold ${isMobile ? "text-base" : "text-sm"}`}>
                          ${discountedTotal.toFixed(2)}
                        </p>
                      )}
                    </div>
                    
                    {/* Remove Button */}
                    <div className="flex-shrink-0 ml-2">
                      <button
                        onClick={() => onRemoveItem ? onRemoveItem(item.id) : onUpdateQuantity(item.id, 0)}
                        className={`${isMobile ? "w-8 h-8" : "w-6 h-6"} rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors`}
                        title="Remove item"
                      >
                        <X size={isMobile ? 16 : 12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  {expandedItems.has(item.id) && (
                    <div className={`border-t border-gray-200 dark:border-gray-600 ${isMobile ? "px-3 pb-3" : "px-6 py-3 ml-7"} bg-gray-25 dark:bg-gray-750`}>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Left Column */}
                        <div className="space-y-3">
                          {/* Quantity Field */}
                          <div>
                            <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-xs" : "text-xs"} mb-1`}>
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                              className={`w-full ${isMobile ? "text-sm" : "text-xs"} px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                          </div>

                          {/* Discount Percentage */}
                          <div>
                            <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-xs" : "text-xs"} mb-1`}>
                              Discount (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={itemDiscount.discountPercentage || ''}
                              onChange={(e) => updateItemDiscount(item.id, 'discountPercentage', parseFloat(e.target.value) || 0)}
                              placeholder="0.0"
                              className={`w-full ${isMobile ? "text-sm" : "text-xs"} px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                          </div>

                          {/* Batch Number */}
        <select
                value={itemDiscount.batchNumber || ''}
                onChange={(e) => {
                  const selectedBatch = e.target.value;
                  const selectedQty = itemBatches[item.item_code]?.find(b => b.batch_no === selectedBatch)?.qty || 0;
                  updateItemDiscount(item.id, 'batchNumber', selectedBatch);
                  updateItemDiscount(item.id, 'availableQuantity', selectedQty);
                }}
                className={`w-full ${isMobile ? "text-sm" : "text-xs"} px-2 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent 
                  bg-white text-gray-900 appearance-none`} // Removed dark mode classes
                style={{
                  backgroundColor: 'white',
                  color: '#111827', // Tailwind's gray-900
                }}
              >
            <option value="" disabled></option>
                {itemBatches[item.item_code]?.map((batch) => (
                  <option
                    key={batch.batch_no}
                    value={batch.batch_no}
                    style={{ backgroundColor: 'white', color: '#111827' }}
                  >
                    {batch.batch_id} - {batch.qty}
              </option>
                ))}
              </select>

                        </div>

                        {/* Right Column */}
                        <div className="space-y-3">
                          {/* Discount Amount */}
                          <div>
                            <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-xs" : "text-xs"} mb-1`}>
                              Discount Amount ($)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={itemDiscount.discountAmount || ''}
                              onChange={(e) => updateItemDiscount(item.id, 'discountAmount', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className={`w-full ${isMobile ? "text-sm" : "text-xs"} px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                          </div>

                          {/* Serial Number */}
                          <div>
                            <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-xs" : "text-xs"} mb-1`}>
                              Serial No.
                            </label>
                            <input
                              type="text"
                              value={itemDiscount.serialNumber || ''}
                              onChange={(e) => updateItemDiscount(item.id, 'serialNumber', e.target.value)}
                              placeholder="Enter serial number"
                              className={`w-full ${isMobile ? "text-sm" : "text-xs"} px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                          </div>

                        </div>
                      </div>

                      {/* Discount Summary */}
                      {(itemDiscount.discountPercentage > 0 || itemDiscount.discountAmount > 0) && (
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                          <div className="text-xs text-green-800 dark:text-green-300 font-medium">
                            Discount Applied:
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-green-700 dark:text-green-400">
                              {itemDiscount.discountPercentage > 0 && `${itemDiscount.discountPercentage}% off`}
                              {itemDiscount.discountPercentage > 0 && itemDiscount.discountAmount > 0 && ' + '}
                              {itemDiscount.discountAmount > 0 && `${itemDiscount.discountAmount.toFixed(2)} off`}
                            </span>
                            <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                              Save ${(originalTotal - discountedTotal).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Optional: Action buttons for the expanded section */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-2">
                        <button
                          onClick={() => toggleItemExpansion(item.id)}
                          className={`px-3 py-1 ${isMobile ? "text-sm" : "text-xs"} text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium`}
                        >
                          Collapse
                        </button>
                        <button
                          onClick={() => {
                            // Optional: Add validation or processing logic here
                            toast.success('Item details updated successfully!')
                          }}
                          className={`px-3 py-1 ${isMobile ? "text-sm" : "text-xs"} bg-beveren-600 text-white rounded-md hover:bg-beveren-700 transition-colors font-medium`}
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Summary - Always Visible at Bottom on Mobile */}
      {cartItems.length > 0 && (
        <div className={`${isMobile ? "flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg" : "p-6 border-t border-gray-100 dark:border-gray-700"} space-y-4`}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Items</span>
              <span className="font-semibold text-gray-900 dark:text-white">{cartItems.length}</span>
            </div>
            
            {/* Original Subtotal (before item discounts) */}
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">Original Subtotal</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ${cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
              </span>
            </div>

            {/* Item-level Discounts */}
            {totalItemDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span className="font-medium flex items-center">
                  <Tag size={14} className="mr-1" />
                  Item Discounts
                </span>
                <span className="font-semibold">-${totalItemDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Subtotal after item discounts */}
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

            {/* Gift Coupon Button with Popover */}
            <div className="relative">
              <button
                ref={couponButtonRef}
                onClick={() => setShowCouponPopover(!showCouponPopover)}
                className="w-full py-2 px-3 text-sm border-2 border-dashed border-beveren-300 dark:border-beveren-600 rounded-xl text-beveren-600 dark:text-beveren-400 hover:bg-beveren-50 dark:hover:bg-beveren-900/20 transition-colors font-medium flex items-center justify-center"
              >
                <Tag size={16} className="mr-2" />
                Add Coupon
              </button>
              
              <GiftCouponPopover
                onApplyCoupon={onApplyCoupon}
                appliedCoupons={appliedCoupons}
                isOpen={showCouponPopover}
                onClose={() => setShowCouponPopover(false)}
                buttonRef={couponButtonRef}
              />
            </div>

            <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-gray-900 dark:text-white">${total.toFixed(2)}</span>
            </div>

            {/* Total Savings Summary */}
            {(totalItemDiscount + couponDiscount) > 0 && (
              <div className="text-center py-2 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  Total Savings: ${(totalItemDiscount + couponDiscount).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`grid grid-cols-2 gap-3 ${isMobile ? "mb-3" : ""}`}>
            <button
  onClick={() => {
    handleHoldOrder({
      items: cartItems.map(item => ({
        ...item,
        discountedPrice: getDiscountedPrice(item),
        itemDiscount: itemDiscounts[item.id] || {},
        originalPrice: item.price,
        finalAmount: getDiscountedPrice(item) * item.quantity
      })),
      customer: selectedCustomer,
      subtotal,
      total,
      appliedCoupons,
      itemDiscounts,
      totalItemDiscount,
      totalSavings: totalItemDiscount + couponDiscount,
      status: 'held'
    })

    // Navigate home
    navigate('/')
  }}
  className="px-4 py-3 border border-beveren-600 text-beveren-600 dark:text-beveren-400 rounded-xl font-medium hover:bg-beveren-50 dark:hover:bg-beveren-900/20 transition-colors"
>
  Hold
</button>
            <button
              onClick={handleClearCart}
              className="px-4 py-3 border border-red-500 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Clear Cart
            </button>
          </div>

          {/* Pay Button */}
          <button
            onClick={() => {
              if (!validateCustomer()) return;
              setShowPaymentDialog(true)
            }}
            className={`w-full bg-beveren-600 text-white rounded-2xl font-semibold hover:bg-beveren-700 transition-colors ${isMobile ? "py-4 text-lg" : "py-4"}`}
          >
            Pay ${total.toFixed(2)}
          </button>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSave={handleSaveCustomer}
        />
      )}

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          cartItems={cartItems.map(item => ({
            ...item,
            discountedPrice: getDiscountedPrice(item),
            itemDiscount: itemDiscounts[item.id] || {},
            originalPrice: item.price,
            finalAmount: getDiscountedPrice(item) * item.quantity
          }))}
          appliedCoupons={appliedCoupons}
          selectedCustomer={selectedCustomer}
          onCompletePayment={handleCompletePayment}
          onHoldOrder={handleHoldOrder}
          isMobile={isMobile}
          itemDiscounts={itemDiscounts}
          totalItemDiscount={totalItemDiscount}
        />
      )}
    </div>
  )
}