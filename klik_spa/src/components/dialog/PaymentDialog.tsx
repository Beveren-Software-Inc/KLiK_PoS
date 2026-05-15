"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Calculator, ChevronDown, Eye, Loader2, MailPlus, MessageCirclePlus, MessageSquarePlus, Printer } from "lucide-react";
import { useCartStore } from "../../stores/cartStore";
import { usePaymentModes } from "../../hooks/usePaymentModes";
import { useSalesTaxCharges } from "../../hooks/useSalesTaxCharges";
import { useDeliveryPersonnel } from "../../hooks/useDeliveryPersonnel";
import {
  createDraftSalesInvoice,
  createSalesInvoice,
  submitDraftInvoice,
  validateCheckoutInvoice,
} from "../../services/salesInvoice";
import { clearDraftInvoiceCache, getOriginalDraftInvoiceId } from "../../utils/draftInvoiceCache";
import { formatCurrencyWithSymbol, getCurrencySymbol } from "../../utils/currency";
import { calculateRemainingAmount, calculateTotalPayments, roundCurrency, subtractCurrency } from "../../utils/currencyMath";
import { extractErrorFromException } from "../../utils/errorExtraction";
import { fetchWhatsAppTemplates, getDefaultWhatsAppTemplate, processTemplate, getDefaultMessageTemplate } from "../../services/whatsappTemplateService";
import { fetchEmailTemplates, getDefaultEmailTemplate, processEmailTemplate, getDefaultEmailMessageTemplate } from "../../services/emailTemplateService";
import { getIconAndColor } from "./paymentIcons";
import PaymentHeader from "./PaymentHeader";
import PaymentMethods from "./PaymentMethods";
import SalesPersonSection from "./SalesPersonSection";
import SalespersonAuthModal from "./SalespersonAuthModal";
import TaxSection from "./TaxSection";
import TotalsSection from "./TotalsSection";
import ActionButtons from "./ActionButtons";
import InvoicePreview from "./InvoicePreview";
import SharingInterface from "./SharingInterface";
import DeliveryPersonnelModal from "./DeliveryPersonnelModal";
import MpesaOptionsModal from "./MpesaOptionsModal";
import type { PaymentDialogProps, PaymentAmount, Calculations, BackendTaxPreview } from "./types";
import DisplayPrintPreview from "../../utils/invoicePrint";
import { usePOSProfileStore } from "../../stores/posProfileStore";
import { handlePrintInvoice } from "../../utils/printHandler";
import { useSalespersonStore } from "../../stores/salespersonStore";
import {
  getEffectiveDisplayRate as getSharedEffectiveDisplayRate,
  getEffectiveItemRate as getSharedEffectiveItemRate,
} from "../../utils/cartPricing";
import {
  fetchKlikPosStkStatus,
  fetchMpesaRegisterPayments,
  initiateKlikPosStkPush,
  processKlikPosMpesaPayments,
  type MpesaRegisterPayment,
} from "../../services/mpesa";

interface MpesaFlowState {
  modeOfPayment: string;
  amount: number;
  phoneNumber: string;
  accountReference: string;
  source: "stk" | "c2b";
  draftInvoiceName?: string;
  requestName?: string;
  checkoutRequestId?: string;
  transactionId?: string;
  status: "idle" | "in_progress" | "completed" | "failed";
  message?: string;
  c2bPayments?: Array<{ name: string; amount: number }>;
}

interface MpesaRealtimeEvent {
  request_name?: string;
  status?: string;
  transaction_id?: string;
}

interface FrappeRealtimeClient {
  on?: (event: string, handler: (data: MpesaRealtimeEvent) => void) => void;
  off?: (event: string, handler: (data: MpesaRealtimeEvent) => void) => void;
}

interface CachedTaxPreviewEntry {
  taxPreview: BackendTaxPreview;
  timestamp: number;
}

interface TemplateAwareCartItem {
  id?: string;
  item_code?: string;
  price?: number;
  quantity: number;
  item_tax_rate?: string | Record<string, number>;
  tax_templates?: Array<{ is_inclusive?: boolean }>;
  total_tax_rate?: number;
}

const TAX_PREVIEW_DEBOUNCE_MS = 350;
const TAX_PREVIEW_CACHE_TTL_MS = 15000;
const TAX_PREVIEW_CACHE_MAX_ENTRIES = 100;

function normalizeMpesaStatus(status?: string) {
  const normalized = (status || "").toLowerCase();
  if (["completed", "success", "successful"].includes(normalized)) return "completed" as const;
  if (["failed", "cancelled", "timed out", "timeout"].includes(normalized)) return "failed" as const;
  if (normalized === "idle") return "idle" as const;
  return "in_progress" as const;
}

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
  const [showSalespersonModal, setShowSalespersonModal] = useState(false);
  const [selectedDeliveryPersonnel, setSelectedDeliveryPersonnel] = useState<string | null>(null);
  const [taxPin, setTaxPin] = useState("");
  const [backendTaxPreview, setBackendTaxPreview] = useState<BackendTaxPreview | null>(null);
  const [isTaxPreviewLoading, setIsTaxPreviewLoading] = useState(false);
  const [taxPreviewError, setTaxPreviewError] = useState<string | null>(null);
  const [mpesaFlow, setMpesaFlow] = useState<MpesaFlowState | null>(null);
  const [mpesaDraftInvoiceName, setMpesaDraftInvoiceName] = useState<string | null>(null);
  const [showMpesaOptionsModal, setShowMpesaOptionsModal] = useState(false);
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState(selectedCustomer?.phone || "");
  const [mpesaSearchTerm, setMpesaSearchTerm] = useState("");
  const [mpesaRegisterPayments, setMpesaRegisterPayments] = useState<MpesaRegisterPayment[]>([]);
  const [mpesaRegisterCount, setMpesaRegisterCount] = useState(0);
  const [selectedMpesaPayments, setSelectedMpesaPayments] = useState<MpesaRegisterPayment[]>([]);
  const [mergeMpesaPayments, setMergeMpesaPayments] = useState(true);
  const [isLoadingMpesaRegisterPayments, setIsLoadingMpesaRegisterPayments] = useState(false);
  const backendTaxPreviewRef = useRef<BackendTaxPreview | null>(null);
  const taxPreviewRequestIdRef = useRef(0);
  const taxPreviewCacheRef = useRef<Map<string, CachedTaxPreviewEntry>>(new Map());

  const { posDetails } = usePOSProfileStore();
  const posLoading = false;
  const {
    activeSalesperson: currentSalesperson,
    rememberLocked: rememberSalesperson,
    ensureInitialized,
    isRestoring: isSalespersonRestoring,
    isVerifying: isVerifyingPin,
    clearActiveSalesperson,
  } = useSalespersonStore();
  const { modes, isLoading, error } = usePaymentModes(typeof posDetails?.name === "string" ? posDetails.name : "");
  const { salesTaxCharges, defaultTax, isLoading: salesTaxLoading } = useSalesTaxCharges();
  const { personnel: deliveryPersonnelList } = useDeliveryPersonnel();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const posProfileName = typeof posDetails?.name === "string" ? posDetails.name : "";
  const posCompanyName =
    typeof posDetails?.company === "string"
      ? posDetails.company
      : typeof posDetails?.company?.name === "string"
        ? posDetails.company.name
        : "";

  const isB2B = posDetails?.business_type === "B2B";
  const isB2C = posDetails?.business_type === "B2C";
  const print_receipt_on_order_complete = posDetails?.print_receipt_on_order_complete;
  const deliveryRequiredValue = posDetails?.custom_delivery_required;
  const isDeliveryRequired = deliveryRequiredValue === 1;
  const allowPartialPayments = Boolean(posDetails?.allow_partial_payment);
  const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required;
  const allow_holding_invoices = Boolean(posDetails?.allow_holding_invoices);
  const isTaxIncludedInBasicRate =
    posDetails?.is_tax_included_in_basic_rate === 1
    || posDetails?.is_tax_included_in_basic_rate === "1"
    || posDetails?.is_tax_included_in_basic_rate === true;
  const autoAllocateRemainingPayment =
    posDetails?.custom_auto_allocate_remaining_payment === 1 ||
    posDetails?.custom_auto_allocate_remaining_payment === "1" ||
    posDetails?.custom_auto_allocate_remaining_payment === true;

  const [enableBackgroundSubmission, setEnableBackgroundSubmission] = useState<boolean>(
    Boolean(posDetails?.enable_background_invoice_submission)
  );

  useEffect(() => {
    setEnableBackgroundSubmission(Boolean(posDetails?.enable_background_invoice_submission));
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

  const selectedTaxTemplate = useMemo(
    () => salesTaxCharges.find((tax) => tax.id === selectedSalesTaxCharges) || null,
    [salesTaxCharges, selectedSalesTaxCharges]
  );

  const selectedTaxLineMap = useMemo(() => {
    const map = new Map<string, { charge_type?: string; rate?: number; included_in_print_rate?: boolean }>();
    for (const line of selectedTaxTemplate?.tax_lines || []) {
      if (!line.account_head) continue;
      map.set(line.account_head, line);
    }
    return map;
  }, [selectedTaxTemplate]);

  const getEffectiveItemRate = useCallback((item: TemplateAwareCartItem) => {
    return getSharedEffectiveItemRate(item, {
      itemDiscounts,
      isTaxIncludedInBasicRate,
      selectedTaxLineMap,
      selectedTaxTemplate,
    });
  }, [isTaxIncludedInBasicRate, itemDiscounts, selectedTaxLineMap, selectedTaxTemplate]);

  const getEffectiveDisplayRate = useCallback((item: TemplateAwareCartItem) => {
    return getSharedEffectiveDisplayRate(item, {
      itemDiscounts,
      isTaxIncludedInBasicRate,
      selectedTaxLineMap,
      selectedTaxTemplate,
    });
  }, [isTaxIncludedInBasicRate, itemDiscounts, selectedTaxLineMap, selectedTaxTemplate]);

  const calculations: Calculations = useMemo(() => {
    // subtotal uses exclusive (pre-tax) prices so the tax line is separately visible
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + getEffectiveItemRate(item) * item.quantity;
    }, 0);
    const couponDiscount = appliedCoupons.reduce((sum, coupon) => sum + coupon.value, 0);
    const taxableAmount = Math.max(0, subtotal - couponDiscount);
    const selectedTax = selectedTaxTemplate;
    const taxRate = selectedTax?.rate || 0;
    const isInclusive = isTaxIncludedInBasicRate || selectedTax?.is_inclusive || false;
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
  }, [cartItems, appliedCoupons, getEffectiveItemRate, isTaxIncludedInBasicRate, roundOffAmount, selectedTaxTemplate]);

  // Inclusive grand total: sum of discountedPriceIncl (already computed correctly in OrderSummary mapping)
  // This is reliable regardless of whether items have ERPNext Item Tax Templates
  const inclGrandTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + getEffectiveDisplayRate(item) * item.quantity;
    }, 0) + roundOffAmount;
  }, [cartItems, getEffectiveDisplayRate, roundOffAmount]);

  const totalPaidAmount = calculateTotalPayments(Object.values(paymentAmounts));
  const backendTaxLines = backendTaxPreview?.tax_breakdown || [];
  const hasBackendTaxPreview = backendTaxPreview !== null;
  const hasBackendTaxBreakdown = backendTaxLines.length > 0;
  const checkoutGrandTotal = hasBackendTaxPreview
    ? Number(backendTaxPreview?.grand_total || inclGrandTotal)
    : inclGrandTotal;
  const outstandingAmount = calculateRemainingAmount(checkoutGrandTotal, Object.values(paymentAmounts));

  // Tax amount = inclusive grand total minus exclusive subtotal (works for both item templates and global taxes)
  const localTaxTotal = parseFloat((checkoutGrandTotal - calculations.subtotal - (calculations.couponDiscount > 0 ? 0 : 0)).toFixed(2));

  const displaySubtotal = hasBackendTaxPreview
    ? Number(backendTaxPreview?.net_total || calculations.subtotal)
    : calculations.subtotal;
  const displayTaxIsIncluded = hasBackendTaxBreakdown
    ? backendTaxLines.some((line) => Number(line.included_in_print_rate) === 1)
    : calculations.isInclusive;
  const displayTaxTotal = hasBackendTaxPreview
    ? backendTaxPreview?.total_taxes_and_charges || 0
    : calculations.taxAmount > 0 ? calculations.taxAmount : Math.max(0, localTaxTotal);
  
  const previousCheckoutGrandTotalRef = useRef(checkoutGrandTotal);

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

  const getActiveMpesaPayment = useCallback(() => {
    const entries = Object.entries(paymentAmounts).filter(([, amount]) => (amount || 0) > 0);
    for (const [method, amount] of entries) {
      const mode = modes.find((m) => m.mode_of_payment === method);
      const isMpesaMode =
        (mode?.type || "").toLowerCase() === "phone" || /mpesa/i.test(method || "");
      if (isMpesaMode) {
        return {
          method,
          amount: Number(amount || 0),
        };
      }
    }
    return null;
  }, [modes, paymentAmounts]);

  const refreshMpesaStatus = useCallback(async (requestName?: string) => {
    const name = requestName || mpesaFlow?.requestName;
    if (!name) return;
    try {
      const statusResponse = await fetchKlikPosStkStatus(name);
      const normalizedStatus = normalizeMpesaStatus(statusResponse.status);
      setMpesaFlow((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: normalizedStatus,
          transactionId: statusResponse.transaction_id || prev.transactionId,
          checkoutRequestId: statusResponse.checkout_request_id || prev.checkoutRequestId,
          message: statusResponse.result_desc || prev.message,
        };
      });
    } catch (error) {
      console.error("Failed to refresh M-Pesa status", error);
    }
  }, [mpesaFlow?.requestName]);

  const selectedMpesaTotal = useMemo(
    () => selectedMpesaPayments.reduce((sum, payment) => sum + Number(payment.transamount || 0), 0),
    [selectedMpesaPayments]
  );

  const buildPaymentData = (
    deliveryPersonnel: string | null = null,
    options?: { excludeActiveMpesa?: boolean }
  ) => {
    const netAmountToSend = isB2B ? totalPaidAmount : checkoutGrandTotal;
    const activeMpesaPayment = options?.excludeActiveMpesa ? getActiveMpesaPayment() : null;
    const adjustedPaymentMethods = isB2B
      ? Object.entries(paymentAmounts).filter(([, amount]) => amount > 0)
      : (() => {
          const validPayments = Object.entries(paymentAmounts).filter(([, amount]) => amount > 0);
          if (validPayments.length === 0) return [];
          const totalPaymentAmount = validPayments.reduce((sum, [, amount]) => sum + amount, 0);
          if (totalPaymentAmount > checkoutGrandTotal) {
            const excess = totalPaymentAmount - checkoutGrandTotal;
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

    return {
      items: cartItems.map((item) => {
        const code = item.item_code || item.id;
        const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
        return {
          ...item,
          id: item.item_code || item.id,
          item_code: item.item_code || item.id,
          price: getEffectiveItemRate(item),
          uom: item.uom || "Nos",
          discountPercentage: discountData.discountPercentage || 0,
          discountAmount: discountData.discountAmount || 0,
          serial_batch_bundle: discountData.serial_batch_bundle || null,
        };
      }),
      customer: selectedCustomer,
      paymentMethods: (adjustedPaymentMethods ?? []).filter(([method]) => {
        if (!activeMpesaPayment) return true;
        return method !== activeMpesaPayment.method;
      }).map(([method, amount]) => {
        const paymentLine: Record<string, unknown> = {
          method,
          amount: parseFloat((Number(amount) || 0).toFixed(2)),
        };

        if (
          mpesaFlow &&
          mpesaFlow.source === "stk" &&
          mpesaFlow.modeOfPayment === method &&
          mpesaFlow.status === "completed" &&
          mpesaFlow.requestName
        ) {
          paymentLine.reference_no = mpesaFlow.transactionId || mpesaFlow.requestName;
          paymentLine.phone_number = mpesaFlow.phoneNumber;
          paymentLine.type = "Phone";
          paymentLine.custom_reference_text = mpesaFlow.requestName;
        }

        return paymentLine;
      }),
      subtotal: displaySubtotal,
      SalesTaxCharges: selectedSalesTaxCharges,
      taxAmount: displayTaxTotal,
      taxType: displayTaxIsIncluded ? "inclusive" : "exclusive",
      couponDiscount: calculations.couponDiscount,
      roundOffAmount,
      grandTotal: checkoutGrandTotal,
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
  };

  const ensureMpesaDraftInvoice = async () => {
    if (mpesaDraftInvoiceName) {
      return mpesaDraftInvoiceName;
    }

    const draftResponse = await createDraftSalesInvoice({
      ...buildPaymentData(selectedDeliveryPersonnel, { excludeActiveMpesa: true }),
      enable_background_invoice_submission: false,
    });

    const draftName = draftResponse.invoice_name || draftResponse.invoice?.name;
    if (!draftName) {
      throw new Error("Draft invoice was created without a name");
    }

    setMpesaDraftInvoiceName(draftName);
    return draftName;
  };

  const initiateMpesaFlow = async (method: string, amount: number, phoneNumber: string) => {
    if (!selectedCustomer || !selectedCustomer.name) {
      toast.error("Kindly select a customer");
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error("Phone number is required for M-Pesa STK push");
      return;
    }
    if (!posCompanyName) {
      toast.error("POS company is missing. Unable to initiate M-Pesa STK push.");
      return;
    }

    try {
      setIsProcessingPayment(true);
      const draftInvoiceName = await ensureMpesaDraftInvoice();

      const accountReference = draftInvoiceName;
      const response = await initiateKlikPosStkPush({
        phone_number: phoneNumber,
        amount,
        mode_of_payment: method,
        company: posCompanyName,
        account_reference: accountReference,
        reference_doctype: "Sales Invoice",
        reference_name: draftInvoiceName,
        currency: "KES",
        prevent_duplicates: 1,
      });

      setMpesaFlow({
        modeOfPayment: method,
        amount,
        phoneNumber: phoneNumber,
        accountReference,
        source: "stk",
        draftInvoiceName,
        requestName: response.request_name,
        checkoutRequestId: response.checkout_request_id,
        transactionId: response.transaction_id,
        status: normalizeMpesaStatus(response.request_status),
        message: response.duplicate_prevented
          ? "Using existing pending M-Pesa request"
          : "STK push sent. Awaiting customer confirmation.",
      });
      toast.info("STK push sent. Awaiting customer confirmation.");
    } catch (error) {
      toast.error(extractErrorFromException(error, "Failed to initiate M-Pesa STK push"));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleOpenMpesaOptions = async () => {
    if (requiresSalespersonPin && !currentSalesperson) {
      setShowSalespersonModal(true);
      toast.error("Verify the salesperson before managing M-Pesa payments");
      return;
    }

    const activeMpesaPayment = getActiveMpesaPayment();
    if (!activeMpesaPayment || activeMpesaPayment.amount <= 0) {
      toast.error("Enter an amount on an M-Pesa payment method before opening M-Pesa options.");
      return;
    }

    setMpesaPhoneNumber(selectedCustomer?.phone || mpesaFlow?.phoneNumber || "");
    setShowMpesaOptionsModal(true);
  };

  const handleInitiateMpesaPayment = async () => {
    const activeMpesaPayment = getActiveMpesaPayment();
    if (!activeMpesaPayment || activeMpesaPayment.amount <= 0) {
      toast.error("Enter an amount on an M-Pesa payment method before initiating STK push.");
      return;
    }

    await initiateMpesaFlow(activeMpesaPayment.method, activeMpesaPayment.amount, mpesaPhoneNumber.trim());
    setShowMpesaOptionsModal(false);
  };

  const handleToggleMpesaPayment = (paymentName: string) => {
    const payment = mpesaRegisterPayments.find((entry) => entry.name === paymentName);
    if (!payment) return;

    setSelectedMpesaPayments((prev) => {
      const exists = prev.some((entry) => entry.name === paymentName);
      if (exists) {
        return prev.filter((entry) => entry.name !== paymentName);
      }
      return [...prev, payment];
    });
  };

  const handleReconcileMpesaPayments = async () => {
    if (!selectedCustomer?.id && !selectedCustomer?.name) {
      toast.error("Kindly select a customer");
      return;
    }

    const activeMpesaPayment = getActiveMpesaPayment();
    if (!activeMpesaPayment || activeMpesaPayment.amount <= 0) {
      toast.error("Enter an amount on an M-Pesa payment method before reconciling payments.");
      return;
    }

    if (!selectedMpesaPayments.length) {
      toast.error("Select at least one M-Pesa register payment to reconcile.");
      return;
    }

    try {
      setIsProcessingPayment(true);
      const draftInvoiceName = await ensureMpesaDraftInvoice();
      const response = await processKlikPosMpesaPayments({
        doctype: "Sales Invoice",
        invoice_name: draftInvoiceName,
        customer: selectedCustomer.id || selectedCustomer.name,
        mpesa_payments: selectedMpesaPayments.map((payment) => payment.name).join(","),
        auto_save: 1,
        auto_submit: 0,
        merge_payments: mergeMpesaPayments ? 1 : 0,
      });

      setPaymentAmounts((prev) => ({
        ...prev,
        [activeMpesaPayment.method]: Number(response.total_amount || selectedMpesaTotal),
      }));
      setMpesaFlow({
        modeOfPayment: activeMpesaPayment.method,
        amount: Number(response.total_amount || selectedMpesaTotal),
        phoneNumber: "",
        accountReference: draftInvoiceName,
        source: "c2b",
        draftInvoiceName,
        status: "completed",
        message: `${selectedMpesaPayments.length} M-Pesa register payment(s) linked to draft invoice ${draftInvoiceName}.`,
        c2bPayments: selectedMpesaPayments.map((payment) => ({
          name: payment.name,
          amount: Number(payment.transamount || 0),
        })),
      });
      setShowMpesaOptionsModal(false);
      setSelectedMpesaPayments([]);
      setMpesaSearchTerm("");
      toast.success("M-Pesa register payments added to draft invoice.");
    } catch (error) {
      toast.error(extractErrorFromException(error, "Failed to reconcile M-Pesa payments"));
    } finally {
      setIsProcessingPayment(false);
    }
  };

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
      checkoutGrandTotal - calculateTotalPayments(Object.values(updatedAmounts)),
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
    newPaymentAmounts[methodId] = checkoutGrandTotal;
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

    const previewPayload = {
      customer: { id: selectedCustomer?.id },
      items: cartItems.map((item) => {
        const code = item.item_code || item.id;
        const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
        const rawItemTaxRate = (item.item_tax_rate || {}) as Record<string, number>;
        const normalizedItemTaxRate: Record<string, number> = {};
        Object.keys(rawItemTaxRate)
          .sort()
          .forEach((key) => {
            normalizedItemTaxRate[key] = Number(rawItemTaxRate[key] || 0);
          });

        return {
          id: code,
          quantity: Number(item.quantity || 0),
          price: Number(getEffectiveItemRate(item) || 0),
          uom: item.uom || "Nos",
          discountPercentage: Number(discountData.discountPercentage || 0),
          discountAmount: Number(discountData.discountAmount || 0),
          bundle_entries: discountData.bundle_entries || [],
          item_tax_template: item.item_tax_template || "",
          item_tax_rate: normalizedItemTaxRate,
        };
      }),
      SalesTaxCharges: selectedSalesTaxCharges,
      businessType: posDetails?.business_type || "",
      roundOffAmount: Number(roundOffAmount || 0),
    };

    const previewCacheKey = JSON.stringify(previewPayload);

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

      const now = Date.now();
      const cachedEntry = taxPreviewCacheRef.current.get(previewCacheKey);
      if (cachedEntry && now - cachedEntry.timestamp <= TAX_PREVIEW_CACHE_TTL_MS) {
        setBackendTaxPreview(cachedEntry.taxPreview);
        backendTaxPreviewRef.current = cachedEntry.taxPreview;
        setTaxPreviewError(null);
        setIsTaxPreviewLoading(false);
        return;
      }

      setIsTaxPreviewLoading(true);
      try {
        const payload = {
          customer: { id: selectedCustomer.id },
          items: cartItems.map((item) => {
            const code = item.item_code || item.id;
            const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
            return {
              id: code,
              quantity: item.quantity,
              price: getEffectiveItemRate(item),
              uom: item.uom || "Nos",
              discountPercentage: discountData.discountPercentage || 0,
              discountAmount: discountData.discountAmount || 0,
              bundle_entries: discountData.bundle_entries || [],
              item_tax_template: item.item_tax_template || "",
              item_tax_rate: item.item_tax_rate || {},
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
            taxPreviewCacheRef.current.set(previewCacheKey, {
              taxPreview: response.tax_preview,
              timestamp: Date.now(),
            });

            if (taxPreviewCacheRef.current.size > TAX_PREVIEW_CACHE_MAX_ENTRIES) {
              for (const [key, entry] of taxPreviewCacheRef.current.entries()) {
                if (Date.now() - entry.timestamp > TAX_PREVIEW_CACHE_TTL_MS) {
                  taxPreviewCacheRef.current.delete(key);
                }
              }
              while (taxPreviewCacheRef.current.size > TAX_PREVIEW_CACHE_MAX_ENTRIES) {
                const oldestKey = taxPreviewCacheRef.current.keys().next().value;
                if (!oldestKey) break;
                taxPreviewCacheRef.current.delete(oldestKey);
              }
            }
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
    }, TAX_PREVIEW_DEBOUNCE_MS);

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
    getEffectiveItemRate,
  ]);

  useEffect(() => {
    if (!showMpesaOptionsModal || !posCompanyName) return;

    const activeMpesaPayment = getActiveMpesaPayment();
    if (!activeMpesaPayment) return;

    let cancelled = false;
    const loadMpesaRegisterPayments = async () => {
      setIsLoadingMpesaRegisterPayments(true);
      try {
        const response = await fetchMpesaRegisterPayments({
          company: posCompanyName,
          pos_profile: posProfileName || undefined,
          mode_of_payment: activeMpesaPayment.method,
          search: mpesaSearchTerm.trim().length >= 3 ? mpesaSearchTerm.trim() : undefined,
        });
        if (cancelled) return;
        setMpesaRegisterCount(Number(response.count || 0));
        setMpesaRegisterPayments(response.payments || []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load M-Pesa register payments", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMpesaRegisterPayments(false);
        }
      }
    };

    void loadMpesaRegisterPayments();
    return () => {
      cancelled = true;
    };
  }, [showMpesaOptionsModal, posCompanyName, posProfileName, mpesaSearchTerm, getActiveMpesaPayment]);

  useEffect(() => {
    if (mpesaFlow?.source !== "stk" || !mpesaFlow?.requestName) return;
    if (mpesaFlow.status === "completed" || mpesaFlow.status === "failed") return;

    const interval = window.setInterval(() => {
      void refreshMpesaStatus(mpesaFlow.requestName);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [mpesaFlow?.requestName, mpesaFlow?.source, mpesaFlow?.status, refreshMpesaStatus]);

  useEffect(() => {
    if (mpesaFlow?.source !== "stk" || !mpesaFlow?.requestName) return;
    const realtime = (window as typeof window & { frappe?: { realtime?: FrappeRealtimeClient } })?.frappe?.realtime;
    if (!realtime?.on) return;

    const handler = (data: MpesaRealtimeEvent) => {
      if (!data || data.request_name !== mpesaFlow.requestName) return;
      const status = normalizeMpesaStatus(data.status);
      setMpesaFlow((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status,
          transactionId: data.transaction_id || prev.transactionId,
          message: status === "completed" ? "Payment confirmed" : prev.message,
        };
      });
      if (status === "completed") {
        toast.success("M-Pesa payment confirmed. You can now submit the invoice.");
      }
    };

    realtime.on("mpesa_stk_payment_completed", handler);
    return () => {
      realtime.off?.("mpesa_stk_payment_completed", handler);
    };
  }, [mpesaFlow?.requestName, mpesaFlow?.source]);

  useEffect(() => {
    if (!isOpen) {
      setMpesaFlow(null);
      setMpesaDraftInvoiceName(null);
      setShowMpesaOptionsModal(false);
      setMpesaSearchTerm("");
      setSelectedMpesaPayments([]);
    }
  }, [isOpen]);

  const processPayment = async (deliveryPersonnel: string | null = null) => {
    if (!selectedCustomer || !selectedCustomer.name) {
      toast.error("Kindly select a customer");
      return;
    }
    if (!isCreditSale) {
      const totalPaid = calculateTotalPayments(Object.values(paymentAmounts));
      const orderTotal = checkoutGrandTotal;
      
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
    const paymentData = buildPaymentData(deliveryPersonnel);
    const originalDraftInvoiceId = getOriginalDraftInvoiceId();
    try {
      let response;

      if (mpesaDraftInvoiceName) {
        response = await submitDraftInvoice(
          mpesaDraftInvoiceName,
          mpesaFlow?.source === "c2b" ? undefined : {
            ...paymentData,
            enable_background_invoice_submission: enableBackgroundSubmission,
          }
        );
      } else if (originalDraftInvoiceId) {
        // If editing a held invoice, submit the original draft instead of creating a new one
        response = await submitDraftInvoice(
          originalDraftInvoiceId,
          {
            ...paymentData,
            enable_background_invoice_submission: enableBackgroundSubmission,
          }
        );
      } else {
        response = await createSalesInvoice({
          ...paymentData,
          enable_background_invoice_submission: enableBackgroundSubmission,
        });
      }

      setInvoiceSubmitted(true);
      setSubmittedInvoice(response);
      setInvoiceData(response.invoice);
      setMpesaFlow(null);
      setMpesaDraftInvoiceName(null);
      toast.success(enableBackgroundSubmission ? "Invoice queued for background submission!" : "Invoice submitted successfully!");

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
      setShowSalespersonModal(true);
      toast.error("Verify the salesperson before completing payment");
      return;
    }

    const activeMpesaPayment = getActiveMpesaPayment();
    if (activeMpesaPayment && activeMpesaPayment.amount > 0) {
      const sameRequestForMethod =
        mpesaFlow && mpesaFlow.modeOfPayment === activeMpesaPayment.method ? mpesaFlow : null;

      if (sameRequestForMethod?.source === "stk" && sameRequestForMethod.status === "in_progress") {
        toast.info("M-Pesa payment is still pending. Confirm on phone or click Refresh Status.");
        return;
      }

      if (sameRequestForMethod?.source === "stk" && sameRequestForMethod.status !== "completed" && sameRequestForMethod.requestName) {
        await refreshMpesaStatus(sameRequestForMethod.requestName);
        return;
      }
    }

    await processPayment(selectedDeliveryPersonnel);
  };

  const handleHoldOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer");
      return;
    }
    if (requiresSalespersonPin && !currentSalesperson) {
      setShowSalespersonModal(true);
      toast.error("Verify the salesperson before holding this order");
      return;
    }

    setIsHoldingOrder(true);

    try {
      const orderItems = cartItems.map((item) => {
        const code = item.item_code || item.id;
        const discountData = itemDiscounts[code] || itemDiscounts[item.id] || {};
        const discountPercentage =
          Number(discountData.discountPercentage)
          || Number((item as { discount_percentage?: number }).discount_percentage)
          || 0;
        const discountAmount =
          Number(discountData.discountAmount)
          || Number((item as { discount_amount?: number }).discount_amount)
          || 0;

        let heldPrice = Number((item as { discountedPriceExcl?: number }).discountedPriceExcl);
        if (!Number.isFinite(heldPrice)) {
          heldPrice = getEffectiveItemRate(item);
        }

        return {
          ...item,
          price: heldPrice,
          item_code: code,
          discountPercentage,
          discountAmount,
        };
      });

      const totalItemDiscount = orderItems.reduce((sum, item) => {
        const basePrice =
          Number((item as { originalPrice?: number }).originalPrice)
          || Number((item as { original_price?: number }).original_price)
          || Number(item.price)
          || 0;
        const currentPrice = Number(item.price) || 0;
        return sum + Math.max(0, (basePrice - currentPrice) * item.quantity);
      }, 0);

      const orderData = {
        items: orderItems,
        customer: { id: selectedCustomer.id },
        subtotal: calculations.subtotal,
        total: checkoutGrandTotal,
        SalesTaxCharges: selectedSalesTaxCharges,
        taxAmount: calculations.taxAmount,
        taxType: calculations.isInclusive ? "inclusive" : "exclusive",
        couponDiscount: calculations.couponDiscount,
        roundOffAmount,
        grandTotal: checkoutGrandTotal,
        appliedCoupons,
        itemDiscounts,
        totalItemDiscount,
        totalSavings: totalItemDiscount + calculations.couponDiscount,
        status: "held",
        businessType: posDetails?.business_type,
        salesperson: currentSalesperson?.name || null,
        tax_id: taxPin || null,
        draft_invoice_id: getOriginalDraftInvoiceId(),
      };

      const result = await createDraftSalesInvoice(orderData);
      if (!result?.success) {
        throw new Error("Failed to hold order");
      }

      clearCart();
      toast.success(orderData.draft_invoice_id ? "Draft invoice updated and order held successfully!" : "Draft invoice created and order held successfully!");
      await Promise.resolve(onHoldOrder(orderData));
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
    void finalizeCompletedOrderState(() => {
      navigate(`/invoice/${invoice.name}`);
    });
  };

  const clearOrderState = () => {
    clearDraftInvoiceCache();
    clearCart();
  };

  const finalizeCompletedOrderState = async (afterClear?: () => void) => {
    if (invoiceSubmitted && !rememberSalesperson) {
      try {
        await clearActiveSalesperson(true);
      } catch (salespersonClearError) {
        console.error("Failed to clear salesperson session after completion:", salespersonClearError);
      }
    }

    clearOrderState();
    afterClear?.();
  };

  const getActionButtonText = () => {
    if (isProcessingPayment) return isB2B ? "Submitting Invoice..." : "Processing Payment...";
    if (mpesaFlow?.source === "stk" && mpesaFlow?.status === "completed") return "Submit Confirmed Payment";
    return "Submit";
  };

  const getMpesaButtonText = () => {
    if (isProcessingPayment) return "Processing M-Pesa...";
    if (mpesaFlow?.source === "stk" && mpesaFlow?.status === "in_progress") return "M-Pesa Pending";
    if (mpesaFlow?.source === "c2b") return "Review M-Pesa Options";
    return "M-Pesa Options";
  };

  const hasActiveMpesaPayment = Boolean(getActiveMpesaPayment());

  const isMpesaButtonDisabled = () => {
    if (!hasActiveMpesaPayment) return true;
    if (invoiceSubmitted || isProcessingPayment) return true;
    return false;
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
      invoice_total: formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol),
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
      grand_total: formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol),
      departure_time: new Date().toLocaleTimeString(),
      estimated_arrival: new Date(Date.now() + 30 * 60000).toLocaleTimeString(),
      driver_name: "Delivery Driver",
      cell_number: "+1234567890",
      vehicle: "Delivery Vehicle",
      invoice_total: formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol),
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
    if (isOpen && requiresSalespersonPin) {
      void ensureInitialized();
    }
  }, [isOpen, requiresSalespersonPin, ensureInitialized]);

  useEffect(() => {
    if (isOpen && !dueDate) {
      const today = new Date().toISOString().split("T")[0] || "";
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
        const defaultAmount = parseFloat(checkoutGrandTotal.toFixed(2));
        setLastModifiedMethodId(defaultMode.mode_of_payment);
        setPaymentAmounts({ [defaultMode.mode_of_payment]: defaultAmount });
      }
    }
  }, [isOpen, modes, checkoutGrandTotal, isB2B, isB2C, paymentAmounts, isCreditSale]);

  useEffect(() => {
    if (!isOpen || invoiceSubmitted || isProcessingPayment || isCreditSale) {
      previousCheckoutGrandTotalRef.current = checkoutGrandTotal;
      return;
    }

    const previousTotal = previousCheckoutGrandTotalRef.current;
    if (Math.abs(previousTotal - checkoutGrandTotal) < 0.0001) {
      return;
    }

    setPaymentAmounts((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) {
        return prev;
      }

      const currentPaid = roundCurrency(calculateTotalPayments(Object.values(prev)));
      const previousRounded = roundCurrency(previousTotal);

      // If cashier already edited amounts away from previous total, do not override.
      if (Math.abs(currentPaid - previousRounded) > 0.01) {
        return prev;
      }

      const defaultMode = modes.find((mode) => mode.default === 1)?.mode_of_payment;
      if (entries.length === 1 && defaultMode && entries[0]?.[0] === defaultMode) {
        return { [defaultMode]: roundCurrency(checkoutGrandTotal) };
      }

      return prev;
    });

    previousCheckoutGrandTotalRef.current = checkoutGrandTotal;
  }, [checkoutGrandTotal, isOpen, invoiceSubmitted, isProcessingPayment, isCreditSale, modes]);

  useEffect(() => {
    if (modes.length > 0 && Object.keys(paymentAmounts).length > 0) {
      const defaultMode = modes.find((mode) => mode.default === 1);
      if (defaultMode) {
        const totalPayments = Object.values(paymentAmounts).reduce((sum, amount) => sum + (amount || 0), 0);
        const excess = totalPayments - checkoutGrandTotal;
        const paymentEntries = Object.entries(paymentAmounts);
        const highestAmountMethod = paymentEntries.reduce((max, current) => (current[1] || 0) > (max[1] || 0) ? current : max);
        const [highestMethodId, highestAmount] = highestAmountMethod;
        if (highestAmount > 0 && excess > 0) {
          const newAmount = Math.max(0, highestAmount - excess);
          setPaymentAmounts((prev) => ({ ...prev, [highestMethodId]: newAmount }));
        }
      }
    }
  }, [checkoutGrandTotal, modes, isB2C, isB2B, paymentAmounts]);

  useEffect(() => {
    if (invoiceSubmitted && invoiceData && print_receipt_on_order_complete) {
      setIsAutoPrinting(true);
      setTimeout(() => {
        handlePrintInvoice(invoiceData, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting), posDetails });
        setIsAutoPrinting(false);
      }, 500);
    }
  }, [invoiceSubmitted, invoiceData, print_receipt_on_order_complete, posDetails?.custom_prevent_invoice_reprinting]);

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

  const retryMpesaRequest = async () => {
    const activeMpesaPayment = getActiveMpesaPayment();
    if (!activeMpesaPayment) {
      toast.error("No active M-Pesa amount found to retry.");
      return;
    }
    setMpesaFlow((prev) => (prev ? { ...prev, status: "idle", message: undefined } : prev));
    setShowMpesaOptionsModal(true);
  };

  const renderMpesaStatusNotice = () => {
    if (!mpesaFlow) return null;

    const statusText =
      mpesaFlow.source === "c2b"
        ? "Register payments linked"
        : mpesaFlow.status === "completed"
          ? "Payment confirmed"
        : mpesaFlow.status === "failed"
          ? "Payment failed"
          : "Awaiting customer confirmation";

    const statusClass =
      mpesaFlow.status === "completed"
        ? "border-green-200 bg-green-50 text-green-800"
        : mpesaFlow.status === "failed"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-yellow-200 bg-yellow-50 text-yellow-800";

    return (
      <div className={`rounded-lg border p-3 ${statusClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              {mpesaFlow.source === "c2b" ? "M-Pesa Register Status" : "M-Pesa STK Status"}: {statusText}
            </p>
            {mpesaFlow.source === "c2b" ? (
              <p className="text-xs">
                Draft Invoice: {mpesaFlow.draftInvoiceName}
                {mpesaFlow.c2bPayments?.length ? ` | Payments: ${mpesaFlow.c2bPayments.length}` : ""}
              </p>
            ) : (
              <p className="text-xs">
                Request: {mpesaFlow.requestName}
                {mpesaFlow.transactionId ? ` | Txn: ${mpesaFlow.transactionId}` : ""}
              </p>
            )}
            {mpesaFlow.message && <p className="text-xs mt-1">{mpesaFlow.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            {mpesaFlow.source === "stk" && mpesaFlow.requestName && (
              <button
                type="button"
                className="px-2 py-1 rounded border border-current text-xs"
                onClick={() => void refreshMpesaStatus()}
                disabled={isProcessingPayment}
              >
                Refresh Status
              </button>
            )}
            {mpesaFlow.source === "stk" && mpesaFlow.status === "failed" && (
              <button
                type="button"
                className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                onClick={() => void retryMpesaRequest()}
                disabled={isProcessingPayment}
              >
                Retry STK
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
                    <p className="text-sm opacity-75">Total: {formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {isAutoPrinting && (
                    <div className="flex items-center space-x-2 text-blue-600 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Printing...</span>
                    </div>
                  )}
                  <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onClick={() => { handlePrintInvoice(invoiceData, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting), posDetails }); void finalizeCompletedOrderState(); }}>
                    <Printer size={18} />
                    <span>Print</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors" onClick={() => { void finalizeCompletedOrderState(() => { window.open(`mailto:${selectedCustomer?.email}?subject=Your%20Invoice&body=Dear%20${selectedCustomer?.name},%0A%0AHere%20is%20your%20invoice%20total:%20${formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}%0A%0AThank%20you.`); }); }}>
                    <MailPlus size={18} />
                    <span>Email</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-beveren-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors" onClick={() => { window.open(`https://wa.me/${selectedCustomer?.phone}?text=${encodeURIComponent(`Here is your invoice total: ${formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}`)}`, "_blank"); }}>
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
                  <button onClick={() => { void finalizeCompletedOrderState(() => onClose(true)); }} className="w-full py-3 bg-beveren-600 text-white rounded-lg font-medium hover:bg-beveren-700 transition-colors">
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
                {renderMpesaStatusNotice()}
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
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyWithSymbol(displaySubtotal, displayCurrencySymbol)}</span>
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
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}</span>
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
                      {totalPaidAmount > checkoutGrandTotal && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Change</span>
                          <span className="font-medium text-beveren-600 dark:text-beveren-400">{formatCurrencyWithSymbol(subtractCurrency(totalPaidAmount, checkoutGrandTotal), displayCurrencySymbol)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isB2B && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}</span>
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
                  {hasActiveMpesaPayment && (
                    <button
                      type="button"
                      onClick={() => void handleOpenMpesaOptions()}
                      disabled={isMpesaButtonDisabled()}
                      className="w-full py-4 rounded-lg font-semibold border border-emerald-600 text-emerald-700 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-emerald-50 transition-colors"
                    >
                      {getMpesaButtonText()}
                    </button>
                  )}

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
        <MpesaOptionsModal
          isOpen={showMpesaOptionsModal}
          modeOfPayment={getActiveMpesaPayment()?.method || "M-Pesa"}
          amount={getActiveMpesaPayment()?.amount || 0}
          phoneNumber={mpesaPhoneNumber}
          currencySymbol={displayCurrencySymbol}
          searchTerm={mpesaSearchTerm}
          payments={mpesaRegisterPayments}
          pendingCount={mpesaRegisterCount}
          selectedPaymentNames={selectedMpesaPayments.map((payment) => payment.name)}
          selectedTotal={selectedMpesaTotal}
          mergePayments={mergeMpesaPayments}
          isLoadingPayments={isLoadingMpesaRegisterPayments}
          isProcessing={isProcessingPayment}
          onClose={() => setShowMpesaOptionsModal(false)}
          onPhoneNumberChange={setMpesaPhoneNumber}
          onSearchChange={setMpesaSearchTerm}
          onTogglePayment={handleToggleMpesaPayment}
          onToggleMergePayments={setMergeMpesaPayments}
          onInitiateStk={() => void handleInitiateMpesaPayment()}
          onAddPayments={() => void handleReconcileMpesaPayments()}
        />
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
          finalizeCompletedOrderState={(afterClear) => {
            void finalizeCompletedOrderState(afterClear);
          }}
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

                {renderMpesaStatusNotice()}

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
                  isLoading={isSalespersonRestoring || isVerifyingPin}
                  onOpenSalespersonModal={() => setShowSalespersonModal(true)}
                />

                <SalespersonAuthModal
                  isOpen={showSalespersonModal}
                  onClose={() => setShowSalespersonModal(false)}
                  title="Verify salesperson"
                  description="Switch or verify the salesperson assigned to this sale."
                />

                <TotalsSection
                  calculations={calculations}
                  displaySubtotal={displaySubtotal}
                  displayTaxTotal={displayTaxTotal}
                  displayTaxIsIncluded={displayTaxIsIncluded}
                  checkoutGrandTotal={checkoutGrandTotal}
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
              displaySubtotal={displaySubtotal}
              displayTaxTotal={displayTaxTotal}
              displayTaxIsIncluded={displayTaxIsIncluded}
              checkoutGrandTotal={checkoutGrandTotal}
              roundOffAmount={roundOffAmount}
              paymentAmounts={paymentAmounts}
              displayCurrencySymbol={displayCurrencySymbol}
              isB2B={isB2B}
              isB2C={isB2C}
              currentDate={currentDate}
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
                showMpesaButton={hasActiveMpesaPayment}
                isMpesaButtonDisabled={isMpesaButtonDisabled}
                  getActionButtonText={getActionButtonText}
                getMpesaButtonText={getMpesaButtonText}
                  onInitiateMpesa={handleOpenMpesaOptions}
                  onCompletePayment={handleCompletePayment}
                  onHoldOrder={handleHoldOrder}
                  onEditOrder={handleEditOrder}
                  onNewOrder={() => { void finalizeCompletedOrderState(() => onClose(true)); }}
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

      <MpesaOptionsModal
        isOpen={showMpesaOptionsModal}
        modeOfPayment={getActiveMpesaPayment()?.method || "M-Pesa"}
        amount={getActiveMpesaPayment()?.amount || 0}
        phoneNumber={mpesaPhoneNumber}
        currencySymbol={displayCurrencySymbol}
        searchTerm={mpesaSearchTerm}
        payments={mpesaRegisterPayments}
        pendingCount={mpesaRegisterCount}
        selectedPaymentNames={selectedMpesaPayments.map((payment) => payment.name)}
        selectedTotal={selectedMpesaTotal}
        mergePayments={mergeMpesaPayments}
        isLoadingPayments={isLoadingMpesaRegisterPayments}
        isProcessing={isProcessingPayment}
        onClose={() => setShowMpesaOptionsModal(false)}
        onPhoneNumberChange={setMpesaPhoneNumber}
        onSearchChange={setMpesaSearchTerm}
        onTogglePayment={handleToggleMpesaPayment}
        onToggleMergePayments={setMergeMpesaPayments}
        onInitiateStk={() => void handleInitiateMpesaPayment()}
        onAddPayments={() => void handleReconcileMpesaPayments()}
      />
    </div>
  );
}