"use client";

import { useState, useEffect, useCallback } from "react";
import { useCartStore } from "../../stores/cartStore";
import { useProductStore } from "../../stores/productStore";
import { toast } from "react-toastify";
import { extractErrorFromException } from "../../utils/errorExtraction";
import { getBatches } from "../../utils/batch";
import { getSerials } from "../../utils/serial";
import type { CartItem } from "../../../types";
import type { Customer } from "../../types/customer";
import PaymentDialog from "../dialog/PaymentDialog";
import SalespersonAuthModal from "../dialog/SalespersonAuthModal";
import {
  createDraftSalesInvoice,
  getCheckoutRequestStatus,
  validateCheckoutInvoice,
} from "../../services/salesInvoice";
import { getOriginalDraftInvoiceId } from "../../utils/draftInvoiceCache";
import { CustomerSearchSection } from "./CustomerSearchSection";
import CustomerLoyaltySummary from "./CustomerLoyaltySummary";
import { CartItemRow } from "./CartItemRow";
import { OrderSummaryFooter } from "./OrderSummaryFooter";
import { usePOSProfileStore } from "../../stores/posProfileStore";
import { useSalespersonStore } from "../../stores/salespersonStore";
import { getEffectiveDisplayRate, getEffectiveItemRate } from "../../utils/cartPricing";
import { roundCurrency } from "../../utils/currencyMath";
import {
  getCheckoutAttemptForCart,
  getCheckoutCartFingerprint,
} from "../../utils/checkoutAttempt";

interface OrderSummaryProps {
  onClearCart?: () => void;
  isMobile?: boolean;
  onPaymentCompleted?: () => void;
}

export default function OrderSummary({
  onClearCart,
  isMobile = false,
  onPaymentCompleted,
}: OrderSummaryProps) {
  const {
    cartItems,
    selectedCustomer,
    setSelectedCustomer,
    updateUOM,
    refreshCartPricing,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCartStore();

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSalespersonAuthModal, setShowSalespersonAuthModal] = useState(false);
  const [isValidatingCheckout, setIsValidatingCheckout] = useState(false);
  const [isRecoveringCheckout, setIsRecoveringCheckout] = useState(false);
  const [isHoldingOrder, setIsHoldingOrder] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [pendingSalespersonAction, setPendingSalespersonAction] = useState<
    "checkout" | "hold" | null
  >(null);

  const { posDetails } = usePOSProfileStore();
  const { refreshStockOnly } = useProductStore();
  const { activeSalesperson, ensureInitialized } = useSalespersonStore();

  const [itemDiscounts, setItemDiscounts] = useState<Record<string, any>>(() => {
    const saved: Record<string, any> = {};
    cartItems.forEach(item => {
      const persistedDiscountAmount = Number((item as CartItem & { discount_amount?: number }).discount_amount) || 0;
      const persistedDiscountPercentage = Number((item as CartItem & { discount_percentage?: number }).discount_percentage) || 0;
      const persistedCustomRate = (item as CartItem & { custom_rate?: number }).custom_rate;
      const serialBatchBundle = (item as CartItem & { serial_batch_bundle?: unknown }).serial_batch_bundle;
      if (serialBatchBundle || item.bundle_entries) {
        saved[item.id] = {
          discountPercentage: persistedDiscountPercentage,
          discountAmount: persistedDiscountAmount,
          customRate: persistedCustomRate,
          customRateIncludesTax: (item as CartItem & { custom_rate_includes_tax?: boolean }).custom_rate_includes_tax,
          serial_batch_bundle: serialBatchBundle,
          bundle_entries: item.bundle_entries,
        };
      } else if (persistedDiscountAmount > 0 || persistedDiscountPercentage > 0 || persistedCustomRate !== undefined && persistedCustomRate !== null) {
        saved[item.id] = {
          discountPercentage: persistedDiscountPercentage,
          discountAmount: persistedDiscountAmount,
          customRate: persistedCustomRate,
          customRateIncludesTax: (item as CartItem & { custom_rate_includes_tax?: boolean }).custom_rate_includes_tax,
        };
      }
    });
    return saved;
  });
  const [itemBatches, setItemBatches] = useState<Record<string, any[]>>({});
  const [itemSerials, setItemSerials] = useState<Record<string, string[]>>({});

  const currency_symbol = posDetails?.currency_symbol;
  const autoFetchBatch = (posDetails as any)?.custom_autofetch_batchserial_ === 1;
  const isTaxIncludedInBasicRate =
    posDetails?.is_tax_included_in_basic_rate === 1
    || posDetails?.is_tax_included_in_basic_rate === "1"
    || posDetails?.is_tax_included_in_basic_rate === true;

  useEffect(() => {
    if (!selectedCustomer?.id || cartItems.length === 0) {
      setIsRecoveringCheckout(false);
      return;
    }

    const cartFingerprint = getCheckoutCartFingerprint(
      selectedCustomer.id,
      cartItems as unknown as Array<Record<string, unknown>>,
    );
    const attempt = getCheckoutAttemptForCart(cartFingerprint);
    if (!attempt) {
      setIsRecoveringCheckout(false);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    const recoveryDeadline = attempt.createdAt + 30_000;

    const recoverCheckout = async () => {
      try {
        const status = await getCheckoutRequestStatus(attempt.requestId);
        if (cancelled) return;

        if (status.invoice_name || status.invoice_id) {
          const invoiceName = status.invoice_name || status.invoice_id;
          clearCart();
          setItemDiscounts({});
          setIsRecoveringCheckout(false);
          if (status.checkout_status === "failed") {
            toast.error(`Checkout recovered as ${invoiceName}, but submission failed. Retry it from Invoice History.`);
          } else {
            toast.success(`Previous checkout recovered as invoice ${invoiceName}.`);
          }
          onClearCart?.();
          onPaymentCompleted?.();
          return;
        }

        if (Date.now() < recoveryDeadline) {
          setIsRecoveringCheckout(true);
          timer = window.setTimeout(recoverCheckout, 2000);
        } else {
          // Keep the same request ID for a safe resubmission, but unlock the checkout UI.
          setIsRecoveringCheckout(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to recover previous checkout:", error);
          setIsRecoveringCheckout(false);
        }
      }
    };

    setIsRecoveringCheckout(true);
    void recoverCheckout();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [cartItems, selectedCustomer?.id, clearCart, onClearCart, onPaymentCompleted]);

  useEffect(() => {
    // When a held invoice is loaded back into cart, restore per-line discounts from persisted draft fields.
    setItemDiscounts((prev) => {
      const next: Record<string, any> = {};

      cartItems.forEach((item) => {
        const existing = prev[item.id];
        const persistedDiscountAmount = Number((item as CartItem & { discount_amount?: number }).discount_amount) || 0;
        const persistedDiscountPercentage = Number((item as CartItem & { discount_percentage?: number }).discount_percentage) || 0;
        const persistedCustomRate = (item as CartItem & { custom_rate?: number }).custom_rate;
        const serialBatchBundle = (item as CartItem & { serial_batch_bundle?: unknown }).serial_batch_bundle;
        const bundleEntries = item.bundle_entries;

        if (existing) {
          next[item.id] = {
            ...existing,
            serial_batch_bundle: existing.serial_batch_bundle ?? serialBatchBundle,
            bundle_entries: existing.bundle_entries ?? bundleEntries,
          };
          return;
        }

        if (
          persistedDiscountAmount > 0
          || persistedDiscountPercentage > 0
          || (persistedCustomRate !== undefined && persistedCustomRate !== null)
          || serialBatchBundle
          || bundleEntries
        ) {
          next[item.id] = {
            discountPercentage: persistedDiscountPercentage,
            discountAmount: persistedDiscountAmount,
            customRate: persistedCustomRate,
            customRateIncludesTax: (item as CartItem & { custom_rate_includes_tax?: boolean }).custom_rate_includes_tax,
            serial_batch_bundle: serialBatchBundle,
            bundle_entries: bundleEntries,
          };
        }
      });

      return next;
    });
  }, [cartItems]);

  useEffect(() => {
    if (selectedCustomer && cartItems.length > 0) {
      // Keep saved draft pricing stable while editing a held invoice.
      if (getOriginalDraftInvoiceId()) {
        return;
      }
      refreshCartPricing();
    }
  }, [selectedCustomer?.id, cartItems.length, refreshCartPricing]);

  useEffect(() => {
    if (posDetails?.custom_sales_person_pin_required) {
      void ensureInitialized();
    }
  }, [posDetails?.custom_sales_person_pin_required, ensureInitialized]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      setExpandedItems((prev) => {
        if (prev.size === 0) return prev;

        const target = event.target as HTMLElement | null;
        if (!target) return prev;

        const clickedRow = target.closest("[data-cart-item-id]") as HTMLElement | null;
        const clickedItemId = clickedRow?.dataset.cartItemId;
        const activeElement = document.activeElement as HTMLElement | null;
        const activeRow = activeElement?.closest("[data-cart-item-id]") as HTMLElement | null;
        const activeItemId = activeRow?.dataset.cartItemId;
        const itemToKeepOpen =
          (clickedItemId && prev.has(clickedItemId) && clickedItemId) ||
          (activeItemId && prev.has(activeItemId) && activeItemId) ||
          null;

        if (!itemToKeepOpen) {
          return new Set();
        }

        if (prev.size === 1) {
          return prev;
        }

        return new Set([itemToKeepOpen]);
      });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const newBatches = { ...itemBatches };
      const newSerials = { ...itemSerials };
      for (const item of cartItems) {
        const key = item.item_code || item.id;
        if (key && key !== "undefined") {
          if (!newBatches[key]) {
            const batches = await getBatches(item.id);
            if (Array.isArray(batches)) newBatches[key] = batches;
          }
          if (!newSerials[key]) {
            const serials = await getSerials(key);
            if (Array.isArray(serials)) newSerials[key] = serials;
          }
        }
      }
      setItemBatches(newBatches);
      setItemSerials(newSerials);
    };
    if (cartItems.length) fetchData();
  }, [cartItems]);

  const getDiscountedPrice = (item: CartItem) => {
    return roundCurrency(getEffectiveItemRate(item, {
      itemDiscounts,
      isTaxIncludedInBasicRate,
    }));
  };

  const getDisplayPriceInclusive = (item: CartItem) => {
    return roundCurrency(getEffectiveDisplayRate(item, {
      itemDiscounts,
      isTaxIncludedInBasicRate,
    }));
  };

  const getOriginalDisplayPriceInclusive = (item: CartItem) => {
    return roundCurrency(getEffectiveDisplayRate(item, {
      itemDiscounts: {},
      isTaxIncludedInBasicRate,
    }));
  };

  const getLineTotalInclusive = (item: CartItem) => {
    return roundCurrency(getDisplayPriceInclusive(item) * item.quantity);
  };

  const subtotal = cartItems.reduce((sum, item) => roundCurrency(sum + getLineTotalInclusive(item)), 0);
  const totalItemDiscount = cartItems.reduce((sum, item) => {
    const original = roundCurrency(getOriginalDisplayPriceInclusive(item) * item.quantity);
    const discounted = getLineTotalInclusive(item);
    return roundCurrency(sum + roundCurrency(original - discounted));
  }, 0);
  const couponDiscount = 0;
  const total = roundCurrency(Math.max(0, subtotal - couponDiscount));

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
    } else {
      updateQuantity(id, quantity);
    }
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };

  const handleUOMChange = useCallback((itemId: string, uom: string, price: number) => {
    updateUOM(itemId, uom, price);
  }, [updateUOM]);

  const updateItemDiscount = (itemId: string, field: string, value: number | string) => {
    setItemDiscounts(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { discountPercentage: 0, discountAmount: 0 }), [field]: value }
    }));
  };

  const handleCustomRateChange = (item: CartItem, newRate?: number, includesTax?: boolean) => {
    setItemDiscounts(prev => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] || {}),
        customRate: newRate,
        customRateIncludesTax: includesTax,
        discountPercentage: 0,
        discountAmount: 0,
      }
    }));
  };

  const handleBundleUpdate = (itemId: string, bundleId: string, entries: any[]) => {
    updateItemDiscount(itemId, "serial_batch_bundle", bundleId);
    updateItemDiscount(itemId, "bundle_entries", JSON.stringify(entries));
  };

  const handleDuplicateItem = (item: CartItem) => {
    const newItem = {
      ...item,
      id: `${item.item_code || item.id}-${Date.now()}`,
      item_code: item.item_code || item.id,
      quantity: 1,
    };
    useCartStore.getState().addToCart(newItem);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleCustomerClear = () => {
    setSelectedCustomer(null);
  };

  const validateCustomer = () => {
    if (!selectedCustomer) {
      toast.error("Kindly choose customer");
      return false;
    }
    return true;
  };

  const startCheckoutFlow = async () => {
    if (!validateCustomer() || isValidatingCheckout) return;
    setIsValidatingCheckout(true);
    try {
      const payload = {
        customer: { id: selectedCustomer?.id },
        items: cartItems.map(item => ({
          id: item.item_code || item.id,
          quantity: item.quantity,
          price: getDiscountedPrice(item),
          uom: item.uom || "Nos",
          serial_batch_bundle: item.bundle_entries,
        })),
        itemDiscounts,
        businessType: posDetails?.business_type,
      };
      await validateCheckoutInvoice(payload);
      setShowPaymentDialog(true);
    } catch (error) {
      toast.error(extractErrorFromException(error, "Checkout validation failed"));
    } finally {
      setIsValidatingCheckout(false);
    }
  };

  const holdCurrentOrder = async () => {
    if (!selectedCustomer) {
      toast.error("Kindly select a customer");
      return;
    }
    if (isHoldingOrder) return;

    setIsHoldingOrder(true);
    try {
      const originalDraftInvoiceId = getOriginalDraftInvoiceId();
      const result = await createDraftSalesInvoice({
        items: cartItems.map((item) => ({
          ...item,
          price: getDiscountedPrice(item),
        })),
        customer: { id: selectedCustomer.id },
        subtotal,
        total,
        appliedCoupons: [],
        itemDiscounts,
        totalItemDiscount,
        totalSavings: totalItemDiscount + couponDiscount,
        status: "held",
        salesperson: activeSalesperson?.name || null,
        draft_invoice_id: originalDraftInvoiceId,
      });
      if (result?.success) {
        handleClearCart();
        toast.success(originalDraftInvoiceId ? "Draft invoice updated and order held successfully!" : "Draft invoice created and order held successfully!");
      }
    } catch (error) {
      toast.error(extractErrorFromException(error, "Failed to create draft invoice"));
    } finally {
      setIsHoldingOrder(false);
    }
  };

  const requireSalespersonAndRun = async (action: "checkout" | "hold") => {
    const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required;
    if (!requiresSalespersonPin || activeSalesperson) {
      if (action === "checkout") {
        await startCheckoutFlow();
      } else {
        await holdCurrentOrder();
      }
      return;
    }

    setPendingSalespersonAction(action);
    setShowSalespersonAuthModal(true);
  };

  const handleCheckoutClick = async () => {
    if (isRecoveringCheckout) {
      toast.info("Checking whether the previous checkout already created an invoice.");
      return;
    }
    await requireSalespersonAndRun("checkout");
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    clearCart();
    setItemDiscounts({});
    onClearCart?.();
  };

  const handleSalespersonAuthenticated = () => {
    const nextAction = pendingSalespersonAction;
    setPendingSalespersonAction(null);
    setShowSalespersonAuthModal(false);

    if (nextAction === "checkout") {
      void startCheckoutFlow();
    }

    if (nextAction === "hold") {
      void holdCurrentOrder();
    }
  };

  const handleCompletePayment = async (paymentData: any) => {
  };

  const handleClosePaymentDialog = async (paymentCompleted?: boolean) => {
    setShowPaymentDialog(false);
    if (paymentCompleted) {
      handleClearCart();
      onPaymentCompleted?.();
    }

    try {
      await refreshStockOnly();
      const cartItemCodes = cartItems.map((item) => item.item_code || item.id);
      if (cartItemCodes.length > 0) {
        // await updateBatchQuantitiesForItems(cartItemCodes);
      }
    } catch (error: any) {
      console.error("OrderSummary: Failed to refresh stock:", error);
      toast.error(`Failed to update stock: ${error.message || "Unknown error"}`);
    }
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems((prev) => {
      if (prev.has(itemId)) {
        return new Set();
      }

      return new Set([itemId]);
    });
  };

  return (
    <div
      className={`${
        isMobile ? "h-full flex flex-col" : "h-full flex flex-col"
      } bg-white dark:bg-gray-800 ${
        !isMobile ? "border-l" : ""
      } border-gray-200 dark:border-gray-700`}
    >
      <div className={!isMobile ? "px-6 py-4 border-b border-gray-100 dark:border-gray-700" : ""}>
        <CustomerSearchSection
          selectedCustomer={selectedCustomer}
          onCustomerSelect={handleCustomerSelect}
          onCustomerClear={handleCustomerClear}
          isMobile={isMobile}
        />
        <CustomerLoyaltySummary
          customer={selectedCustomer}
          currencySymbol={currency_symbol}
        />
      </div>

      <div
        className={`${
          isMobile
            ? "flex-1 overflow-y-auto custom-scrollbar p-4"
            : "flex-1 overflow-y-auto p-6 cart-scroll"
        }`}
      >
        <div className="space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Your cart is empty
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Add some items to get started!
              </p>
            </div>
          ) : (
            cartItems.map((item) => {
              const itemDiscount = itemDiscounts[item.id] || {
                discountPercentage: 0,
                discountAmount: 0,
                batchNumber: "",
                serialNumber: "",
                availableQuantity: 150,
              };

              return (
                <CartItemRow
                  key={item.id}
                  item={item}
                  itemId={item.id}
                  isExpanded={expandedItems.has(item.id)}
                  onToggleExpand={() => toggleItemExpansion(item.id)}
                  itemDiscount={itemDiscount}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onUOMChange={handleUOMChange}
                  onDiscountChange={updateItemDiscount}
                  onCustomRateChange={handleCustomRateChange}
                  onDuplicateItem={handleDuplicateItem}
                  onBundleUpdate={handleBundleUpdate}
                  selectedCustomer={selectedCustomer}
                  posDetails={posDetails}
                  itemBatches={itemBatches[item.item_code || item.id] || []}
                  itemSerials={itemSerials[item.item_code || item.id] || []}
                  currency_symbol={currency_symbol}
                  isMobile={isMobile}
                  autoFetchBatch={autoFetchBatch}
                />
              );
            })
          )}
        </div>
      </div>

      {cartItems.length > 0 && (
        <OrderSummaryFooter
          subtotal={subtotal}
          total={total}
          totalItemDiscount={totalItemDiscount}
          couponDiscount={couponDiscount}
          onCheckout={handleCheckoutClick}
          onClearCart={handleClearCart}
          onHoldOrder={() => {
            if (!validateCustomer()) return;
            void requireSalespersonAndRun("hold");
          }}
          isHoldingOrder={isHoldingOrder}
          isValidating={isValidatingCheckout || isRecoveringCheckout}
          isMobile={isMobile}
          currency_symbol={currency_symbol}
          allow_holding_invoices={posDetails?.allow_holding_invoices === 1}
        />
      )}

      {showPaymentDialog && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={handleClosePaymentDialog}
          cartItems={cartItems.map((item) => ({
            ...item,
            discountedPriceExcl: getDiscountedPrice(item),
            discountedPriceIncl: getDisplayPriceInclusive(item),
            discountedPrice: getDisplayPriceInclusive(item),
            itemDiscount: itemDiscounts[item.id] || {},
            originalPrice: roundCurrency(item.price),
            finalAmount: getLineTotalInclusive(item),
          }))}
          appliedCoupons={[]}
          selectedCustomer={selectedCustomer}
          onCompletePayment={handleCompletePayment}
          onHoldOrder={() => setShowPaymentDialog(false)}
          isMobile={isMobile}
          itemDiscounts={itemDiscounts}
          totalItemDiscount={totalItemDiscount}
        />
      )}

      <SalespersonAuthModal
        isOpen={showSalespersonAuthModal}
        onClose={() => {
          setShowSalespersonAuthModal(false);
          setPendingSalespersonAction(null);
        }}
        onAuthenticated={handleSalespersonAuthenticated}
        allowDismiss
        title="Start transaction"
        description="Verify the salesperson before checkout or holding this order."
      />
    </div>
  );
}
