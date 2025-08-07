"use client"

import { useState, useEffect } from "react"
import { X, CreditCard, Banknote, Smartphone, Gift, Printer, Eye, Calculator, Check, MessageCirclePlus, MailPlus, MessageSquarePlus, Loader2 } from "lucide-react"
import type { CartItem, GiftCoupon, Customer } from "../../types"
import { usePaymentModes } from "../hooks/usePaymentModes"
import { useSalesTaxCharges } from "../hooks/useSalesTaxCharges"
import { usePOSDetails } from "../hooks/usePOSProfile"
import { createDraftSalesInvoice } from "../services/salesInvoice"
import { createSalesInvoice } from "../services/salesInvoice"
import { toast } from 'react-toastify';
import PrintPreview  from "../utils/posPreview"
import { useNavigate } from "react-router-dom"
import { DisplayPrintPreview, handlePrintInvoice } from "../utils/invoicePrint"

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
  amount: number
}

interface PaymentAmount {
  [key: string]: number
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
  const [selectedSalesTaxCharges, setSelectedSalesTaxCharges] = useState('')
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmount>({})
  const [roundOffAmount, setRoundOffAmount] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [isHoldingOrder, setIsHoldingOrder] = useState(false)
  const [invoiceSubmitted, setInvoiceSubmitted] = useState(false);
  const [submittedInvoice, setSubmittedInvoice] = useState<any>(null);
  const [invoiceData, setInvoiceData] = useState(null)
  const [roundOffInput, setRoundOffInput] = useState(roundOffAmount.toFixed(2));

  // Hooks
  const { modes, isLoading, error } = usePaymentModes("Test POS Profile");
  const { salesTaxCharges, defaultTax } = useSalesTaxCharges();
  const { posDetails, loading: posLoading } = usePOSDetails(); // Get POS details
  const navigate = useNavigate()

  // Determine if this is B2B business type
  const isB2B = posDetails?.business_type === 'B2B';
  const isB2C = posDetails?.business_type === 'B2C';

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)
  const taxableAmount = Math.max(0, subtotal - couponDiscount)
  const selectedTax = salesTaxCharges.find(tax => tax.id === selectedSalesTaxCharges)
  const taxAmount = taxableAmount * (selectedTax?.rate || 0) / 100
  const totalBeforeRoundOff = taxableAmount + taxAmount
  const grandTotal = totalBeforeRoundOff

  // Calculate total paid amount from all payment methods (only for B2C)
  const totalPaidAmount = isB2C ? Object.values(paymentAmounts).reduce((sum, amount) => sum + (amount || 0), 0) : 0
  const outstandingAmount = isB2C ? Math.max(0, grandTotal - (totalPaidAmount + Math.abs(roundOffAmount))) : grandTotal
  
  useEffect(() => {
    if (isOpen && defaultTax && !selectedSalesTaxCharges) {
      setSelectedSalesTaxCharges(defaultTax);
    }
  }, [isOpen, defaultTax, selectedSalesTaxCharges]);

  // Only set up payment amounts for B2C
  useEffect(() => {
    if (isOpen && modes.length > 0 && isB2C) {
      const defaultMode = modes.find(mode => mode.default === 1);
      if (defaultMode && Object.keys(paymentAmounts).length === 0) {
        setPaymentAmounts({ [defaultMode.mode_of_payment]: grandTotal });
      }
    }
  }, [isOpen, modes, grandTotal, paymentAmounts, isB2C]);

  // Update default payment method amount when grand total changes (B2C only)
  useEffect(() => {
    if (modes.length > 0 && Object.keys(paymentAmounts).length > 0 && isB2C) {
      const defaultMode = modes.find(mode => mode.default === 1);
      if (defaultMode) {
        const otherPaymentsTotal = Object.entries(paymentAmounts)
          .filter(([key]) => key !== defaultMode.mode_of_payment)
          .reduce((sum, [, amount]) => sum + (amount || 0), 0);
        
        const remainingAmount = Math.max(0, grandTotal - otherPaymentsTotal);
        setPaymentAmounts(prev => ({
          ...prev,
          [defaultMode.mode_of_payment]: remainingAmount
        }));
      }
    }
  }, [grandTotal, modes, isB2C]);

  if (!isOpen) return null
  if (isLoading || posLoading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  const paymentMethods: PaymentMethod[] = modes.map((mode) => {
    const { icon, color } = getIconAndColor(mode.type || "Default");
    return {
      id: mode.mode_of_payment,
      name: mode.mode_of_payment,
      icon,
      color,
      enabled: true,
      amount: paymentAmounts[mode.mode_of_payment] || 0
    };
  });

  const handlePaymentAmountChange = (methodId: string, amount: string) => {
    if (invoiceSubmitted || isProcessingPayment || isB2B) return;
    
    const numericAmount = parseFloat(amount) || 0;
    setPaymentAmounts(prev => ({
      ...prev,
      [methodId]: numericAmount
    }));
  };

  const handleRoundOff = () => {
    if (invoiceSubmitted || isProcessingPayment) return;

    const rounded = Math.floor(totalBeforeRoundOff);
    const difference = Math.abs(rounded - totalBeforeRoundOff);

    setRoundOffAmount(difference);
    setRoundOffInput(difference.toFixed(2));

    if (isB2C) {
      const defaultMode = modes.find(mode => mode.default === 1);
      if (defaultMode) {
        setPaymentAmounts(prev => ({
          ...prev,
          [defaultMode.mode_of_payment]: rounded
        }));
      }
    }
  };

  const handleSalesTaxChange = (value: string) => {
    if (invoiceSubmitted || isProcessingPayment) return;
    setSelectedSalesTaxCharges(value);
  };

  const handleRoundOffChange = (value: string) => {
    setRoundOffInput(value);

    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setRoundOffAmount(parsed);

      if (isB2C) {
        const defaultMode = modes.find(mode => mode.default === 1);
        if (defaultMode) {
          setPaymentAmounts(prev => ({
            ...prev,
            [defaultMode.mode_of_payment]: parseFloat((grandTotal - parsed).toFixed(2)),
          }));
        }
      }
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer");
      return;
    }

    // For B2B, we don't need payment validation
    if (isB2C) {
      const activePaymentMethods = Object.entries(paymentAmounts)
        .filter(([, amount]) => amount > 0)
        .map(([method, amount]) => ({ method, amount }));

      if (activePaymentMethods.length === 0) {
        toast.error("Please enter payment amounts");
        return;
      }
    }

    setIsProcessingPayment(true);

    const paymentData = {
      items: cartItems,
      customer: selectedCustomer,
      paymentMethods: isB2C ? Object.entries(paymentAmounts)
        .filter(([, amount]) => amount > 0)
        .map(([method, amount]) => ({ method, amount })) : [],
      subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount,
      couponDiscount,
      roundOffAmount,
      grandTotal,
      amountPaid: isB2C ? totalPaidAmount : 0,
      outstandingAmount: isB2B ? grandTotal : outstandingAmount,
      appliedCoupons,
      businessType: posDetails?.business_type
    };

    try {
      const response = await createSalesInvoice(paymentData);
      setInvoiceSubmitted(true);
      setSubmittedInvoice(response);
      setShowPreview(true)
      setInvoiceData(response.invoice)
      
      const successMessage = isB2B ? "Invoice submitted successfully!" : "Payment completed successfully!";
      toast.success(successMessage);
    } catch (err) {
      const errorMessage = isB2B ? "Failed to submit invoice" : "Failed to process payment";
      toast.error(errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleViewInvoice = (invoice: any) => {
    navigate(`/invoice/${invoice.name}`);
  };

  const handleHoldOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer")
      return;
    }

    setIsHoldingOrder(true);

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
      status: 'held',
      businessType: posDetails?.business_type
    }

    try {
      await createDraftSalesInvoice(orderData);
      toast.success("Order held successfully!");
      onHoldOrder(orderData);
    } catch (err) {
      toast.error("Failed to hold order");
    } finally {
      setIsHoldingOrder(false);
    }
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

  // Get the appropriate button text and validation
  const getActionButtonText = () => {
    if (isProcessingPayment) {
      return isB2B ? "Submitting Invoice..." : "Processing Payment...";
    }
    return isB2B ? "Submit Invoice" : "Complete Payment";
  };

  const isActionButtonDisabled = () => {
    if (invoiceSubmitted || isProcessingPayment) return true;
    // For B2C, check if payment is complete
    if (isB2C) return outstandingAmount > 0;
    // For B2B, no payment validation needed
    return false;
  };

  if (isMobile) {
    // Mobile view remains mostly the same, just update the button text and validation
    return (
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-900 overflow-y-auto custom-scrollbar" : "fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto custom-scrollbar"}>
        <div className="min-h-screen">
          {!isFullPage && (
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {invoiceSubmitted ? "Invoice Complete" : (isB2B ? "Submit Invoice" : "Payment")}
              </h1>
              {/* ... rest of mobile header remains the same ... */}
            </div>
          )}

          <div className="p-4 space-y-6">
            {invoiceSubmitted ? (
              // Invoice preview section - same as before
              <div className="space-y-4">
                {/* ... invoice preview content ... */}
              </div>
            ) : (
              <>
                {/* Payment Methods - Only show for B2C */}
                {isB2C && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h2>
                    <div className="flex space-x-3 overflow-x-auto pb-2">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className={`min-w-[280px] max-w-[280px] flex-shrink-0 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors ${invoiceSubmitted || isProcessingPayment ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg ${method.color} text-white flex items-center justify-center`}>
                              <div className="scale-75">{method.icon}</div>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">{method.name}</p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount</label>
                            <input
                              type="number"
                              value={(method.amount).toFixed(2) || ''}
                              onChange={(e) => handlePaymentAmountChange(method.id, e.target.value)}
                              placeholder="0.00"
                              disabled={invoiceSubmitted || isProcessingPayment}
                              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Business Type Indicator */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">Business Type:</span> {posDetails?.business_type || 'Loading...'}
                    {isB2B && <span className="ml-2 text-xs">(Payment will be processed later)</span>}
                  </p>
                </div>

                {/* Round Off */}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Round Off</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={roundOffInput}
                          onChange={(e) => handleRoundOffChange(e.target.value)}
                          disabled={invoiceSubmitted || isProcessingPayment}
                          className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                        <button
                          onClick={handleRoundOff}
                          disabled={invoiceSubmitted || isProcessingPayment}
                          className={`px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
                          title="Auto Round"
                        >
                          <Calculator size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
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
                  
                  {isB2C && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(totalPaidAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(outstandingAmount)}</span>
                      </div>
                      {totalPaidAmount > grandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(totalPaidAmount - grandTotal)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(grandTotal)}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-6">
                  <button
                    onClick={handleCompletePayment}
                    disabled={isActionButtonDisabled()}
                    className={`w-full py-4 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 ${
                      isB2B 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>{getActionButtonText()}</span>
                      </>
                    ) : (
                      <span>{getActionButtonText()}</span>
                    )}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleHoldOrder}
                      disabled={invoiceSubmitted || isProcessingPayment || isHoldingOrder}
                      className={`py-3 px-4 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center space-x-2 ${invoiceSubmitted || isProcessingPayment || isHoldingOrder ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      {isHoldingOrder ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Holding...</span>
                        </>
                      ) : (
                        <span>Hold Order</span>
                      )}
                    </button>
                    <button
                      onClick={onClose}
                      disabled={isProcessingPayment || isHoldingOrder}
                      className="py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Desktop view with similar modifications
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isB2B ? "Invoice Submission" : "Payment Processing"}
          </h2>
      
        
          {invoiceSubmitted ? (
            <div className="flex items-center space-x-3">
              {/* ... action buttons remain the same ... */}
            </div>
          ) : (
            <button
              onClick={onClose}
              disabled={isProcessingPayment || isHoldingOrder}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex flex-1 min-h-0">
          {/* Left Section */}
          <div className="w-2/3 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* Business Type Indicator */}
            {/* <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Business Type: {posDetails?.business_type || 'Loading...'}
                  </p>
                  {isB2B && (
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Payment will be processed separately. This will create an invoice with outstanding amount.
                    </p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isB2B 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
                    : 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                }`}>
                  {posDetails?.business_type || 'Loading...'}
                </div>
              </div>
            </div> */}

            {/* Payment Methods - Only show for B2C */}
            {(isB2C || isB2B) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
                <div className="flex space-x-4 overflow-x-auto pb-2">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`min-w-[50%] sm:min-w-[300px] md:min-w-[350px] border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors flex-shrink-0 ${invoiceSubmitted || isProcessingPayment ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-8 h-8 rounded-md ${method.color} text-white flex items-center justify-center`}>
                          <div className="scale-75">{method.icon}</div>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{method.name}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                        <input
                          type="number"
                          value={(method.amount).toFixed(2) || ''}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value);
                            const formatted = isNaN(raw) ? '' : raw.toFixed(2);
                            handlePaymentAmountChange(method.id, formatted);
                          }}
                          placeholder="0.00"
                          disabled={invoiceSubmitted || isProcessingPayment}
                          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    onChange={(e) => handleSalesTaxChange(e.target.value)}
                    disabled={invoiceSubmitted || isProcessingPayment}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {isB2B ? "Invoice Summary" : "Payment Summary"}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Round Off
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={roundOffInput}
                        onChange={(e) => handleRoundOffChange(e.target.value)}
                        disabled={invoiceSubmitted || isProcessingPayment}
                        className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
                      />
                      <button
                        onClick={handleRoundOff}
                        disabled={invoiceSubmitted || isProcessingPayment}
                        className={`px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors ${invoiceSubmitted || isProcessingPayment ? 'cursor-not-allowed opacity-50' : ''}`}
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
                  
                  {(isB2C || isB2B) &&  (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(totalPaidAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                        <span className={`font-bold ${outstandingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {formatCurrency(outstandingAmount)}
                        </span>
                      </div>
                      {totalPaidAmount > grandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaidAmount - grandTotal)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(grandTotal)}</span>
                    </div>
                  )} */}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Invoice Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Show PrintPreview if invoice is submitted */}
            {invoiceSubmitted && invoiceData ? (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">Print Format Preview:</h5>
                <div className="border border-gray-300 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-700">
                  <DisplayPrintPreview invoice={invoiceData} />
                </div>
              </div>
            ) : (
              // Regular invoice preview when not submitted
              <>
                <div className="text-center mb-4">
                  <h4 className="font-bold text-lg text-gray-900 dark:text-white">KLIK POS</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isB2B ? "Sales Invoice" : "Sales Invoice"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{currentDate}</p>
                  {isB2B && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
                      Payment Pending
                    </p>
                  )}
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

                  {/* Payment Methods Used - Only show for B2C */}
                  {(isB2C || isB2B) && Object.entries(paymentAmounts).filter(([, amount]) => amount > 0).length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Methods:</p>
                      {Object.entries(paymentAmounts)
                        .filter(([, amount]) => amount > 0)
                        .map(([method, amount]) => (
                          <div key={method} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">{method}</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* B2B Outstanding Amount Display */}
                  {isB2B && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600 dark:text-orange-400 font-medium">Outstanding Amount:</span>
                        <span className="text-orange-600 dark:text-orange-400 font-bold">{formatCurrency(grandTotal)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Payment to be collected separately
                      </p>
                    </div>
                  )}

                  {/* QR Code */}
                  {invoiceSubmitted && submittedInvoice?.invoice?.custom_invoice_qr_code && (
                    <div className="mt-4 text-center">
                      <img
                        src={submittedInvoice.invoice.custom_invoice_qr_code}
                        alt="Invoice QR Code"
                        className="mx-auto w-20 h-20 object-contain border border-gray-200 dark:border-gray-600 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="text-center mt-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-500">Thank you for your business!</p>
                  {isB2B && (
                    <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                      Invoice will be sent for payment processing
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        {invoiceSubmitted ? (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="flex justify-end space-x-4">
              <button
                onClick={onCompletePayment}
                className="bg-beveren-500 px-6 py-2 border border-gray-300 dark:border-gray-600 text-white dark:text-gray-300 rounded-lg font-medium hover:bg-green-700 dark:hover:bg-gray-800 transition-colors"
              >
                New Order
              </button>
              {/* <button
                onClick={onClose}
                className="px-8 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <Check size={16} />
                <span>Return</span>
              </button> */}
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="flex justify-end space-x-4">
              <button
                onClick={onClose}
                disabled={isProcessingPayment || isHoldingOrder}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldOrder}
                disabled={invoiceSubmitted || isProcessingPayment || isHoldingOrder}
                className={`px-6 py-2 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center space-x-2 ${invoiceSubmitted || isProcessingPayment || isHoldingOrder ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {isHoldingOrder ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Holding...</span>
                  </>
                ) : (
                  <span>Hold Order</span>
                )}
              </button>
              <button
                onClick={handleCompletePayment}
                disabled={isActionButtonDisabled()}
                className={`px-8 py-2 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 ${
                  isB2B 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{getActionButtonText()}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{getActionButtonText()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}