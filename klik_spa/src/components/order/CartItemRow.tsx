"use client";

import { useState, useEffect, useCallback } from "react";
import { Minus, Plus, X, Copy, Package, ChevronDown, ChevronUp, AlertTriangle, Eye } from "lucide-react";
import { toast } from "react-toastify";
import type { BundleEntry, CartItem } from "../../../types";
import { QuantityInput } from "./QuantityInput";
import { formatCurrencyWithSymbol } from "../../utils/currency";
import { UOMSelectField } from "./UOMSelectField";
import { SerialBatchBundleModal } from "./SerialBatchBundleSelector";
import { useCartStore } from "../../stores/cartStore";
import ProductDetailsModal from "../ProductDetailsModal";

interface CartItemRowProps {
  item: CartItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  itemDiscount: any;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onUOMChange: (itemId: string, uom: string, price: number) => void;
  onDiscountChange: (itemId: string, field: string, value: number | string) => void;
  onCustomRateChange: (item: CartItem, rate?: number) => void;
  onDuplicateItem: (item: CartItem) => void;
  onBundleUpdate?: (itemId: string, bundleId: string, entries: any[]) => void;
  selectedCustomer?: { id: string } | null;
  posDetails: any;
  itemBatches: any[];
  itemSerials: string[];
  currency_symbol?: string;
  isMobile?: boolean;
  autoFetchBatch?: boolean;
}

interface BatchData {
  batch_no: string;
  qty: number;
  expiry_date: string;
  manufacturing_date: string;
}

interface SerialData {
  serial_no: string;
}

interface PriceListEntry {
  price_list: string;
  rate: number;
  currency: string;
  uom?: string;
  customer?: string;
  note?: string;
  cost: number;
  margin: number;
  margin_pct: number;
}

interface WarehouseStock {
  warehouse: string;
  bal_qty: number;
  val_rate: number;
}

interface ItemFullData {
  item_name: string;
  item_code: string;
  standard_rate: number;
  valuation_rate: number;
  price_lists: PriceListEntry[];
  batches: BatchData[];
  serials: SerialData[];
  warehouse_stock: WarehouseStock[];
  uom: string;
  brand?: string;
  has_batch_no: number;
  has_serial_no: number;
  total_bal_qty: number;
  global_stock_total?: {
    total_qty: number;
    total_value: number;
    avg_valuation_rate: number;
  };
}

export const CartItemRow = ({
  item,
  isExpanded,
  onToggleExpand,
  itemDiscount,
  onUpdateQuantity,
  onRemoveItem,
  onUOMChange,
  onDiscountChange,
  onCustomRateChange,
  onDuplicateItem,
  onBundleUpdate,
  selectedCustomer,
  posDetails,
  currency_symbol,
  isMobile,
  autoFetchBatch = false,
}: CartItemRowProps) => {
  const { updateItemBundleEntries } = useCartStore();
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [isBundleDetailsOpen, setIsBundleDetailsOpen] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [bundleEntries, setBundleEntries] = useState<BundleEntry[]>(() => {
    if (item.bundle_entries && Array.isArray(item.bundle_entries)) {
      return item.bundle_entries;
    }
    if (itemDiscount.bundle_entries && typeof itemDiscount.bundle_entries === "string") {
      try {
        return JSON.parse(itemDiscount.bundle_entries);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [availableBatches, setAvailableBatches] = useState<BatchData[]>([]);
  const [availableSerials, setAvailableSerials] = useState<SerialData[]>([]);
  const [isFetchingBundleData, setIsFetchingBundleData] = useState(false);
  const [modalEntries, setModalEntries] = useState<BundleEntry[]>([]);
  const [modalQty, setModalQty] = useState(item.quantity);
  const [isRateEditing, setIsRateEditing] = useState(false);
  const [rateInputValue, setRateInputValue] = useState("");
  const [localDiscountPct, setLocalDiscountPct] = useState<number>(() => {
    const amt = itemDiscount.discountAmount || 0;
    return item.price > 0 ? parseFloat(((amt / item.price) * 100).toFixed(2)) : 0;
  });

  useEffect(() => {
    const amt = itemDiscount.discountAmount || 0;
    const nextDiscountPct = item.price > 0 ? parseFloat(((amt / item.price) * 100).toFixed(2)) : 0;
    setLocalDiscountPct(nextDiscountPct);
  }, [itemDiscount.discountAmount, item.price]);
  const [fullItemData, setFullItemData] = useState<ItemFullData | null>(null);
  const [isLoadingFullData, setIsLoadingFullData] = useState(false);

  const hasSerialOrBatch = item.has_serial_no || item.has_batch_no;
  const warehouse = posDetails?.warehouse || "";
  const restrictCostVisibility = posDetails?.restrict_cost_visibility_in_tooltip ?? true;

  const fetchFullItemDetails = useCallback(async () => {
    if (!warehouse) return;
    setIsLoadingFullData(true);
    try {
      const response = await fetch(
        `/api/method/klik_pos.api.item.item_details.get_full_pricing_and_batch_details?item_code=${encodeURIComponent(item.item_code || item.id)}&warehouse=${encodeURIComponent(warehouse)}`
      );
      const res = await response.json();
      if (res?.message) {
        setFullItemData(res.message);
      }
    } catch (error) {
      console.error("Failed to fetch full item details:", error);
    } finally {
      setIsLoadingFullData(false);
    }
  }, [item.item_code, item.id, warehouse]);

  useEffect(() => {
    if (isExpanded && warehouse) {
      fetchFullItemDetails();
    }
  }, [isExpanded, warehouse, fetchFullItemDetails]);

  const saveToCart = useCallback((entries: BundleEntry[]) => {
    const validEntries = entries.map(({ selected, ...e }) => e);
    setBundleEntries(validEntries);
    updateItemBundleEntries(item.id, validEntries);
    if (onBundleUpdate) {
      onBundleUpdate(item.id, "", validEntries);
    }
  }, [item.id, updateItemBundleEntries, onBundleUpdate]);

  const fetchBundleData = useCallback(async (qty: number, shouldSaveToCart: boolean = false) => {
    if (!warehouse) return;
    if (!item.has_serial_no && !item.has_batch_no) return;

    setIsFetchingBundleData(true);
    try {
      const params = new URLSearchParams({
        item_code: item.item_code || item.id,
        warehouse: warehouse,
        customer: selectedCustomer?.id || "",
        qty: qty.toString(),
        based_on: "FIFO",
        has_serial_no: item.has_serial_no ? "1" : "0",
        has_batch_no: item.has_batch_no ? "1" : "0",
      });

      const response = await fetch(`/api/method/klik_pos.api.item.bundle.get_available_batches_and_serials?${params.toString()}`);
      const result = await response.json();

      if (result.message) {
        const data = result.message;
        if (data.batches && Array.isArray(data.batches)) {
          setAvailableBatches(data.batches);
        } else {
          setAvailableBatches([]);
        }
        if (data.serials && Array.isArray(data.serials)) {
          setAvailableSerials(data.serials);
        } else {
          setAvailableSerials([]);
        }
      }

      if (qty > 0) {
        const autoDataResponse = await fetch(`/api/method/erpnext.stock.doctype.serial_and_batch_bundle.serial_and_batch_bundle.get_auto_data?${params.toString()}`);
        const autoDataResult = await autoDataResponse.json();

        if (autoDataResult.message && Array.isArray(autoDataResult.message) && autoDataResult.message.length > 0) {
          const autoEntries = autoDataResult.message.map((row: any) => ({
            serial_no: row.serial_no || undefined,
            batch_no: row.batch_no || undefined,
            warehouse: row.warehouse || posDetails.warehouse || "",
            qty: row.qty || 1,
            selected: false,
          }));
          setModalEntries(autoEntries);
          if (shouldSaveToCart) {
            saveToCart(autoEntries);
          }
        } else {
          setModalEntries([{
            qty: 1,
            selected: false,
            serial_no: item.has_serial_no ? "" : undefined,
            batch_no: item.has_batch_no ? "" : undefined,
            warehouse: posDetails.warehouse || "",
          }]);
          if (shouldSaveToCart) {
            saveToCart([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch bundle data:", error);
      toast.error("Failed to fetch batch/serial data");
    } finally {
      setIsFetchingBundleData(false);
    }
  }, [item, warehouse, selectedCustomer, saveToCart]);

  useEffect(() => {
    if (hasSerialOrBatch && warehouse && autoFetchBatch && item.quantity > 0) {
      fetchBundleData(item.quantity, true);
    }
  }, [item.quantity, warehouse, autoFetchBatch, hasSerialOrBatch]);

  useEffect(() => {
    if (bundleEntries.length > 0 && !autoFetchBatch) {
      setModalEntries(bundleEntries);
    }
  }, [bundleEntries, autoFetchBatch]);

  const handleOpenModal = () => {
    if (hasSerialOrBatch) {
      setModalQty(item.quantity);
      if (!autoFetchBatch && item.quantity > 0) {
        fetchBundleData(item.quantity, false);
      } else if (autoFetchBatch && bundleEntries.length === 0 && item.quantity > 0) {
        fetchBundleData(item.quantity, true);
      }
      setShowBundleModal(true);
    }
  };

  const handleBundleSave = (entries: BundleEntry[]) => {
    if (!Array.isArray(entries)) {
      toast.error("Invalid bundle entries");
      return;
    }
    
    const totalBundleQty = entries.reduce((sum, entry) => sum + (Number(entry.qty) || 0), 0);
    
    if (totalBundleQty !== item.quantity) {
      onUpdateQuantity(item.id, totalBundleQty);
    }
    
    saveToCart(entries);
    setShowBundleModal(false);
  };

  const handleModalQtyChange = async (newQty: number) => {
    setModalQty(newQty);
    if (autoFetchBatch && newQty > 0) {
      await fetchBundleData(newQty, true);
    }
  };

  const handleModalFetchData = async (qty: number) => {
    await fetchBundleData(qty, true);
  };

  const handleRateChange = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      onCustomRateChange(item, undefined);
      onDiscountChange(item.id, "discountAmount", 0);
      setLocalDiscountPct(0);
      return;
    }

    const rate = Math.max(0, value);
    onCustomRateChange(item, rate);
    onDiscountChange(item.id, "discountAmount", 0);

    const diff = item.price - rate;
    if (diff > 0) {
      onDiscountChange(item.id, "discountAmount", diff);
    } else {
      setLocalDiscountPct(0);
    }
  };

  const handleDiscountPercentageChange = (value: number) => {
    const pct = Math.min(100, Math.max(0, value || 0));
    const amt = parseFloat(((item.price * pct) / 100).toFixed(2));
    setLocalDiscountPct(pct);
    onDiscountChange(item.id, "discountAmount", amt);
  };

  const handleDiscountAmountChange = (value: number) => {
    const amt = Math.max(0, value || 0);
    onDiscountChange(item.id, "discountAmount", amt);
    setLocalDiscountPct(item.price > 0 ? parseFloat(((amt / item.price) * 100).toFixed(2)) : 0);
  };

  const discountedPrice = (() => {
    if (itemDiscount.customRate !== undefined && itemDiscount.customRate !== null) {
      return Math.max(0, itemDiscount.customRate);
    }
    return Math.max(0, item.price - (itemDiscount.discountAmount || 0));
  })();
  const originalTotal = item.price * item.quantity;
  const discountedTotal = discountedPrice * item.quantity;
  const amount = (itemDiscount.customRate !== undefined && itemDiscount.customRate !== null ? itemDiscount.customRate : item.price) * item.quantity;
  const displayRate = itemDiscount.customRate ?? (item.price > 0 ? item.price : "");

  const hasBundleEntries = bundleEntries.length > 0;

  const currentWarehouseStock = fullItemData?.warehouse_stock?.find(wh => wh.warehouse === warehouse);
  const availableStock = currentWarehouseStock?.bal_qty || 0;
  const valuationRate = typeof currentWarehouseStock?.val_rate === "number" ? currentWarehouseStock.val_rate : null;
  const hasValidValuationRate = valuationRate !== null && valuationRate > 0;
  const isNegativeMargin = hasValidValuationRate ? discountedPrice < valuationRate : false;
  const marginAmount = hasValidValuationRate ? discountedPrice - valuationRate : 0;
  const marginPercentage = hasValidValuationRate ? (marginAmount / valuationRate) * 100 : 0;

  const showPositiveMarginWarning = !restrictCostVisibility && hasValidValuationRate && !isNegativeMargin && discountedPrice > valuationRate;
  const showNegativeMarginWarning = !restrictCostVisibility && hasValidValuationRate && isNegativeMargin && discountedPrice > 0;
  const showStockWarning = item.quantity > availableStock && availableStock > 0;
  const showNoStockWarning = availableStock === 0;

  return (
    <>
      <div className={isMobile ? "bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden" : ""}>
        <div className={`flex items-center ${isMobile ? "p-3" : "py-2"}`}>
          <div className="flex-shrink-0 mr-2">
            <button
              onClick={onToggleExpand}
              className={`${
                isMobile ? "w-5 h-5" : "w-5 h-5"
              } rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200`}
              title="Show/Hide Details"
            >
              <svg
                className={`${
                  isMobile ? "w-3 h-3" : "w-4 h-4"
                } text-beveren-500 dark:text-gray-400 transform transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {item.image ? (
            <div className="flex-shrink-0">
              <img
                src={item.image}
                alt={item.name}
                className={`${
                  isMobile ? "w-16 h-16" : "w-12 h-12"
                } rounded-lg object-cover`}
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <></>
          )}

          <div className="flex-1 min-w-0 px-3">
            <h4
              className={`font-semibold text-gray-900 dark:text-white ${
                isMobile ? "text-base" : "text-sm"
              } truncate`}
            >
              {item.name}
            </h4>
            <p
              className={`text-gray-500 dark:text-gray-400 capitalize font-medium ${
                isMobile ? "text-sm" : "text-xs"
              }`}
            >
              {item.category}
            </p>
            <div className={`${isMobile ? "text-base" : "text-sm"}`}>
              {discountedPrice !== item.price ? (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 line-through text-xs">
                    {formatCurrencyWithSymbol(item.price, currency_symbol)}
                  </span>
                  <span className="text-beveren-600 dark:text-beveren-400 font-semibold">
                    {formatCurrencyWithSymbol(discountedPrice, currency_symbol)}
                  </span>
                </div>
              ) : (
                <div className="text-beveren-600 dark:text-beveren-400 font-semibold">
                  {formatCurrencyWithSymbol(item.price, currency_symbol)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center ml-10 space-x-1 min-w-[70px] justify-center">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              className={`${
                isMobile ? "w-8 h-8" : "w-5 h-5"
              } rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors`}
            >
              <Minus
                size={isMobile ? 16 : 14}
                className="text-gray-600 dark:text-gray-400"
              />
            </button>
            <span
              className={`${
                isMobile ? "w-10" : "w-8"
              } text-center font-semibold text-gray-900 dark:text-white text-sm`}
            >
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className={`${
                isMobile ? "w-8 h-8" : "w-7 h-7"
              } rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors`}
            >
              <Plus
                size={isMobile ? 16 : 14}
                className="text-blue-600 dark:text-blue-400"
              />
            </button>
          </div>

          <div className="flex-shrink-0 text-right min-w-[80px] px-2">
            {discountedTotal !== originalTotal ? (
              <div>
                <p className="text-gray-400 line-through text-xs">
                  {formatCurrencyWithSymbol(originalTotal, currency_symbol)}
                </p>
                <p
                  className={`text-beveren-600 dark:text-beveren-400 font-semibold ${
                    isMobile ? "text-base" : "text-sm"
                  }`}
                >
                  {formatCurrencyWithSymbol(discountedTotal, currency_symbol)}
                </p>
              </div>
            ) : (
              <p
                className={`text-beveren-600 dark:text-beveren-400 font-semibold ${
                  isMobile ? "text-base" : "text-sm"
                }`}
              >
                {formatCurrencyWithSymbol(amount, currency_symbol)}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 ml-2 flex gap-1">
            <button
              onClick={() => onRemoveItem?.(item.id)}
              className={`${
                isMobile ? "w-8 h-8" : "w-6 h-6"
              } rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors`}
              title="Remove item"
            >
              <X size={isMobile ? 16 : 12} />
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div
            className={`border-t border-gray-200 dark:border-gray-600 ${
              isMobile ? "px-3 pb-3" : "px-6 py-3 ml-7"
            } bg-gray-25 dark:bg-gray-750`}
          >
            <div className="w-full">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    Quantity
                  </label>
                  <QuantityInput
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    isMobile={isMobile}
                  />
                </div>
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    UOM
                  </label>
                  <UOMSelectField
                    item={item}
                    onUOMChange={onUOMChange}
                    isMobile={isMobile}
                    selectedCustomer={selectedCustomer}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={isRateEditing ? rateInputValue : displayRate}
                    onFocus={() => {
                      setIsRateEditing(true);
                      setRateInputValue(String(displayRate));
                    }}
                    onBlur={() => {
                      setIsRateEditing(false);
                      setRateInputValue("");
                    }}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setRateInputValue(value);

                      if (value === "") {
                        handleRateChange(undefined);
                        return;
                      }

                      const parsedValue = parseFloat(value);
                      handleRateChange(Number.isNaN(parsedValue) ? undefined : parsedValue);
                    }}
                    readOnly={!posDetails?.allow_rate_change}
                    placeholder="0"
                    className={`w-full ${isMobile ? "text-sm" : "text-sm"} px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                      showNegativeMarginWarning ? "border-red-300 dark:border-red-600" : showPositiveMarginWarning ? "border-blue-300 dark:border-blue-600" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    readOnly
                    className={`w-full ${isMobile ? "text-sm" : "text-sm"} px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemDiscount.discountAmount || ""}
                    onChange={(e) => handleDiscountAmountChange(parseFloat(e.target.value) || 0)}
                    readOnly={!posDetails?.allow_discount_change}
                    placeholder="0.00"
                    className={`w-full ${isMobile ? "text-sm" : "text-sm"} px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                  />
                </div>
                <div>
                  <label className={`block text-gray-700 dark:text-gray-300 font-medium ${isMobile ? "text-sm" : "text-sm"} mb-2`}>
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={localDiscountPct || ""}
                    onChange={(e) => handleDiscountPercentageChange(parseFloat(e.target.value) || 0)}
                    readOnly={!posDetails?.allow_discount_change}
                    placeholder="0.0"
                    className={`w-full ${isMobile ? "text-sm" : "text-sm"} px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                  />
                </div>
              </div>

              {hasSerialOrBatch ? (
                <div className="mb-4">
                  <button
                    onClick={handleOpenModal}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border ${
                      hasBundleEntries
                        ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                        : "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                    } transition-colors ${isMobile ? "text-sm" : "text-sm"} font-medium`}
                  >
                    <Package size={isMobile ? 16 : 14} />
                    {hasBundleEntries ? "Update Serial/Batch" : "Add Serial/Batch"}
                  </button>
                </div>
              ) : (
                <></>
              )}

              {hasBundleEntries ? (
                <div className="mt-3 rounded-md border border-blue-200 dark:border-blue-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsBundleDetailsOpen(!isBundleDetailsOpen)}
                    className="w-full flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <span className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                      Batch/Serial Details:
                    </span>
                    {isBundleDetailsOpen ? (
                      <ChevronUp size={14} className="text-blue-800 dark:text-blue-300" />
                    ) : (
                      <ChevronDown size={14} className="text-blue-800 dark:text-blue-300" />
                    )}
                  </button>
                  {isBundleDetailsOpen ? (
                    <div className="p-2 pt-0 bg-blue-50 dark:bg-blue-900/20 space-y-1">
                      {bundleEntries.map((entry, idx) => (
                        <div key={idx} className="text-xs text-blue-700 dark:text-blue-400">
                          {entry.serial_no ? <span>Serial: {entry.serial_no} </span> : <></>}
                          {entry.batch_no ? <span>Batch: {entry.batch_no} </span> : <></>}
                          {entry.qty ? <span>Qty: {entry.qty}</span> : <></>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <></>
                  )}
                </div>
              ) : (
                <></>
              )}


            {isLoadingFullData ? (
              <div className="flex items-center justify-center py-4 mt-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-beveren-500 border-t-transparent" />
                <span className="ml-2 text-xs text-gray-500">Loading details...</span>
              </div>
            ) : (
              <div className="space-y-3 mt-3">
                {showNoStockWarning ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
                    <span className="text-xs text-red-700 dark:text-red-300">
                      No stock available in {warehouse}
                    </span>
                  </div>
                ) : showStockWarning ? (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs text-yellow-700 dark:text-yellow-300">
                      Only {availableStock} units available in {warehouse}
                    </span>
                  </div>
                ) : null}

                {currentWarehouseStock && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Stock Balance</p>
                      <p className="text-base font-bold text-gray-900 dark:text-white">
                        {currentWarehouseStock.bal_qty.toLocaleString()} {fullItemData?.uom}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">in {warehouse}</p>
                    </div>
                    {!restrictCostVisibility && (
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Valuation Rate</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">
                          {formatCurrencyWithSymbol(currentWarehouseStock.val_rate, currency_symbol)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">per {fullItemData?.uom}</p>
                      </div>
                    )}
                  </div>
                )}

                {showPositiveMarginWarning && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Margin Analysis:</span>
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        +{formatCurrencyWithSymbol(marginAmount, currency_symbol)} ({marginPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                      Selling above valuation rate
                    </div>
                  </div>
                )}

                {showNegativeMarginWarning && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-700 dark:text-red-300 font-medium">Margin Alert:</span>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                        {formatCurrencyWithSymbol(marginAmount, currency_symbol)} ({marginPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle size={12} className="text-red-600 dark:text-red-400" />
                      <span className="text-[10px] text-red-600 dark:text-red-400">
                        Selling below valuation rate - potential loss of {formatCurrencyWithSymbol(Math.abs(marginAmount), currency_symbol)} per unit
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(itemDiscount.discountAmount > 0) ? (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                <div className="text-xs text-green-800 dark:text-green-300 font-medium">
                  Discount Applied:
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-green-700 dark:text-green-400">
                    {localDiscountPct > 0 ? `${localDiscountPct.toFixed(1)}% off` : ""}
                    {localDiscountPct > 0 ? " · " : ""}
                    {formatCurrencyWithSymbol(itemDiscount.discountAmount, currency_symbol)}
                  </span>
                  <span className="text-xs font-semibold text-green-800 dark:text-green-300">
                    Save {formatCurrencyWithSymbol(originalTotal - discountedTotal, currency_symbol)}
                  </span>
                </div>
              </div>
            ) : (
              <></>
            )}

              <div className="grid grid-cols-2 gap-3 my-3">
                <button
                  type="button"
                  onClick={() => onDuplicateItem(item)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-beveren-400 dark:border-beveren-500 text-beveren-600 dark:text-beveren-400 bg-beveren-50 dark:bg-beveren-900/20 hover:bg-beveren-100 dark:hover:bg-beveren-900/40 transition-colors text-sm font-medium"
                  title="Add another line for the same product with a different batch, serial or UOM"
                >
                  <Copy size={isMobile ? 15 : 13} />
                  Duplicate Line
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium"
                >
                  <Eye size={isMobile ? 15 : 13} />
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        ) : (
          <></>
        )}

        <SerialBatchBundleModal
          isOpen={showBundleModal}
          onClose={() => setShowBundleModal(false)}
          onSave={handleBundleSave}
          item={{
            id: item.id,
            item_code: item.item_code,
            name: item.name,
            has_serial_no: item.has_serial_no,
            has_batch_no: item.has_batch_no,
          }}
          warehouse={warehouse}
          qty={modalQty}
          onQtyChange={handleModalQtyChange}
          availableBatches={availableBatches}
          availableSerials={availableSerials}
          entries={modalEntries}
          onEntriesChange={setModalEntries}
          isLoading={isFetchingBundleData}
          onFetchData={handleModalFetchData}
          autoFetchBatch={autoFetchBatch}
        />
      </div>

      {showProductModal && (
        <ProductDetailsModal
          item={{
            id: item.item_code || item.id,
            name: item.name,
            item_code: item.item_code,
            category: item.category,
            image: item.image,
            currency_symbol: currency_symbol,
          }}
          warehouse={warehouse}
          onClose={() => setShowProductModal(false)}
        />
      )}
    </>
  );
};