

"use client"

import { useState, useEffect, useMemo } from "react"
import { X, CreditCard, Banknote, Smartphone, Gift, Printer, Eye, Calculator, Check, MessageCirclePlus, MailPlus, MessageSquarePlus, Loader2 } from "lucide-react"
import type { CartItem, GiftCoupon, Customer } from "../../types"
import { usePaymentModes } from "../hooks/usePaymentModes"
import { useSalesTaxCharges } from "../hooks/useSalesTaxCharges"
import { usePOSDetails } from "../hooks/usePOSProfile"
import { createDraftSalesInvoice } from "../services/salesInvoice"
import { createSalesInvoice } from "../services/salesInvoice"
import { toast } from 'react-toastify';
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
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);

  // Hooks
  const { modes, isLoading, error } = usePaymentModes("Test POS Profile");
  const { salesTaxCharges, defaultTax } = useSalesTaxCharges();
  const { posDetails, loading: posLoading } = usePOSDetails();
  const navigate = useNavigate()

  // Determine if this is B2B business type
  const isB2B = posDetails?.business_type === 'B2B';
  const isB2C = posDetails?.business_type === 'B2C';
  const print_receipt_on_order_complete = posDetails?.print_receipt_on_order_complete
  const currencySymbol = posDetails?.currency_symbol

  // Calculate totals with memoization for performance
  const calculations = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)
    const taxableAmount = Math.max(0, subtotal - couponDiscount)
    
    const selectedTax = salesTaxCharges.find(tax => tax.id === selectedSalesTaxCharges)
    const taxRate = selectedTax?.rate || 0
    const isInclusive = selectedTax?.is_inclusive || false
    
    let taxAmount: number
    let grandTotal: number
    
   if (isInclusive) {
  // For inclusive tax: tax is already included in the taxable amount
  taxAmount = taxableAmount * taxRate / (100 + taxRate)
  taxAmount = parseFloat(taxAmount.toFixed(2)) // Ensure 2 decimal places
  grandTotal = taxableAmount
} else {
  // For exclusive tax: tax is added to the taxable amount
  taxAmount = taxableAmount * taxRate / 100
  taxAmount = parseFloat(taxAmount.toFixed(2)) // Ensure 2 decimal places
  grandTotal = taxableAmount + taxAmount
}

    
    return {
      subtotal,
      couponDiscount,
      taxableAmount,
      taxAmount,
      grandTotal: grandTotal + roundOffAmount,
      selectedTax,
      isInclusive
    }
  }, [cartItems, appliedCoupons, selectedSalesTaxCharges, salesTaxCharges, roundOffAmount])

  // Calculate total paid amount from all payment methods (only for B2C)
 // Calculate total paid amount from all payment methods (for both B2C and B2B)
const totalPaidAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + (amount || 0), 0)
const outstandingAmount = Math.max(0, calculations.grandTotal - totalPaidAmount)


  useEffect(() => {
    if (isOpen && defaultTax && !selectedSalesTaxCharges) {
      setSelectedSalesTaxCharges(defaultTax);
    }
  }, [isOpen, defaultTax, selectedSalesTaxCharges]);

  // Only set up payment amounts for B2C
 // Set up payment amounts for both B2C and B2B
useEffect(() => {
  if (isOpen && modes.length > 0) {
    const defaultMode = modes.find(mode => mode.default === 1);
    if (defaultMode && Object.keys(paymentAmounts).length === 0) {
      const defaultAmount = parseFloat((calculations.grandTotal).toFixed(2));
      setPaymentAmounts({ [defaultMode.mode_of_payment]: defaultAmount });
    }
  }
}, [isOpen, modes, calculations.grandTotal, paymentAmounts, isB2B, isB2C]);

  // Update default payment method amount when grand total changes (B2C only)
 // Update default payment method amount when grand total changes
useEffect(() => {
  if (modes.length > 0 && Object.keys(paymentAmounts).length > 0) {
    const defaultMode = modes.find(mode => mode.default === 1);
    if (defaultMode) {
      const otherPaymentsTotal = Object.entries(paymentAmounts)
        .filter(([key]) => key !== defaultMode.mode_of_payment)
        .reduce((sum, [, amount]) => sum + (amount || 0), 0);
      
      // For B2B, allow flexible payment amounts (can be 0 for pay later)
      // For B2C, require full payment by default
      const remainingAmount = isB2C ? Math.max(0, calculations.grandTotal - otherPaymentsTotal) : 0;
      
      setPaymentAmounts(prev => ({
        ...prev,
        [defaultMode.mode_of_payment]: remainingAmount
      }));
    }
  }
}, [calculations.grandTotal, modes, isB2C, isB2B]);

// Auto-print when invoice is submitted and auto-print is enabled
// Auto-print when invoice is submitted and auto-print is enabled
useEffect(() => {
  if (invoiceSubmitted && invoiceData && print_receipt_on_order_complete) {
    setIsAutoPrinting(true);
    // Small delay to ensure the preview is rendered
    setTimeout(() => {
      handlePrintInvoice(invoiceData);
      setIsAutoPrinting(false);
    }, 500);
  }
}, [invoiceSubmitted, invoiceData, print_receipt_on_order_complete]);

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
  if (invoiceSubmitted || isProcessingPayment) return;
  
  const numericAmount = parseFloat(amount) || 0;
  setPaymentAmounts(prev => ({
    ...prev,
    [methodId]: numericAmount
  }));
};
  const handleRoundOff = () => {
    if (invoiceSubmitted || isProcessingPayment) return;

    const totalBeforeRoundOff = calculations.isInclusive ? calculations.taxableAmount : calculations.taxableAmount + calculations.taxAmount;
    const rounded = Math.round(totalBeforeRoundOff);
    const difference = rounded - totalBeforeRoundOff;

    setRoundOffAmount(difference);
    setRoundOffInput(difference.toFixed(2));

    // For B2C, update payment amount; for B2B, keep flexible
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

      if (isB2C || isB2B) {
        const defaultMode = modes.find(mode => mode.default === 1);
        if (defaultMode) {
          const newGrandTotal = (calculations.isInclusive ? calculations.taxableAmount : calculations.taxableAmount + calculations.taxAmount) + parsed;
          setPaymentAmounts(prev => ({
            ...prev,
            [defaultMode.mode_of_payment]: parseFloat(newGrandTotal.toFixed(2)),
          }));
        }
      }
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedCustomer || !selectedCustomer.name) {
      toast.error("Kindly select a customer");
      return;
    }
    // For B2B, we don't need payment validation
    // For B2C, validate payment completion
if (isB2C) {
  const activePaymentMethods = Object.entries(paymentAmounts)
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => ({ method, amount }));

  if (activePaymentMethods.length === 0) {
    toast.error("Please enter payment amounts");
    return;
  }

  if (outstandingAmount > 0) {
    toast.error("Please complete the payment before proceeding");
    return;
  }
}

// For B2B, no payment validation required - can be partial or zero payment

    setIsProcessingPayment(true);

    const paymentData = {
      items: cartItems,
      customer: selectedCustomer,
      paymentMethods: Object.entries(paymentAmounts)
        .filter(([, amount]) => amount > 0)
        .map(([method, amount]) => ({ method, amount })),
      subtotal: calculations.subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount: calculations.taxAmount,
      taxType: calculations.isInclusive ? 'inclusive' : 'exclusive',
      couponDiscount: calculations.couponDiscount,
      roundOffAmount,
      grandTotal: calculations.grandTotal,
      amountPaid: totalPaidAmount,
      outstandingAmount: outstandingAmount,
      appliedCoupons,
      businessType: posDetails?.business_type
    };

    try {
      const response = await createSalesInvoice(paymentData);
      console.log("Data", paymentData)
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
      subtotal: calculations.subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount: calculations.taxAmount,
      taxType: calculations.isInclusive ? 'inclusive' : 'exclusive',
      couponDiscount: calculations.couponDiscount,
      roundOffAmount,
      grandTotal: calculations.grandTotal,
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
   return `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
  
  if (isB2B) {
    if (totalPaidAmount === 0) {
      return "Submit Invoice (Pay Later)";
    } else if (outstandingAmount > 0) {
      return "Submit Invoice (Partial Payment)";
    } else {
      return "Submit Invoice (Paid)";
    }
  }
  
  return "Complete Payment";
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
  <div className="space-y-4">
    {/* Action Buttons for Mobile */}
    <div className="flex items-center justify-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <div className="text-green-600 dark:text-green-400 text-center">
        <p className="font-semibold">
          {isB2B ? "Invoice Submitted Successfully!" : "Payment Completed Successfully!"}
        </p>
        <p className="text-sm opacity-75">Total: {formatCurrency(calculations.grandTotal)}</p>
      </div>
    </div>

    {/* Action Buttons Row */}
    <div className="flex flex-wrap gap-2 justify-center">
      {isAutoPrinting && (
        <div className="flex items-center space-x-2 text-blue-600 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Printing...</span>
        </div>
      )}
      
      <button
        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title="Print"
        onClick={() => {
          handlePrintInvoice(invoiceData);
          navigate('/');
        }}
      >
        <Printer size={18} />
        <span>Print</span>
      </button>

      <button
        className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
        title="Email"
        onClick={() => {
          const subject = encodeURIComponent("Your Invoice");
          const body = encodeURIComponent(`Dear ${selectedCustomer?.name},\n\nHere is your invoice total: ${formatCurrency(calculations.grandTotal)}\n\nThank you.`);
          window.open(`mailto:${selectedCustomer?.email}?subject=${subject}&body=${body}`);
        }}
      >
        <MailPlus size={18} />
        <span>Email</span>
      </button>

      <button
        className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
        title="WhatsApp"
        onClick={() => {
          const msg = encodeURIComponent(`Here is your invoice total: ${formatCurrency(calculations.grandTotal)}`);
          window.open(`https://wa.me/${selectedCustomer?.phone}?text=${msg}`, "_blank");
        }}
      >
        <MessageCirclePlus size={18} />
        <span>WhatsApp</span>
      </button>

      <button
        className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors"
        title="Text Message"
        onClick={() => window.open(`tel:${selectedCustomer?.phone}`)}
      >
        <MessageSquarePlus size={18} />
        <span>SMS</span>
      </button>

      <button
        className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors"
        title="View Full Invoice"
        onClick={() => handleViewInvoice(invoiceData)}
      >
        <Eye size={18} />
        <span>View</span>
      </button>
    </div>

    {/* Invoice Preview for Mobile */}
    {invoiceData && (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
          Invoice Preview:
        </h4>
        <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto">
          <DisplayPrintPreview invoice={invoiceData} />
        </div>
      </div>
    )}

    {/* New Order Button */}
    <div className="pt-4">
      <button
        onClick={() => {
          onCompletePayment(null);
          navigate('/');
        }}
        className="w-full py-3 bg-beveren-600 text-white rounded-lg font-medium hover:bg-beveren-700 transition-colors"
      >
        Start New Order
      </button>
    </div>
  </div>
)  : (
              <>
                {/* Payment Methods - Only show for B2C */}
                {(isB2C || isB2B) && (
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

                {/* Tax Type Indicator */}
                

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
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  {calculations.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(calculations.couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Tax ({calculations.selectedTax?.rate}% {calculations.isInclusive ? 'Incl.' : 'Excl.'})
                    </span>
                    <span className={`font-medium ${
                      calculations.isInclusive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {calculations.isInclusive ? `(${formatCurrency(calculations.taxAmount)})` : formatCurrency(calculations.taxAmount)}
                    </span>
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
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(calculations.grandTotal)}</span>
                    </div>
                  </div>
                  
                  {(isB2C || isB2B) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(totalPaidAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(outstandingAmount)}</span>
                      </div>
                      {totalPaidAmount > calculations.grandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(totalPaidAmount - calculations.grandTotal)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(calculations.grandTotal)}</span>
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
<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isB2B ? "Invoice Submission" : "Payment Processing"}
          </h2>
      
        
           {invoiceSubmitted ? (
    <div className="flex items-center space-x-3">
      {isAutoPrinting && (
      <div className="flex items-center space-x-2 text-blue-600">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Printing...</span>
      </div>
    )}
      <button
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
        title="Print"
        onClick={() => {
        handlePrintInvoice(invoiceData);
        navigate('/');
      }}
    >

        <Printer size={20} />
      </button>

       <button
        className="p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg"
        title="Email"
        onClick={() => {
          const subject = encodeURIComponent("Your Invoice");
          const body = encodeURIComponent(`Dear ${selectedCustomer?.name},\n\nHere is your invoice total: ${formatCurrency(grandTotal)}\n\nThank you.`);
          window.open(`mailto:${selectedCustomer?.email}?subject=${subject}&body=${body}`);
        }}
      >
        <MailPlus size={20} />
      </button>

      <button
        className="p-2 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900 rounded-lg"
        title="WhatsApp"
        onClick={() => {
          const msg = encodeURIComponent(`Here is your invoice total: ${formatCurrency(grandTotal)}`);
          window.open(`https://wa.me/${selectedCustomer?.phone}?text=${msg}`, "_blank");
        }}
      >
        <MessageCirclePlus size={20} />
      </button>

      <button
        className="p-2 text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900 rounded-lg"
        title="Text Message"
        onClick={() => window.open(`tel:${selectedCustomer?.phone}`)}
      >
        <MessageSquarePlus />
      </button>

      <button
        className="p-2 text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900 rounded-lg"
        title="View Full"
        onClick={()=>handleViewInvoice(invoiceData)}
      >
        <Eye />
      </button>
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
            {/* Tax Type Indicator */}

            {/* Payment Methods - Show for both B2C and B2B but disable for B2B */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Payment Methods 
              </h3>
              <div className="flex space-x-4 overflow-x-auto pb-2">
                  {paymentMethods.map((method) => (
  <div
    key={method.id}
    className={`min-w-[50%] sm:min-w-[300px] md:min-w-[350px] border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors flex-shrink-0 ${invoiceSubmitted || isProcessingPayment || isB2B ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
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
        step="0.01"
        value={method.amount || ''}
        onChange={(e) => {
          const inputValue = e.target.value;
          // Just store the raw number without formatting during typing
          const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
          handlePaymentAmountChange(method.id, isNaN(numValue) ? 0 : numValue);
        }}
        onBlur={(e) => {
          // Format to 2 decimal places only when user leaves the field
          const numValue = parseFloat(e.target.value);
          if (!isNaN(numValue)) {
            const formatted = parseFloat(numValue.toFixed(2));
            handlePaymentAmountChange(method.id, formatted);
          }
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
                        {tax.name} ({tax.rate}% {tax.is_inclusive ? 'Incl.' : 'Excl.'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tax Amount {calculations.isInclusive && '(Included)'}
                  </label>
                  <div className={`px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-medium ${
                    calculations.isInclusive 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {calculations.isInclusive ? `(${formatCurrency(calculations.taxAmount)})` : formatCurrency(calculations.taxAmount)}
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
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  {calculations.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Coupon Discount</span>
                      <span>-{formatCurrency(calculations.couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Tax ({calculations.selectedTax?.rate}% {calculations.isInclusive ? 'Incl.' : 'Excl.'})
                    </span>
                    <span className={`font-medium ${
                      calculations.isInclusive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {calculations.isInclusive ? `(${formatCurrency(calculations.taxAmount)})` : formatCurrency(calculations.taxAmount)}
                    </span>
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
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(calculations.grandTotal)}</span>
                    </div>
                  </div>
                  
                  {(isB2C || isB2B) && (
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
                      {totalPaidAmount > calculations.grandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaidAmount - calculations.grandTotal)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(calculations.grandTotal)}</span>
                    </div>
                  )}
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
                    <span className="text-gray-900 dark:text-white">{formatCurrency(calculations.subtotal)}</span>
                  </div>
                  {calculations.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(calculations.couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Tax ({calculations.selectedTax?.rate}% {calculations.isInclusive ? 'Incl.' : 'Excl.'})
                    </span>
                    <span className={`${
                      calculations.isInclusive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {calculations.isInclusive ? `(${formatCurrency(calculations.taxAmount)})` : formatCurrency(calculations.taxAmount)}
                    </span>
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
                      <span className="text-gray-900 dark:text-white">{formatCurrency(calculations.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Payment Methods Used - Only show for B2C with actual amounts */}
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
                        <span className="text-orange-600 dark:text-orange-400 font-bold">{formatCurrency(calculations.grandTotal)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Payment to be collected separately
                      </p>
                    </div>
                  )}

                  {/* Tax Type Note */}
                  {calculations.selectedTax && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                      <p className={`text-xs ${
                        calculations.isInclusive 
                          ? 'text-blue-500 dark:text-blue-400' 
                          : 'text-orange-500 dark:text-orange-400'
                      }`}>
                        Tax is {calculations.isInclusive ? 'inclusive' : 'exclusive'} of item prices
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
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="flex justify-end space-x-4">
              <button
                onClick={onClose}
                disabled={isProcessingPayment || isHoldingOrder}
                className="px-6 py-2 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldOrder}
                disabled={invoiceSubmitted || isProcessingPayment || isHoldingOrder}
                className={`px-6 py-2 border  border-gray-300 dark:border-gray-600 text-gray-700 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center space-x-2 ${invoiceSubmitted || isProcessingPayment || isHoldingOrder ? 'cursor-not-allowed opacity-50' : ''}`}
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
                    ? 'bg-beveren-500 hover:bg-blue-700 text-white' 
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
  )}