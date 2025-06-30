"use client"

import { useState, useEffect } from "react"
import { X, CreditCard, Banknote, Smartphone, Gift, Printer, Eye, Calculator, Check } from "lucide-react"
import type { CartItem, GiftCoupon, Customer } from "../../types"
import { usePaymentModes } from "../hooks/usePaymentModes"
import { useSalesTaxCharges } from "../hooks/useSalesTaxCharges"
import { createDraftSalesInvoice } from "../services/slaesInvoice"
import { createSalesInvoice } from "../services/slaesInvoice"
import { toast } from 'react-toastify';

interface PaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  appliedCoupons: GiftCoupon[]
  selectedCustomer: Customer | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCompletePayment: (paymentData: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHoldOrder: (orderData: any) => void
  isMobile?: boolean
  isFullPage?: boolean,

}

interface PaymentMethod {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  enabled: boolean
}

const getIconAndColor = (label: string): { icon: React.ReactNode; color: string } => {
  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("cash")) {
    return { icon: <Banknote size={24} />, color: "bg-green-600" };
  }
  if (lowerLabel.includes("card") || lowerLabel.includes("credit") || lowerLabel.includes("debit") || lowerLabel.includes("bank")) {
    return { icon: <CreditCard size={24} />, color: "bg-blue-600" };
  }
  if (lowerLabel.includes("phone") || lowerLabel.includes("mpesa")) {
    return { icon: <Smartphone size={24} />, color: "bg-purple-600" };
  }
  if (lowerLabel.includes("gift")) {
    return { icon: <Gift size={24} />, color: "bg-orange-600" };
  }
  if (lowerLabel.includes("cheque") || lowerLabel.includes("check")) {
    return { icon: <Check size={24} />, color: "bg-yellow-600" };
  }

  return { icon: <CreditCard size={24} />, color: "bg-gray-600" };
};


export default function PaymentDialog({
  isOpen,
  onClose,
  cartItems,
  appliedCoupons,
  selectedCustomer,
  onCompletePayment,
  onHoldOrder,
  isMobile = false,
  isFullPage = false
}: PaymentDialogProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [selectedSalesTaxCharges, setSelectedSalesTaxCharges] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [roundOffAmount, setRoundOffAmount] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const { modes, isLoading, error } = usePaymentModes("Test POS Profile");
  const { salesTaxCharges, defaultTax } = useSalesTaxCharges();

  useEffect(() => {
  if (isOpen && defaultTax && !selectedSalesTaxCharges) {
    setSelectedSalesTaxCharges(defaultTax);
  }
}, [isOpen, defaultTax, selectedSalesTaxCharges]);


  if (!isOpen) return null
  
  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)
  const taxableAmount = Math.max(0, subtotal - couponDiscount)
  const selectedTax = salesTaxCharges.find(tax => tax.id === selectedSalesTaxCharges)

  const taxAmount = taxableAmount * (selectedTax?.rate || 0) / 100
  const totalBeforeRoundOff = taxableAmount + taxAmount
  const grandTotal = totalBeforeRoundOff + roundOffAmount
  const paidAmount = parseFloat(amountPaid) || 0
  const outstandingAmount = Math.max(0, grandTotal - paidAmount)

    const paymentMethods: PaymentMethod[] = modes.map((mode) => {
    const { icon, color } = getIconAndColor(mode.type || "Default");
    return {
      id: mode.mode_of_payment,
      name: mode.mode_of_payment,
      icon,
      color,
      enabled: true
    };
  });

  if (!isOpen) return null;
  if (isLoading) return <div className="p-6">Loading payment methods...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  
  const handleRoundOff = () => {
    const rounded = Math.round(totalBeforeRoundOff)
    setRoundOffAmount(rounded - totalBeforeRoundOff)
  }

  const handleCompletePayment = () => {
    if (!selectedCustomer){
      toast.error("Kindly select a customer")
      return;
    }
    if (!selectedPaymentMethod) {
  toast.error("Please select a payment method");
  return;
}
    const paymentData = {
      items: cartItems,
      customer: selectedCustomer,
      paymentMethod: selectedPaymentMethod,
      subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount,
      couponDiscount,
      roundOffAmount,
      grandTotal,
      amountPaid: paidAmount,
      outstandingAmount,
      appliedCoupons
    }
    createSalesInvoice(paymentData)
    onCompletePayment(paymentData)
  }

  const handleHoldOrder = () => {
    if (!selectedCustomer){
      toast.error("Kindly select a customer")
      return;
    }
    const orderData = {
      items: cartItems,
      customer: selectedCustomer,
      subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount,
      couponDiscount,
      roundOffAmount,
      grandTotal,
      appliedCoupons,
      status: 'held'
    }
    createDraftSalesInvoice(orderData)
    onHoldOrder(orderData)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isMobile) {
    // Mobile: Full screen page
    return (
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-900 overflow-y-auto custom-scrollbar" : "fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto custom-scrollbar"}>
        <div className="min-h-screen">
          {/* Mobile Header - Only show if not full page */}
          {!isFullPage && (
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Payment</h1>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="p-4 space-y-6">
            {/* Payment Methods */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h2>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === method.id
                        ? 'border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${method.color} text-white flex items-center justify-center mx-auto mb-2`}>
                      <div className="scale-75">
                        {method.icon}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white text-xs text-center">{method.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sales & Tax Charges */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales & Tax Charges</h2>
              <select
                value={selectedSalesTaxCharges}
                onChange={(e) => setSelectedSalesTaxCharges(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {salesTaxCharges.map((tax) => (
                  <option key={tax.id} value={tax.id}>
                    {tax.name} ({tax.rate}%)
                  </option>
                ))}
              </select>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Tax Amount: {formatCurrency(taxAmount)}
              </div>
            </div>

            {/* Amount Paid */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Amount Paid
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg"
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tax ({selectedTax?.rate}%)</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(taxAmount)}</span>
              </div>
              {roundOffAmount !== 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Round Off</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(roundOffAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(outstandingAmount)}</span>
              </div>
              {paidAmount > grandTotal && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Change</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(paidAmount - grandTotal)}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-6">
              <button
                onClick={handleCompletePayment}
                disabled={outstandingAmount > 0}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
              >
                Complete Payment
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleHoldOrder}
                  className="py-3 px-4 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  Hold Order
                </button>
                <button
                  onClick={onClose}
                  className="py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop: Modal dialog
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Processing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex flex-1 min-h-0">
          {/* Left Section - Payment Details */}
          <div className="w-2/3 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* Payment Methods */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedPaymentMethod === method.id
                        ? 'border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md ${method.color} text-white flex items-center justify-center mx-auto mb-2`}>
                      <div className="scale-75">
                        {method.icon}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white text-xs text-center">{method.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tax Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sales & Tax Charges
                  </label>
                  <select
                    value={selectedSalesTaxCharges}
                    onChange={(e) => setSelectedSalesTaxCharges(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {salesTaxCharges.map((tax) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.name} ({tax.rate}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tax Amount
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-medium">
                    {formatCurrency(taxAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Totals Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Round Off
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={roundOffAmount.toFixed(2)}
                        onChange={(e) => setRoundOffAmount(parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <button
                        onClick={handleRoundOff}
                        className="px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
                        title="Auto Round"
                      >
                        <Calculator size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Coupon Discount</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tax ({selectedTax?.rate}%)</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(taxAmount)}</span>
                  </div>
                  {roundOffAmount !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Round Off</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(roundOffAmount)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                    <div className="flex justify-between">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">Grand Total</span>
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                    <span className={`font-bold ${outstandingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {formatCurrency(outstandingAmount)}
                    </span>
                  </div>
                  {paidAmount > grandTotal && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Change</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(paidAmount - grandTotal)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Invoice Preview */}
          <div className="w-1/3 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invoice Preview</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                  title="Preview"
                >
                  <Eye size={16} />
                </button>
                <button
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                  title="Print"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>

            {/* Invoice Preview - Scrollable */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-center mb-4">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white">KLIK POS</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Sales Invoice</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{currentDate}</p>
              </div>

              {selectedCustomer && (
                <div className="mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
                  <p className="font-medium text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{selectedCustomer.email}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{selectedCustomer.phone}</p>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-gray-600 dark:text-gray-400">{item.quantity} x {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.quantity * item.price)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount</span>
                    <span>-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tax ({selectedTax?.rate}%)</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(taxAmount)}</span>
                </div>
                {roundOffAmount !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Round Off</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(roundOffAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="text-center mt-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-500">Thank you for your business!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons - Always Visible */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
                
              onClick={handleHoldOrder}
              className="px-6 py-2 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              Hold Order
            </button>
            <button
              onClick={handleCompletePayment}
              disabled={outstandingAmount > 0}
              className="px-8 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Check size={16} />
              <span>Complete Payment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

