"use client"

import { useState, useEffect } from "react"
import { X, CreditCard, Banknote, Smartphone, Gift, Printer, Eye, Calculator, Check, MessageCirclePlus, MailPlus,MessageSquarePlus } from "lucide-react"
import type { CartItem, GiftCoupon, Customer } from "../../types"
import { usePaymentModes } from "../hooks/usePaymentModes"
import { useSalesTaxCharges } from "../hooks/useSalesTaxCharges"
import { createDraftSalesInvoice } from "../services/salesInvoice"
import { createSalesInvoice } from "../services/salesInvoice"
import { toast } from 'react-toastify';
import PrintPreview  from "../utils/posPreview"
import { useNavigate } from "react-router-dom"


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
  const { modes, isLoading, error } = usePaymentModes("Test POS Profile");
  const { salesTaxCharges, defaultTax } = useSalesTaxCharges();
  const [invoiceSubmitted, setInvoiceSubmitted] = useState(false);
const [submittedInvoice, setSubmittedInvoice] = useState<any>(null); // you can define a better type
// const [showPreview, setShowPreview] = useState(false)
const [invoiceData, setInvoiceData] = useState(null)
const navigate = useNavigate()

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0)
  const taxableAmount = Math.max(0, subtotal - couponDiscount)
  const selectedTax = salesTaxCharges.find(tax => tax.id === selectedSalesTaxCharges)
  const taxAmount = taxableAmount * (selectedTax?.rate || 0) / 100
  const totalBeforeRoundOff = taxableAmount + taxAmount
  const grandTotal = totalBeforeRoundOff - roundOffAmount

  // Calculate total paid amount from all payment methods
  const totalPaidAmount = Object.values(paymentAmounts).reduce((sum, amount) => sum + (amount || 0), 0)
  const outstandingAmount = Math.max(0, grandTotal - totalPaidAmount)

  
  useEffect(() => {
    if (isOpen && defaultTax && !selectedSalesTaxCharges) {
      setSelectedSalesTaxCharges(defaultTax);
    }
  }, [isOpen, defaultTax, selectedSalesTaxCharges]);

  useEffect(() => {
    if (isOpen && modes.length > 0) {
      const defaultMode = modes.find(mode => mode.default === 1);
      if (defaultMode && Object.keys(paymentAmounts).length === 0) {
        // Set the grand total to the default payment method initially
        setPaymentAmounts({ [defaultMode.mode_of_payment]: grandTotal });
      }
    }
  }, [isOpen, modes, grandTotal, paymentAmounts]);

  // Update default payment method amount when grand total changes
  useEffect(() => {
    if (modes.length > 0 && Object.keys(paymentAmounts).length > 0) {
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
  }, [grandTotal, modes]);

  if (!isOpen) return null
  if (isLoading) return <div className="p-6">Loading payment methods...</div>;
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
    // Prevent changes if invoice is submitted
    if (invoiceSubmitted) return;
    
    const numericAmount = parseFloat(amount) || 0;
    setPaymentAmounts(prev => ({
      ...prev,
      [methodId]: numericAmount
    }));
  };

  // const handleNewOrder = (data: string) =>{
  //   onCompletePayment(data)
  // }
  const handleRoundOff = () => {
    // Prevent changes if invoice is submitted
    if (invoiceSubmitted) return;
    
    const rounded = Math.round(totalBeforeRoundOff)
    setRoundOffAmount(rounded - totalBeforeRoundOff)
  }

  const handleSalesTaxChange = (value: string) => {
    // Prevent changes if invoice is submitted
    if (invoiceSubmitted) return;
    
    setSelectedSalesTaxCharges(value);
  };

  const handleRoundOffChange = (value: string) => {
    // Prevent changes if invoice is submitted
    if (invoiceSubmitted) return;
    
    setRoundOffAmount(parseFloat(value) || 0);
  };

const handleCompletePayment = async () => {
  if (!selectedCustomer) {
    toast.error("Kindly select a customer");
    return;
  }

  const activePaymentMethods = Object.entries(paymentAmounts)
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => ({ method, amount }));

  if (activePaymentMethods.length === 0) {
    toast.error("Please enter payment amounts");
    return;
  }


  const paymentData = {
    items: cartItems,
    customer: selectedCustomer,
    paymentMethods: activePaymentMethods,
    subtotal,
    SalesTaxCharges: selectedSalesTaxCharges,
    taxAmount,
    couponDiscount,
    roundOffAmount,
    grandTotal,
    amountPaid: totalPaidAmount,
    outstandingAmount,
    appliedCoupons
  };

  try {
    const response = await createSalesInvoice(paymentData);
    // toast.success("Invoice submitted successfully");
    console.log(response.invoice.custom_invoice_qr_code)
    setInvoiceSubmitted(true);
    setSubmittedInvoice(response); // Save full invoice doc if returned
    setShowPreview(true)
    setInvoiceData(response.invoice)
    // onCompletePayment(paymentData);
  } catch (err) {
    toast.error("Failed to submit invoice");
  }
};

  const handleViewInvoice = (invoice: SalesInvoice) => {
    console.log("Helkos", invoice.name)
      navigate(`/invoice/${invoice.name}`);
  
    };

const DebugPrintPreview = ({ invoice }: { invoice: any }) => {
  console.log("DebugPrintPreview received invoice:", invoice);
  return (
    <div className="border p-2 m-2">
      <PrintPreview invoice={invoice} />
    </div>
  );
};

  const handleHoldOrder = () => {
    if (!selectedCustomer) {
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h2>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.id} className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${invoiceSubmitted ? 'bg-gray-50 dark:bg-gray-800' : ''}`}>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg ${method.color} text-white flex items-center justify-center`}>
                        <div className="scale-75">
                          {method.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{method.name}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={method.amount || ''}
                        onChange={(e) => handlePaymentAmountChange(method.id, e.target.value)}
                        placeholder="0.00"
                        disabled={invoiceSubmitted}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales & Tax Charges */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales & Tax Charges</h2>
              <select
                value={selectedSalesTaxCharges}
                onChange={(e) => handleSalesTaxChange(e.target.value)}
                disabled={invoiceSubmitted}
                className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
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
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-6">
              <button
                onClick={handleCompletePayment}
                disabled={outstandingAmount > 0 || invoiceSubmitted}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
              >
                Complete Payment
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleHoldOrder}
                  disabled={invoiceSubmitted}
                  className={`py-3 px-4 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
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
        {/* <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Processing</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div> */}

        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Processing</h2>

  {invoiceSubmitted ? (
    <div className="flex items-center space-x-3">
      <button
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
        title="Print"
        onClick={() => window.print()}
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
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
    >
      <X size={24} />
    </button>
  )}
</div>


        {/* Main Content - Scrollable */}
        <div className="flex flex-1 min-h-0">
          {/* Left Section - Payment Details */}
          <div className="w-2/3 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* Payment Methods */}
            <div>
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
  <div className="flex space-x-4 overflow-x-auto pb-2">
    {paymentMethods.map((method) => (
      <div
        key={method.id}
        className={`min-w-[50%] sm:min-w-[300px] md:min-w-[350px] border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors flex-shrink-0 ${invoiceSubmitted ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
      >
        <div className="flex items-center space-x-3 mb-3">
          <div className={`w-8 h-8 rounded-md ${method.color} text-white flex items-center justify-center`}>
            <div className="scale-75">
              {method.icon}
            </div>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white text-sm">{method.name}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount
          </label>
          <input
            type="number"
            value={method.amount || ''}
            onChange={(e) => handlePaymentAmountChange(method.id, e.target.value)}
            placeholder="0.00"
            disabled={invoiceSubmitted}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
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
                    disabled={invoiceSubmitted}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
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
                      Round Off
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={roundOffAmount.toFixed(2)}
                        onChange={(e) => handleRoundOffChange(e.target.value)}
                        disabled={invoiceSubmitted}
                        className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
                      />
                      <button
                        onClick={handleRoundOff}
                        disabled={invoiceSubmitted}
                        className={`px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
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
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Invoice Preview */}
          {/* Invoice Preview - Scrollable */}
<div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 flex-1 overflow-y-auto custom-scrollbar">
  
  {/* Show PrintPreview if invoice is submitted */}
  {invoiceSubmitted && invoiceData ? (
    <div className="mb-4">
      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">Print Format Preview:</h5>
      <div className="border border-gray-300 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-700">
        {/* Debug version - remove after testing */}
        <DebugPrintPreview invoice={invoiceData} />
        
        {/* Or use regular version */}
        {/* <PrintPreview invoice={invoiceData} /> */}
      </div>
    </div>
  ) : (
    // Regular invoice preview when not submitted
    <>
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

        {/* Payment Methods Used */}
        {Object.entries(paymentAmounts).filter(([, amount]) => amount > 0).length > 0 && (
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
      </div>
    </>
  )}
</div>
        </div>

        {/* Footer - Action Buttons - Always Visible */}

        {invoiceSubmitted ? (
                    
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex justify-end space-x-4">
           
             <button
              onClick={onCompletePayment}
              className="bg-beveren-500 px-6 py-2 border border-gray-300 dark:border-gray-600 text-white dark:text-gray-300 rounded-lg font-medium hover:bg-green-700 dark:hover:bg-gray-800 transition-colors"
            >
              New Order
            </button>

            <button
              onClick={handleCompletePayment}
              disabled={outstandingAmount > 0}
              className="px-8 py-2 bg-gray-600 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Check size={16} />
              <span>Return</span>
            </button>
          </div>
        </div>
            ) : (
                    
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
              disabled={invoiceSubmitted}
              className={`px-6 py-2 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors ${invoiceSubmitted ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Hold Order
            </button>
            <button
              onClick={handleCompletePayment}
              disabled={outstandingAmount > 0 || invoiceSubmitted}
              className="px-8 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Check size={16} />
              <span>Complete Payment</span>
            </button>
          </div>
        </div>
            )}
      
      </div>
    </div>
  )
}