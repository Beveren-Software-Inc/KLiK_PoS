"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Calculator, ChevronDown, Eye, Loader2, MailPlus, MessageCirclePlus, MessageSquarePlus, Printer } from "lucide-react";
import { useCartStore } from "../../stores/cartStore";
import { usePaymentModes } from "../../hooks/usePaymentModes";
import { useSalesTaxCharges } from "../../hooks/useSalesTaxCharges";
import { useDeliveryPersonnel } from "../../hooks/useDeliveryPersonnel";
import { createSalesInvoice, validateCheckoutInvoice } from "../../services/salesInvoice";
import { clearDraftInvoiceCache, getOriginalDraftInvoiceId } from "../../utils/draftInvoiceCache";
import { formatCurrencyWithSymbol, getCurrencySymbol } from "../../utils/currency";
import { calculateRemainingAmount, calculateTotalPayments, roundCurrency, subtractCurrency } from "../../utils/currencyMath";
import { extractErrorFromException } from "../../utils/errorExtraction";
import { fetchWhatsAppTemplates, getDefaultWhatsAppTemplate, processTemplate, getDefaultMessageTemplate } from "../../services/whatsappTemplateService";
import { fetchEmailTemplates, getDefaultEmailTemplate, processEmailTemplate, getDefaultEmailMessageTemplate } from "../../services/emailTemplateService";
import { verifyPin, getRememberedSalesperson, clearRememberedSalesperson } from "../../services/salesPerson";
import { getIconAndColor } from "./paymentIcons";
import PaymentHeader from "./PaymentHeader";
import PaymentMethods from "./PaymentMethods";
import SalesPersonSection from "./SalesPersonSection";
import TaxSection from "./TaxSection";
import TotalsSection from "./TotalsSection";
import ActionButtons from "./ActionButtons";
import InvoicePreview from "./InvoicePreview";
import SharingInterface from "./SharingInterface";
import DeliveryPersonnelModal from "./DeliveryPersonnelModal";
import type { PaymentDialogProps, PaymentAmount, Calculations, BackendTaxPreview } from "./types";
import DisplayPrintPreview from "../../utils/invoicePrint";
import { usePOSProfileStore } from "../../stores/posProfileStore";
import { handlePrintInvoice } from "../../utils/printHandler";

const getDeviceId = () => {
  let device_id = localStorage.getItem("pos_device_id");
  if (!device_id) {
    device_id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("pos_device_id", device_id);
  }
  return device_id;
};

export default function PaymentDialog(props: PaymentDialogProps) {
  const {
    isOpen,
    onClose,
    cartItems,
    appliedCoupons,
    selectedCustomer,
    onHoldOrder,
    isMobile = false,
    isFullPage = false,
    initialSharingMode = null,
    externalInvoiceData = null,
    itemDiscounts = {},
  } = props;

  const [selectedSalesTaxCharges, setSelectedSalesTaxCharges] = useState("");
  const [paymentAmounts, setPaymentAmounts] = useState<PaymentAmount>({});
  const [activeMethodId, setActiveMethodId] = useState<string | null>(null);
  const [lastModifiedMethodId, setLastModifiedMethodId] = useState<string | null>(null);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isHoldingOrder, setIsHoldingOrder] = useState(false);
  const [invoiceSubmitted, setInvoiceSubmitted] = useState(false);
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [submittedInvoice, setSubmittedInvoice] = useState<any>(null);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [roundOffInput, setRoundOffInput] = useState(roundOffAmount.toFixed(2));
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [sharingMode, setSharingMode] = useState<string | null>(initialSharingMode);
  const [sharingData, setSharingData] = useState({
    email: selectedCustomer?.email || "",
    phone: selectedCustomer?.phone || "",
    name: selectedCustomer?.name || "",
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState<any>(null);
  const [emailMessage, setEmailMessage] = useState("");
  const [isLoadingEmailTemplates, setIsLoadingEmailTemplates] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [showDeliveryPersonnelModal, setShowDeliveryPersonnelModal] = useState(false);
  const [selectedDeliveryPersonnel, setSelectedDeliveryPersonnel] = useState<string | null>(null);
  const [currentSalesperson, setCurrentSalesperson] = useState<{ name: string; salesperson_name: string } | null>(null);
  const [salespersonPin, setSalespersonPin] = useState("");
  const [salespersonPinError, setSalespersonPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [rememberSalesperson, setRememberSalesperson] = useState(() => {
    const pref = localStorage.getItem("pos_remember_salesperson");
    return pref === null ? true : pref === "true";
  });
  const [taxPin, setTaxPin] = useState("");
  const [backendTaxPreview, setBackendTaxPreview] = useState<BackendTaxPreview | null>(null);
  const [isTaxPreviewLoading, setIsTaxPreviewLoading] = useState(false);
  const [taxPreviewError, setTaxPreviewError] = useState<string | null>(null);
  const backendTaxPreviewRef = useRef<BackendTaxPreview | null>(null);
  const taxPreviewRequestIdRef = useRef(0);

  const { posDetails, loading: posLoading } = usePOSProfileStore();
  const { modes, isLoading, error } = usePaymentModes(typeof posDetails?.name === "string" ? posDetails.name : "");
  const { salesTaxCharges, defaultTax, isLoading: salesTaxLoading } = useSalesTaxCharges();
  const { personnel: deliveryPersonnelList } = useDeliveryPersonnel();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();

  const isB2B = posDetails?.business_type === "B2B";
  const isB2C = posDetails?.business_type === "B2C";
  const print_receipt_on_order_complete = posDetails?.print_receipt_on_order_complete;
  const deliveryRequiredValue = posDetails?.custom_delivery_required;
  const isDeliveryRequired = deliveryRequiredValue === 1 || deliveryRequiredValue === true || deliveryRequiredValue === "1";
  const allowPartialPayments = Boolean(posDetails?.allow_partial_payment);
  const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required;
  const allow_holding_invoices = Boolean(posDetails?.allow_holding_invoices);
  const autoAllocateRemainingPayment =
    posDetails?.custom_auto_allocate_remaining_payment === 1 ||
    posDetails?.custom_auto_allocate_remaining_payment === "1" ||
    posDetails?.custom_auto_allocate_remaining_payment === true;

  const [enableBackgroundSubmission, setEnableBackgroundSubmission] = useState(
    posDetails?.enable_background_invoice_submission
  );

  useMemo(() => {
    setEnableBackgroundSubmission(posDetails?.enable_background_invoice_submission);
  }, [posDetails?.enable_background_invoice_submission]);

  const displayCurrencySymbol = useMemo(() => {
    const invoiceSymbol = typeof invoiceData?.currency_symbol === "string" ? invoiceData.currency_symbol.trim() : "";
    if (invoiceSymbol) return invoiceSymbol;
    const invoiceCurrency = typeof invoiceData?.currency === "string" ? invoiceData.currency.trim() : "";
    if (invoiceCurrency) return getCurrencySymbol(invoiceCurrency);
    const externalInvoiceSymbol = typeof externalInvoiceData?.currency_symbol === "string" ? externalInvoiceData.currency_symbol.trim() : "";
    if (externalInvoiceSymbol) return externalInvoiceSymbol;
    const externalInvoiceCurrency = typeof externalInvoiceData?.currency === "string" ? externalInvoiceData.currency.trim() : "";
    if (externalInvoiceCurrency) return getCurrencySymbol(externalInvoiceCurrency);
    const companyDefaultCurrency = typeof posDetails?.company?.default_currency === "string" ? posDetails.company.default_currency.trim() : "";
    if (companyDefaultCurrency) return getCurrencySymbol(companyDefaultCurrency);
    const posCurrencySymbol = typeof posDetails?.currency_symbol === "string" ? posDetails.currency_symbol.trim() : "";
    if (posCurrencySymbol) return posCurrencySymbol;
    const posCurrency = typeof posDetails?.currency === "string" ? posDetails.currency.trim() : "";
    if (posCurrency) return getCurrencySymbol(posCurrency);
    return "$";
  }, [invoiceData, externalInvoiceData, posDetails]);

  const calculations: Calculations = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const itemPrice = (item as any).discountedPrice || item.price;
      return sum + itemPrice * item.quantity;
    }, 0);
    const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0);
    const taxableAmount = Math.max(0, subtotal - couponDiscount);
    const selectedTax = salesTaxCharges.find((tax) => tax.id === selectedSalesTaxCharges);
    const taxRate = selectedTax?.rate || 0;
    const isInclusive = selectedTax?.is_inclusive || false;
    let taxAmount: number;
    let grandTotal: number;
    if (isInclusive) {
      taxAmount = (taxableAmount * taxRate) / (100 + taxRate);
      taxAmount = parseFloat(taxAmount.toFixed(2));
      grandTotal = taxableAmount;
    } else {
      taxAmount = (taxableAmount * taxRate) / 100;
      taxAmount = parseFloat(taxAmount.toFixed(2));
      grandTotal = taxableAmount + taxAmount;
    }
    return {
      subtotal,
      couponDiscount,
      taxableAmount,
      taxAmount,
      grandTotal: grandTotal + roundOffAmount,
      selectedTax,
      isInclusive,
    };
  }, [cartItems, appliedCoupons, selectedSalesTaxCharges, salesTaxCharges, roundOffAmount]);

  const totalPaidAmount = calculateTotalPayments(Object.values(paymentAmounts));
  const outstandingAmount = calculateRemainingAmount(calculations.grandTotal, Object.values(paymentAmounts));
  const backendTaxLines = backendTaxPreview?.tax_breakdown || [];
  const hasBackendTaxPreview = backendTaxPreview !== null;
  const hasBackendTaxBreakdown = backendTaxLines.length > 0;
  const displayTaxIsIncluded = hasBackendTaxBreakdown
    ? backendTaxLines.some((line) => Number(line.included_in_print_rate) === 1)
    : calculations.isInclusive;
  const displayTaxTotal = hasBackendTaxPreview
    ? backendTaxPreview?.total_taxes_and_charges || 0
    : calculations.taxAmount;

  const roundOffEnabled = (() => {
    if (!posDetails?.custom_allow_write_off) return false;
    const cashMethods = modes.filter((mode) => mode.type === "Cash");
    const cashMethodsWithAmount = cashMethods.filter((mode) => (paymentAmounts[mode.mode_of_payment] || 0) > 0);
    return cashMethodsWithAmount.length > 0;
  })();

  const toggleCreditSale = () => {
    setIsCreditSale((prev) => {
      if (!prev) setPaymentAmounts({});
      return !prev;
    });
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentMethods = useMemo(() => {
    const sortedModes = [...modes].sort((a, b) => {
      if (a.idx !== undefined && b.idx !== undefined) {
        return a.idx - b.idx;
      }
      if (a.default === 1 && b.default !== 1) return -1;
      if (a.default !== 1 && b.default === 1) return 1;
      return 0;
    });
    return sortedModes.map((mode) => {
      const { icon, color } = getIconAndColor(mode.type || "Default");
      return {
        id: mode.mode_of_payment,
        name: mode.mode_of_payment,
        icon,
        color,
        enabled: true,
        amount: paymentAmounts[mode.mode_of_payment] || 0,
      };
    });
  }, [modes, paymentAmounts]);

  const orderedPaymentMethodIds = useMemo(() => {
    const sortedModes = [...modes].sort((a, b) => {
      if (a.idx !== undefined && b.idx !== undefined) {
        return a.idx - b.idx;
      }
      if (a.default === 1 && b.default !== 1) return -1;
      if (a.default !== 1 && b.default === 1) return 1;
      return 0;
    });

    return sortedModes.map((mode) => mode.mode_of_payment);
  }, [modes]);

  const autoAllocateRemainingToNextMethod = (
    methodId: string,
    baseAmounts: PaymentAmount,
  ): PaymentAmount => {
    if (!autoAllocateRemainingPayment) {
      return baseAmounts;
    }

    const methodIndex = orderedPaymentMethodIds.indexOf(methodId);
    if (methodIndex === -1) {
      return baseAmounts;
    }

    const nextMethodIds = orderedPaymentMethodIds.slice(methodIndex + 1);
    if (nextMethodIds.length === 0) {
      return baseAmounts;
    }

    const updatedAmounts: PaymentAmount = { ...baseAmounts };

    // Reset trailing payment modes so the remainder can be re-apportioned cleanly.
    nextMethodIds.forEach((id) => {
      updatedAmounts[id] = 0;
    });

    const remaining = roundCurrency(
      calculations.grandTotal - calculateTotalPayments(Object.values(updatedAmounts)),
    );

    if (remaining > 0) {
      const nextMethodId = nextMethodIds[0];
      if (nextMethodId) {
        updatedAmounts[nextMethodId] = remaining;
      }
    }

    return updatedAmounts;
  };

  const getRoundTargetMethodId = (): string | null => {
    if (activeMethodId && activeMethodId in paymentAmounts) return activeMethodId;
    if (lastModifiedMethodId && lastModifiedMethodId in paymentAmounts) return lastModifiedMethodId;
    const nonZero = Object.entries(paymentAmounts).filter(([, amt]) => (amt || 0) > 0).map(([id]) => id);
    if (nonZero.length === 1) return nonZero[0] ?? null;
    const defaultId = modes.find((m) => m.default === 1)?.mode_of_payment || null;
    const nonDefaultWithValue = nonZero.find((id) => id !== defaultId);
    if (nonDefaultWithValue) return nonDefaultWithValue;
    return defaultId;
  };

  const handlePaymentAmountChange = (methodId: string, amount: string) => {
    if (invoiceSubmitted || isProcessingPayment) return;
    const numericAmount = roundCurrency(parseFloat(amount) || 0);
    setLastModifiedMethodId(methodId);
    setPaymentAmounts((prev) => {
      const baseAmounts = { ...prev, [methodId]: numericAmount };
      return autoAllocateRemainingToNextMethod(methodId, baseAmounts);
    });
  };

  const handleAutoFillPayment = (methodId: string) => {
    if (invoiceSubmitted || isProcessingPayment) return;
    const newPaymentAmounts: PaymentAmount = {};
    paymentMethods.forEach((method) => { newPaymentAmounts[method.id] = 0; });
    newPaymentAmounts[methodId] = calculations.grandTotal;
    setLastModifiedMethodId(methodId);
    setPaymentAmounts(newPaymentAmounts);
    setActiveMethodId(methodId);
  };

  const handleManualAmountChange = (methodId: string, amount: string) => {
    if (invoiceSubmitted || isProcessingPayment) return;
    const numericAmount = roundCurrency(parseFloat(amount) || 0);
    setLastModifiedMethodId(methodId);
    setPaymentAmounts((prev) => {
      const baseAmounts = { ...prev, [methodId]: numericAmount };
      return autoAllocateRemainingToNextMethod(methodId, baseAmounts);
    });
  };

  const handleRoundOff = () => {
    if (invoiceSubmitted || isProcessingPayment) return;
    if (!posDetails?.custom_allow_write_off) {
      toast.error("Writeoff not allowed. Ask your administrator to enable it in POS profile.");
      return;
    }
    const cashMethods = modes.filter((mode) => mode.type === "Cash");
    const cashMethodsWithAmount = cashMethods.filter((mode) => (paymentAmounts[mode.mode_of_payment] || 0) > 0);
    if (cashMethodsWithAmount.length === 0) {
      toast.error("Writeoff is only allowed for cash payment methods");
      return;
    }
    const totalCashAmount = cashMethodsWithAmount.reduce((sum, mode) => sum + (paymentAmounts[mode.mode_of_payment] || 0), 0);
    if (totalCashAmount === 0) {
      toast.error("Cash payment method must have an amount to apply writeoff");
      return;
    }
    const totalBeforeRoundOff = calculations.isInclusive ? calculations.taxableAmount : calculations.taxableAmount + calculations.taxAmount;
    const writeOffLimit = posDetails?.write_off_limit || 1.0;
    let rounded, difference;
    if (writeOffLimit <= 1) {
      rounded = Math.floor(totalBeforeRoundOff);
      difference = rounded - totalBeforeRoundOff;
    } else {
      rounded = Math.floor(totalBeforeRoundOff / writeOffLimit) * writeOffLimit;
      difference = rounded - totalBeforeRoundOff;
    }
    setRoundOffAmount(difference);
    setRoundOffInput(difference.toFixed(2));
    if (!(isB2B && !isB2C)) {
      const targetId = getRoundTargetMethodId();
      let finalTargetId = targetId;
      if (!finalTargetId && paymentMethods.length > 0) {
        const firstMethod = paymentMethods[0];
        if (firstMethod) finalTargetId = firstMethod.id;
      }
      if (!finalTargetId) {
        const fallbackDefaultFromModes = modes.find((m) => m.default === 1)?.mode_of_payment || modes[0]?.mode_of_payment;
        if (fallbackDefaultFromModes) finalTargetId = fallbackDefaultFromModes;
      }
      if (finalTargetId) {
        const newPaymentAmounts: PaymentAmount = {};
        newPaymentAmounts[finalTargetId] = rounded;
        setPaymentAmounts(newPaymentAmounts);
      }
    }
  };

  const handleRoundOffChange = (value: string) => {
    if (!roundOffEnabled) return;
    let processedValue = value;
    if (value && !value.startsWith("-") && !isNaN(parseFloat(value))) {
      processedValue = "-" + value;
    }
    const parsed = parseFloat(processedValue);
    if (!isNaN(parsed)) {
      const writeOffLimit = posDetails?.write_off_limit || 1.0;
      const maxAllowedRoundoff = writeOffLimit <= 1 ? 0.99 : writeOffLimit - 0.01;
      if (Math.abs(parsed) > maxAllowedRoundoff) {
        toast.error(`Roundoff amount cannot exceed ${maxAllowedRoundoff.toFixed(2)}. Write-off limit is ${writeOffLimit}.`);
        return;
      }
      setRoundOffInput(processedValue);
      setRoundOffAmount(parsed);
      const newGrandTotal = (calculations.isInclusive ? calculations.taxableAmount : calculations.taxableAmount + calculations.taxAmount) + parsed;
      const targetId = getRoundTargetMethodId();
      if (targetId) {
        const sumOthers = Object.entries(paymentAmounts).filter(([id]) => id !== targetId).reduce((sum, [, amt]) => sum + (amt || 0), 0);
        const newTargetAmount = Math.max(0, parseFloat((newGrandTotal - sumOthers).toFixed(2)));
        setPaymentAmounts((prev) => ({ ...prev, [targetId]: newTargetAmount }));
      }
    }
  };

  const handleSalesTaxChange = (value: string) => {
    if (invoiceSubmitted || isProcessingPayment) return;
    setSelectedSalesTaxCharges(value);
  };

  useEffect(() => {
    const requestId = taxPreviewRequestIdRef.current + 1;
    taxPreviewRequestIdRef.current = requestId;

    const fetchBackendTaxPreview = async () => {
      if (!isOpen || invoiceSubmitted || !selectedCustomer?.id || cartItems.length === 0) {
        setBackendTaxPreview(null);
        backendTaxPreviewRef.current = null;
        setTaxPreviewError(null);
        return;
      }

      if (salesTaxLoading) {
        return;
      }

      if (defaultTax && !selectedSalesTaxCharges) {
        return;
      }

      setIsTaxPreviewLoading(true);
      try {
        const payload = {
          customer: { id: selectedCustomer.id },
          items: cartItems.map((item) => {
            const code = item.item_code || item.id;
            const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
            const discountedPrice = (item as { discountedPrice?: number }).discountedPrice;
            return {
              id: code,
              quantity: item.quantity,
              price: discountedPrice || item.price,
              uom: item.uom || "Nos",
              discountPercentage: discountData.discountPercentage || 0,
              discountAmount: discountData.discountAmount || 0,
              bundle_entries: discountData.bundle_entries || [],
            };
          }),
          itemDiscounts,
          SalesTaxCharges: selectedSalesTaxCharges,
          businessType: posDetails?.business_type,
          roundOffAmount,
        };

        const response = await validateCheckoutInvoice(payload);
        if (taxPreviewRequestIdRef.current === requestId) {
          if (response?.tax_preview) {
            setBackendTaxPreview(response.tax_preview);
            backendTaxPreviewRef.current = response.tax_preview;
            setTaxPreviewError(null);
          } else {
            setTaxPreviewError(
              backendTaxPreviewRef.current
                ? "Preview refresh returned no tax details. Showing the last successful preview."
                : "Preview did not return tax details. Showing local estimate."
            );
          }
        }
      } catch (err) {
        if (taxPreviewRequestIdRef.current === requestId) {
          setTaxPreviewError(
            backendTaxPreviewRef.current
              ? extractErrorFromException(err, "Preview refresh failed. Showing the last successful preview.")
              : extractErrorFromException(err, "Preview request failed. Showing local estimate.")
          );
          console.error("Failed to fetch backend tax preview:", err);
        }
      } finally {
        if (taxPreviewRequestIdRef.current === requestId) {
          setIsTaxPreviewLoading(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      fetchBackendTaxPreview();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isOpen,
    invoiceSubmitted,
    selectedCustomer?.id,
    cartItems,
    itemDiscounts,
    selectedSalesTaxCharges,
    defaultTax,
    salesTaxLoading,
    posDetails?.business_type,
    roundOffAmount,
  ]);

  const handleVerifyPin = async () => {
    const pin = salespersonPin.trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setSalespersonPinError("Please enter a valid 4-digit PIN");
      return;
    }
    setIsVerifyingPin(true);
    setSalespersonPinError("");
    try {
      const result = await verifyPin(pin, getDeviceId());
      if (result?.success) {
        setCurrentSalesperson({ name: result.salesperson, salesperson_name: result.salesperson_name });
        setSalespersonPin("");
        toast.success(`Welcome, ${result.salesperson_name}!`);
        if (!rememberSalesperson) {
          try {
            await clearRememberedSalesperson(getDeviceId());
          } catch (err) {
            console.error("Error clearing remembered salesperson:", err);
          }
        }
      } else {
        setSalespersonPinError(result?.message || "Invalid PIN. Please try again.");
        setSalespersonPin("");
      }
    } catch (err: any) {
      setSalespersonPinError(err?.message || "An error occurred. Please try again.");
      setSalespersonPin("");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleClearSalesperson = async () => {
    setCurrentSalesperson(null);
    setSalespersonPin("");
    setSalespersonPinError("");
    try {
      await clearRememberedSalesperson(getDeviceId());
    } catch (err) {
      console.error("Error clearing remembered salesperson:", err);
    }
  };

  const handleRememberSalespersonChange = async (checked: boolean) => {
    setRememberSalesperson(checked);
    localStorage.setItem("pos_remember_salesperson", String(checked));
    if (!checked) {
      setCurrentSalesperson(null);
      setSalespersonPin("");
      try {
        await clearRememberedSalesperson(getDeviceId());
      } catch (err) {
        console.error("Error clearing remembered salesperson:", err);
      }
    }
  };

  const processPayment = async (deliveryPersonnel: string | null = null) => {
    if (!selectedCustomer || !selectedCustomer.name) {
      toast.error("Kindly select a customer");
      return;
    }
    if (!isCreditSale) {
      const totalPaid = calculateTotalPayments(Object.values(paymentAmounts));
      const orderTotal = calculations.grandTotal;
      
      if (totalPaid < orderTotal) {
        const remainingAmount = orderTotal - totalPaid;
        toast.error(`Insufficient payment. Total: ${formatCurrencyWithSymbol(orderTotal, displayCurrencySymbol)}, Paid: ${formatCurrencyWithSymbol(totalPaid, displayCurrencySymbol)}, Remaining: ${formatCurrencyWithSymbol(remainingAmount, displayCurrencySymbol)}`);
        return;
      }
      
      if (totalPaid > orderTotal && !posDetails?.allow_overpayment) {
        const overpayAmount = totalPaid - orderTotal;
        toast.error(`Overpayment not allowed. Please adjust payment amounts. Overpayment: ${formatCurrencyWithSymbol(overpayAmount, displayCurrencySymbol)}`);
        return;
      }
    }
    if (isCreditSale && !dueDate) {
      toast.error("Please select a due date for this credit sale");
      return;
    }
    if (isB2C && !isCreditSale) {
      const activePaymentMethods = Object.entries(paymentAmounts).filter(([, amount]) => amount > 0);
      if (activePaymentMethods.length === 0) {
        toast.error("Please enter payment amounts");
        return;
      }
      if (outstandingAmount > 0) {
        toast.error("Please complete the payment before proceeding");
        return;
      }
    }
    setIsProcessingPayment(true);
    const netAmountToSend = isB2B ? totalPaidAmount : calculations.grandTotal;
    const adjustedPaymentMethods = isB2B
      ? Object.entries(paymentAmounts).filter(([, amount]) => amount > 0)
      : (() => {
          const validPayments = Object.entries(paymentAmounts).filter(([, amount]) => amount > 0);
          if (validPayments.length === 0) return [];
          const totalPaymentAmount = validPayments.reduce((sum, [, amount]) => sum + amount, 0);
          if (totalPaymentAmount > calculations.grandTotal) {
            const excess = totalPaymentAmount - calculations.grandTotal;
            const lastPaymentIndex = validPayments.length - 1;
            const lastPayment = validPayments[lastPaymentIndex];
            if (!lastPayment) return [];
            const [, lastAmount] = lastPayment;
            const adjustedLastAmount = parseFloat(Math.max(0, lastAmount - excess).toFixed(2));
            return validPayments.map(([method, amount], index) => {
              if (index === lastPaymentIndex) return [method, adjustedLastAmount];
              return [method, amount];
            });
          }
          return validPayments;
        })();
    const paymentData = {
      items: cartItems.map((item) => {
        const code = item.item_code || item.id;
        const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
        return {
          ...item,
          id: item.item_code || item.id,
          item_code: item.item_code || item.id,
          price: (item as any).discountedPrice || item.price,
          uom: item.uom || "Nos",
          discountPercentage: discountData.discountPercentage || 0,
          discountAmount: discountData.discountAmount || 0,
          serial_batch_bundle: discountData.serial_batch_bundle || null,
        };
      }),
      customer: selectedCustomer,
      paymentMethods: (adjustedPaymentMethods ?? []).map(([method, amount]) => ({
        method,
        amount: parseFloat((Number(amount) || 0).toFixed(2)),
      })),
      subtotal: calculations.subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount: calculations.taxAmount,
      taxType: calculations.isInclusive ? "inclusive" : "exclusive",
      couponDiscount: calculations.couponDiscount,
      roundOffAmount,
      grandTotal: calculations.grandTotal,
      amountPaid: netAmountToSend,
      outstandingAmount: outstandingAmount,
      appliedCoupons,
      businessType: posDetails?.business_type,
      deliveryPersonnel: deliveryPersonnel || null,
      isCreditSale,
      dueDate: isCreditSale ? dueDate : null,
      is_credit_sale: isCreditSale,
      due_date: isCreditSale ? dueDate : null,
      allowPartialPayment: allowPartialPayments,
      allow_partial_payment: allowPartialPayments,
      salesperson: currentSalesperson?.name || null,
      tax_id: taxPin || null,
    };
    try {
      const response = await createSalesInvoice({
        ...paymentData,
        enable_background_invoice_submission: enableBackgroundSubmission
      });
      setInvoiceSubmitted(true);
      setSubmittedInvoice(response);
      setInvoiceData(response.invoice);
      toast.success(enableBackgroundSubmission ? "Invoice queued for background submission!" : "Invoice submitted successfully!");
      const originalDraftInvoiceId = getOriginalDraftInvoiceId();
      if (originalDraftInvoiceId) {
        try {
        } catch (deleteError) {
          console.error("Failed to delete original draft invoice:", deleteError);
        }
      }
      clearDraftInvoiceCache();
    } catch (err: any) {
      const defaultMessage = isB2B ? "Failed to submit invoice" : "Failed to process payment";
      const errorMessage = extractErrorFromException(err, defaultMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCompletePayment = async () => {
    if (requiresSalespersonPin && !currentSalesperson) {
      toast.error("Please verify your salesperson PIN before completing payment");
      return;
    }
    await processPayment(selectedDeliveryPersonnel);
  };

  const handleHoldOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer");
      return;
    }
    setIsHoldingOrder(true);
    const orderData = {
      items: cartItems,
      customer: selectedCustomer,
      subtotal: calculations.subtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount: calculations.taxAmount,
      taxType: calculations.isInclusive ? "inclusive" : "exclusive",
      couponDiscount: calculations.couponDiscount,
      roundOffAmount,
      grandTotal: calculations.grandTotal,
      appliedCoupons,
      status: "held",
      businessType: posDetails?.business_type,
      salesperson: currentSalesperson?.name || null,
      tax_id: taxPin || null,
    };
    try {
      onHoldOrder(orderData);
    } catch (err: any) {
      const errorMessage = extractErrorFromException(err, "Failed to hold order");
      toast.error(errorMessage);
    } finally {
      setIsHoldingOrder(false);
    }
  };

  const handleEditOrder = () => {
    onClose(false);
  };

  const handleViewInvoice = (invoice: any) => {
    clearOrderState();
    navigate(`/invoice/${invoice.name}`);
  };

  const clearOrderState = () => {
    clearDraftInvoiceCache();
    clearCart();
  };

  const getActionButtonText = () => {
    if (isProcessingPayment) return isB2B ? "Submitting Invoice..." : "Processing Payment...";
    return "Submit";
  };

  const isActionButtonDisabled = () => {
    if (invoiceSubmitted || isProcessingPayment) return true;
    if (isCreditSale && !dueDate) return true;
    if (isB2C && !isCreditSale) return outstandingAmount > 0;
    return false;
  };

  const getProcessedMessage = () => {
    const parameters: Record<string, string> = {
      customer_name: sharingData.name || "there",
      invoice_total: formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol),
      invoice_number: invoiceData?.name || "",
      company_name: "KLiK PoS",
      date: new Date().toLocaleDateString(),
    };
    return processTemplate(customMessage, parameters);
  };

  const getProcessedEmailMessage = () => {
    const parameters: Record<string, string | null> = {
      customer_name: sharingData.name || "Customer",
      customer: sharingData.name || "Customer",
      first_name: sharingData.name?.split(" ")[0] || "",
      last_name: sharingData.name?.split(" ").slice(1).join(" ") || "",
      address: typeof selectedCustomer?.address === "string" ? selectedCustomer.address : JSON.stringify(selectedCustomer?.address || {}),
      customer_address: typeof selectedCustomer?.address === "string" ? selectedCustomer.address : JSON.stringify(selectedCustomer?.address || {}),
      delivery_note: invoiceData?.name || "",
      grand_total: formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol),
      departure_time: new Date().toLocaleTimeString(),
      estimated_arrival: new Date(Date.now() + 30 * 60000).toLocaleTimeString(),
      driver_name: "Delivery Driver",
      cell_number: "+1234567890",
      vehicle: "Delivery Vehicle",
      invoice_total: formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol),
      invoice_number: invoiceData?.name || "",
      company_name: "KLiK PoS",
      date: new Date().toLocaleDateString(),
    };
    return processEmailTemplate(emailMessage, parameters);
  };

  const fetchCustomerDetails = async (customerId: string, existingEmail: string, existingPhone: string, existingName: string) => {
    try {
      const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_info?customer_name=${customerId}`);
      const data = await response.json();
      if (data.message) {
        const customerData = data.message;
        setSharingData({
          email: existingEmail || customerData.email_id || "",
          phone: existingPhone || customerData.mobile_no || "",
          name: existingName || customerData.customer_name || customerData.name || "",
        });
      } else {
        setSharingData({ email: existingEmail, phone: existingPhone, name: existingName });
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
      setSharingData({ email: existingEmail, phone: existingPhone, name: existingName });
    }
  };

  useEffect(() => {
    if (!isOpen || !requiresSalespersonPin) return;
    const pref = localStorage.getItem("pos_remember_salesperson");
    const shouldRemember = pref === null ? true : pref === "true";
    if (!shouldRemember || currentSalesperson) return;
    setIsVerifyingPin(true);
    (async () => {
      try {
        const result = await getRememberedSalesperson(getDeviceId());
        if (result?.success) {
          setCurrentSalesperson({ name: result.salesperson, salesperson_name: result.salesperson_name });
        }
      } catch (err) {
        console.error("Error fetching remembered salesperson:", err);
      } finally {
        setIsVerifyingPin(false);
      }
    })();
  }, [isOpen, requiresSalespersonPin]);

  useEffect(() => {
    if (isOpen && !dueDate) {
      const today = new Date().toISOString().split("T")[0];
      setDueDate(today);
    }
  }, [isOpen, dueDate]);

  useEffect(() => {
    if (isOpen) setTaxPin("");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && defaultTax && !selectedSalesTaxCharges) {
      setSelectedSalesTaxCharges(defaultTax);
    }
  }, [isOpen, defaultTax, selectedSalesTaxCharges]);

  useEffect(() => {
    if (isOpen && modes.length > 0 && !isCreditSale) {
      const defaultMode = modes.find((mode) => mode.default === 1);
      if (defaultMode && Object.keys(paymentAmounts).length === 0) {
        const defaultAmount = parseFloat(calculations.grandTotal.toFixed(2));
        setLastModifiedMethodId(defaultMode.mode_of_payment);
        setPaymentAmounts({ [defaultMode.mode_of_payment]: defaultAmount });
      }
    }
  }, [isOpen, modes, calculations.grandTotal, isB2B, isB2C, paymentAmounts, isCreditSale]);

  useEffect(() => {
    if (modes.length > 0 && Object.keys(paymentAmounts).length > 0) {
      const defaultMode = modes.find((mode) => mode.default === 1);
      if (defaultMode) {
        const totalPayments = Object.values(paymentAmounts).reduce((sum, amount) => sum + (amount || 0), 0);
        const excess = totalPayments - calculations.grandTotal;
        const paymentEntries = Object.entries(paymentAmounts);
        const highestAmountMethod = paymentEntries.reduce((max, current) => (current[1] || 0) > (max[1] || 0) ? current : max);
        const [highestMethodId, highestAmount] = highestAmountMethod;
        if (highestAmount > 0 && excess > 0) {
          const newAmount = Math.max(0, highestAmount - excess);
          setPaymentAmounts((prev) => ({ ...prev, [highestMethodId]: newAmount }));
        }
      }
    }
  }, [calculations.grandTotal, modes, isB2C, isB2B, paymentAmounts]);

  useEffect(() => {
    if (invoiceSubmitted && invoiceData && print_receipt_on_order_complete) {
      setIsAutoPrinting(true);
      setTimeout(() => {
        handlePrintInvoice(invoiceData, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting) });
        setIsAutoPrinting(false);
      }, 500);
    }
  }, [invoiceSubmitted, invoiceData, print_receipt_on_order_complete]);

  useEffect(() => {
    if (!roundOffEnabled && roundOffAmount !== 0) {
      setRoundOffAmount(0);
      setRoundOffInput("0.00");
    }
  }, [roundOffEnabled, roundOffAmount]);

  useEffect(() => {
    if (externalInvoiceData && sharingMode) {
      const email = externalInvoiceData.customer_address_doc?.email_id || externalInvoiceData.customer_email || externalInvoiceData.email_id || "";
      const phone = externalInvoiceData.mobile_no || externalInvoiceData.customer_address_doc?.mobile_no || externalInvoiceData.customer_address_doc?.phone || externalInvoiceData.customer_phone || "";
      const name = externalInvoiceData.customer_name || externalInvoiceData.customer || "";
      if ((!email || !phone) && externalInvoiceData.customer) {
        fetchCustomerDetails(externalInvoiceData.customer, email, phone, name);
      } else {
        setSharingData({ email, phone, name });
      }
    }
  }, [externalInvoiceData, sharingMode]);
  

  useEffect(() => {
    const loadWhatsAppTemplates = async () => {
      if (sharingMode === "whatsapp" && whatsappTemplates.length === 0) {
        setIsLoadingTemplates(true);
        try {
          const [templates, defaultTemplateName] = await Promise.all([fetchWhatsAppTemplates(), getDefaultWhatsAppTemplate()]);
          setWhatsappTemplates(templates);
          if (defaultTemplateName) {
            const defaultTemplate = templates.find((t) => t.name === defaultTemplateName);
            if (defaultTemplate) {
              setSelectedTemplate(defaultTemplate);
              setCustomMessage(defaultTemplate.template);
            }
          } else {
            setCustomMessage(getDefaultMessageTemplate());
          }
        } catch (error) {
          console.error("Error loading WhatsApp templates:", error);
          setCustomMessage(getDefaultMessageTemplate());
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    loadWhatsAppTemplates();
  }, [sharingMode, whatsappTemplates.length]);

  useEffect(() => {
    const loadEmailTemplates = async () => {
      if (sharingMode === "email" && emailTemplates.length === 0) {
        setIsLoadingEmailTemplates(true);
        try {
          const [templates, defaultTemplateName] = await Promise.all([fetchEmailTemplates(), getDefaultEmailTemplate()]);
          setEmailTemplates(templates);
          if (defaultTemplateName) {
            const defaultTemplate = templates.find((t) => t.name === defaultTemplateName);
            if (defaultTemplate) {
              setSelectedEmailTemplate(defaultTemplate);
              setEmailMessage(defaultTemplate.response_html || defaultTemplate.response);
            }
          } else {
            setEmailMessage(getDefaultEmailMessageTemplate());
          }
        } catch (error) {
          console.error("Error loading Email templates:", error);
          setEmailMessage(getDefaultEmailMessageTemplate());
        } finally {
          setIsLoadingEmailTemplates(false);
        }
      }
    };
    loadEmailTemplates();
  }, [sharingMode, emailTemplates.length]);

  const handleTemplateChange = (templateName: string) => {
    const template = whatsappTemplates.find((t) => t.name === templateName);
    if (template) {
      setSelectedTemplate(template);
      setCustomMessage(template.template);
    }
  };

  const handleEmailTemplateChange = (templateName: string) => {
    const template = emailTemplates.find((t) => t.name === templateName);
    if (template) {
      setSelectedEmailTemplate(template);
      setEmailMessage(template.response_html || template.response);
    }
  };

  const getSelectedDeliveryPersonnelName = () => {
    if (!selectedDeliveryPersonnel) return null;
    const person = deliveryPersonnelList.find((p) => p.name === selectedDeliveryPersonnel);
    return person?.delivery_personnel || selectedDeliveryPersonnel;
  };

  if (!isOpen) return null;
  if (isLoading || posLoading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  if (isMobile) {
    return (
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-900 overflow-y-auto custom-scrollbar" : "fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto custom-scrollbar"}>
        <div className="min-h-screen">
          {!isFullPage && (
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {invoiceSubmitted ? "Invoice Queued" : isB2B ? "Submit Invoice" : "Payment"}
              </h1>
            </div>
          )}
          <div className="p-4 space-y-6">
            {invoiceSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-green-600 dark:text-green-400 text-center">
                    <p className="font-semibold">Invoice queued for background submission!</p>
                    <p className="text-sm opacity-75">Total: {formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {isAutoPrinting && (
                    <div className="flex items-center space-x-2 text-blue-600 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Printing...</span>
                    </div>
                  )}
                  <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onClick={() => { handlePrintInvoice(invoiceData, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting) }); clearOrderState(); }}>
                    <Printer size={18} />
                    <span>Print</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors" onClick={() => { clearOrderState(); window.open(`mailto:${selectedCustomer?.email}?subject=Your%20Invoice&body=Dear%20${selectedCustomer?.name},%0A%0AHere%20is%20your%20invoice%20total:%20${formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}%0A%0AThank%20you.`); }}>
                    <MailPlus size={18} />
                    <span>Email</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-beveren-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors" onClick={() => { window.open(`https://wa.me/${selectedCustomer?.phone}?text=${encodeURIComponent(`Here is your invoice total: ${formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}`)}`, "_blank"); }}>
                    <MessageCirclePlus size={18} />
                    <span>WhatsApp</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-teal-900/20 text-teal-500 dark:text-teal-400 rounded-lg hover:bg-teal-200 dark:hover:bg-purple-900/30 transition-colors" onClick={() => window.open(`tel:${selectedCustomer?.phone}`)}>
                    <MessageSquarePlus size={18} />
                    <span>SMS</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-p-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors" onClick={() => handleViewInvoice(invoiceData)}>
                    <Eye size={18} />
                    <span>View</span>
                  </button>
                </div>
                {invoiceData && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">Invoice Preview:</h4>
                    <div className="border border-gray-300 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto">
                      <DisplayPrintPreview invoice={invoiceData} />
                    </div>
                  </div>
                )}
                <div className="pt-4">
                  <button onClick={() => { clearOrderState(); onClose(true); }} className="w-full py-3 bg-beveren-600 text-white rounded-lg font-medium hover:bg-beveren-700 transition-colors">
                    Start New Order
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h2>
                  </div>
                  <div className="flex space-x-3 overflow-x-auto pb-2">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className={`${paymentMethods.length <= 3 ? "flex-1 min-w-0" : "min-w-[280px] max-w-[280px] flex-shrink-0"} border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors ${invoiceSubmitted || isProcessingPayment ? "bg-gray-50 dark:bg-gray-800" : ""}`}>
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
                          <input type="number" value={method.amount.toFixed(2) || ""} onChange={(e) => handlePaymentAmountChange(method.id, e.target.value)} placeholder="0.00" disabled={invoiceSubmitted || isProcessingPayment} className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {allowPartialPayments && (
                  <div className="space-y-3 pt-2">
                    <button type="button" onClick={() => toggleCreditSale()} disabled={invoiceSubmitted || isProcessingPayment} className={`w-full py-3 rounded-lg font-medium transition-colors ${isCreditSale ? "bg-teal-600 text-white dark:bg-teal-500" : "bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/60"} ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}>
                      {isCreditSale ? "Credit Sale Enabled" : "Is Credit Sale"}
                    </button>
                    {isCreditSale && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} disabled={invoiceSubmitted || isProcessingPayment} className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`} />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Round Off</label>
                      <div className="flex space-x-2">
                        <input type="number" value={roundOffInput} onChange={(e) => handleRoundOffChange(e.target.value)} disabled={invoiceSubmitted || isProcessingPayment || !roundOffEnabled} placeholder="-0.00" className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment || !roundOffEnabled ? "cursor-not-allowed opacity-50" : ""}`} />
                        <button onClick={handleRoundOff} disabled={invoiceSubmitted || isProcessingPayment || !roundOffEnabled} className={`px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors ${invoiceSubmitted || isProcessingPayment || !roundOffEnabled ? "cursor-not-allowed opacity-50" : ""}`} title="Auto Round">
                          <Calculator size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyWithSymbol(calculations.subtotal, displayCurrencySymbol)}</span>
                  </div>
                  {calculations.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrencyWithSymbol(calculations.couponDiscount, displayCurrencySymbol)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tax ({calculations.selectedTax?.rate}% {displayTaxIsIncluded ? "Incl." : "Excl."})</span>
                    <span className={`font-medium ${displayTaxIsIncluded ? "text-beveren-600 dark:text-beveren-400" : "text-gray-900 dark:text-white"}`}>
                      {displayTaxIsIncluded
                        ? `(${formatCurrencyWithSymbol(displayTaxTotal, displayCurrencySymbol)})`
                        : formatCurrencyWithSymbol(displayTaxTotal, displayCurrencySymbol)}
                    </span>
                  </div>
                  {(isTaxPreviewLoading || hasBackendTaxPreview) && (
                    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 space-y-1">
                      {isTaxPreviewLoading ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Calculating tax breakdown...</div>
                      ) : !hasBackendTaxBreakdown ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">ERPNext returned a tax total for this checkout, but no line-level breakdown rows were provided.</div>
                      ) : (
                        backendTaxLines.map((taxLine, index) => (
                          <div key={`${taxLine.account_head || taxLine.description || "tax"}-${index}`} className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-300">{taxLine.description || taxLine.account_head || "Tax"}</span>
                            <span className="text-gray-900 dark:text-white">
                              {Number(taxLine.included_in_print_rate) === 1
                                ? `(${formatCurrencyWithSymbol(Number(taxLine.tax_amount) || 0, displayCurrencySymbol)})`
                                : formatCurrencyWithSymbol(Number(taxLine.tax_amount) || 0, displayCurrencySymbol)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {roundOffAmount !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Round Off</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyWithSymbol(roundOffAmount, displayCurrencySymbol)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">Grand Total</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}</span>
                    </div>
                  </div>
                  {(isB2C || isB2B) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
                        <span className="font-medium text-beveren-600 dark:text-blue-400">{formatCurrencyWithSymbol(totalPaidAmount, displayCurrencySymbol)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Outstanding</span>
                        <span className="font-medium text-red-600 dark:text-red-400">{formatCurrencyWithSymbol(outstandingAmount, displayCurrencySymbol)}</span>
                      </div>
                      {totalPaidAmount > calculations.grandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-medium text-beveren-600 dark:text-beveren-400">{formatCurrencyWithSymbol(subtractCurrency(totalPaidAmount, calculations.grandTotal), displayCurrencySymbol)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-6">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={enableBackgroundSubmission}
                        onChange={(e) => setEnableBackgroundSubmission(e.target.checked)}
                        disabled={invoiceSubmitted || isProcessingPayment}
                        className="w-5 h-5 rounded border-gray-300 text-beveren-600 focus:ring-beveren-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                          Submit Invoice in Background
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Process invoice without waiting for response
                        </span>
                      </div>
                    </label>
                  </div>
                  <button onClick={handleCompletePayment} disabled={isActionButtonDisabled()} className={`w-full py-4 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 ${isB2B ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                    {isProcessingPayment ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>{getActionButtonText()}</span>
                      </>
                    ) : (
                      <span>{getActionButtonText()}</span>
                    )}
                  </button>

                  <div className={`grid ${allow_holding_invoices ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                    <button
                      onClick={() => onClose(false)}
                      disabled={isProcessingPayment || isHoldingOrder}
                      className="py-3 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Cancel</span>
                    </button>
                    {allow_holding_invoices && (
                      <button onClick={handleHoldOrder} disabled={invoiceSubmitted || isProcessingPayment || isHoldingOrder} className={`py-3 px-4 border border-orange-500 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center justify-center space-x-2 ${invoiceSubmitted || isProcessingPayment || isHoldingOrder ? "cursor-not-allowed opacity-50" : ""}`}>
                        {isHoldingOrder ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Holding...</span>
                          </>
                        ) : (
                          <span>Hold</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        <PaymentHeader
          invoiceSubmitted={invoiceSubmitted}
          isAutoPrinting={isAutoPrinting}
          invoiceData={invoiceData}
          sharingMode={sharingMode}
          setSharingMode={setSharingMode}
          isProcessingPayment={isProcessingPayment}
          isHoldingOrder={isHoldingOrder}
          onClose={onClose}
          handleViewInvoice={handleViewInvoice}
          clearOrderState={clearOrderState}
          navigate={navigate}
          posDetails={posDetails}
        />

        <div className="flex flex-1 min-h-0">
          <div className="w-2/3 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {invoiceSubmitted && sharingMode ? (
              <SharingInterface
                sharingMode={sharingMode}
                sharingData={sharingData}
                setSharingData={setSharingData}
                invoiceData={invoiceData}
                calculations={calculations}
                displayCurrencySymbol={displayCurrencySymbol}
                whatsappTemplates={whatsappTemplates}
                selectedTemplate={selectedTemplate}
                customMessage={customMessage}
                isLoadingTemplates={isLoadingTemplates}
                isEditingWhatsapp={isEditingWhatsapp}
                setIsEditingWhatsapp={setIsEditingWhatsapp}
                setSelectedTemplate={setSelectedTemplate}
                setCustomMessage={setCustomMessage}
                emailTemplates={emailTemplates}
                selectedEmailTemplate={selectedEmailTemplate}
                emailMessage={emailMessage}
                isLoadingEmailTemplates={isLoadingEmailTemplates}
                isEditingEmail={isEditingEmail}
                setIsEditingEmail={setIsEditingEmail}
                setSelectedEmailTemplate={setSelectedEmailTemplate}
                setEmailMessage={setEmailMessage}
                isSendingEmail={isSendingEmail}
                setIsSendingEmail={setIsSendingEmail}
                isSendingWhatsapp={isSendingWhatsapp}
                setIsSendingWhatsapp={setIsSendingWhatsapp}
                setSharingMode={setSharingMode}
                posDetails={posDetails}
                getProcessedMessage={getProcessedMessage}
                getProcessedEmailMessage={getProcessedEmailMessage}
                handleTemplateChange={handleTemplateChange}
                handleEmailTemplateChange={handleEmailTemplateChange}
              />
            ) : (
              <>
                <PaymentMethods
                  paymentMethods={paymentMethods}
                  invoiceSubmitted={invoiceSubmitted}
                  isProcessingPayment={isProcessingPayment}
                  onAmountChange={handleManualAmountChange}
                  onAutoFill={handleAutoFillPayment}
                  setActiveMethodId={setActiveMethodId}
                />

                {allowPartialPayments && (
                  <div className="space-y-3">
                    <button type="button" onClick={() => toggleCreditSale()} disabled={invoiceSubmitted || isProcessingPayment} className={`w-full py-3 rounded-lg font-medium transition-colors ${isCreditSale ? "bg-teal-600 text-white dark:bg-teal-500" : "bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/60"} ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}>
                      {isCreditSale ? "Credit Sale Enabled" : "Is Credit Sale"}
                    </button>
                    {isCreditSale && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} disabled={invoiceSubmitted || isProcessingPayment} className={`w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-white dark:bg-red-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`} />
                      </div>
                    )}
                  </div>
                )}

                <TaxSection
                  selectedCustomer={selectedCustomer}
                  invoiceSubmitted={invoiceSubmitted}
                  isProcessingPayment={isProcessingPayment}
                  taxPin={taxPin}
                  onTaxPinChange={setTaxPin}
                  selectedSalesTaxCharges={selectedSalesTaxCharges}
                  onTaxChange={handleSalesTaxChange}
                  salesTaxCharges={salesTaxCharges}
                  calculations={calculations}
                  displayCurrencySymbol={displayCurrencySymbol}
                  backendTaxPreview={backendTaxPreview}
                  isTaxPreviewLoading={isTaxPreviewLoading}
                  taxPreviewError={taxPreviewError}
                />

                <SalesPersonSection
                  requiresSalespersonPin={requiresSalespersonPin}
                  invoiceSubmitted={invoiceSubmitted}
                  currentSalesperson={currentSalesperson}
                  isVerifyingPin={isVerifyingPin}
                  salespersonPin={salespersonPin}
                  salespersonPinError={salespersonPinError}
                  rememberSalesperson={rememberSalesperson}
                  onPinChange={setSalespersonPin}
                  onVerifyPin={handleVerifyPin}
                  onClearSalesperson={handleClearSalesperson}
                  onRememberChange={handleRememberSalespersonChange}
                />

                <TotalsSection
                  calculations={calculations}
                  roundOffAmount={roundOffAmount}
                  roundOffInput={roundOffInput}
                  roundOffEnabled={roundOffEnabled}
                  invoiceSubmitted={invoiceSubmitted}
                  isProcessingPayment={isProcessingPayment}
                  totalPaidAmount={totalPaidAmount}
                  outstandingAmount={outstandingAmount}
                  displayCurrencySymbol={displayCurrencySymbol}
                  isB2B={isB2B}
                  isB2C={isB2C}
                  backendTaxPreview={backendTaxPreview}
                  taxPreviewError={taxPreviewError}
                  onRoundOffChange={handleRoundOffChange}
                  onRoundOff={handleRoundOff}
                />
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-600 flex-1 overflow-y-auto custom-scrollbar">
            <InvoicePreview
              invoiceSubmitted={invoiceSubmitted}
              invoiceData={invoiceData}
              submittedInvoice={submittedInvoice}
              externalInvoiceData={externalInvoiceData}
              selectedCustomer={selectedCustomer}
              cartItems={cartItems}
              calculations={calculations}
              roundOffAmount={roundOffAmount}
              paymentAmounts={paymentAmounts}
              displayCurrencySymbol={displayCurrencySymbol}
              isB2B={isB2B}
              isB2C={isB2C}
              currentDate={currentDate}
              backendTaxPreview={backendTaxPreview}
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between gap-4">
            {isDeliveryRequired && (
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delivery Personnel</label>
                <button type="button" onClick={() => setShowDeliveryPersonnelModal(true)} disabled={invoiceSubmitted || isProcessingPayment} className={`w-full px-4 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  <span>{getSelectedDeliveryPersonnelName() || <span className="text-gray-500 dark:text-gray-400">Select Delivery Personnel</span>}</span>
                  <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2" />
                </button>
              </div>
            )}
            <div className={`flex items-center gap-4 ${isDeliveryRequired ? "" : "w-full justify-between"}`}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enableBackgroundSubmission}
                    onChange={(e) => setEnableBackgroundSubmission(e.target.checked)}
                    disabled={invoiceSubmitted || isProcessingPayment}
                    className="w-4 h-4 rounded border-gray-300 text-beveren-600 focus:ring-beveren-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Submit Invoice in Background
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Process invoice without waiting for response
                  </span>
                </div>
              </label>
              <div className="flex items-center gap-3">
               <ActionButtons
                  invoiceSubmitted={invoiceSubmitted}
                  isProcessingPayment={isProcessingPayment}
                  isHoldingOrder={isHoldingOrder}
                  isActionButtonDisabled={isActionButtonDisabled}
                  getActionButtonText={getActionButtonText}
                  onCompletePayment={handleCompletePayment}
                  onHoldOrder={handleHoldOrder}
                  onEditOrder={handleEditOrder}
                  onNewOrder={() => { clearOrderState(); onClose(true); }}
                  isB2B={isB2B}
                  allow_holding_invoices={allow_holding_invoices}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeliveryPersonnelModal
        isOpen={showDeliveryPersonnelModal}
        onClose={() => setShowDeliveryPersonnelModal(false)}
        onSelect={(name) => setSelectedDeliveryPersonnel(name)}
      />
    </div>
  );
}