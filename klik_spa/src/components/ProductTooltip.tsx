"use client";

import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import type { MenuItem } from "../../types";
import { usePOSProfileStore } from "../stores/posProfileStore";
import { formatCurrencyWithSymbol } from "../utils/currency";

interface Batch {
  batch_id: string;
  qty: number;
  expiry_date?: string;
}

interface PriceListEntry {
  price_list: string;
  rate: number;
  currency?: string;
  uom?: string;
  customer?: string;
  note?: string;
}

interface ItemFullData {
  item_name: string;
  item_code: string;
  standard_rate: number;
  valuation_rate: number;
  price_lists: PriceListEntry[];
  batches: Batch[];
  uom: string;
  brand?: string;
}

interface ProductTooltipProps {
  item: MenuItem;
  warehouse?: string;
  onClose: () => void;
  onViewDetails: (item: MenuItem) => void;
}

export default function ProductTooltip({
  item,
  onClose,
  onViewDetails,
}: ProductTooltipProps) {
  const [data, setData] = useState<ItemFullData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [position, setPosition] = useState({ top: true, left: true });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { posDetails, loading, hideUnavailableItems, useScannerOnly, scalePrefix, defaultView } = usePOSProfileStore();

  const warehouse = useMemo(() => {
    if (loading) return null;
    return posDetails?.warehouse;
  }, [posDetails, loading]);

  const restrictCostVisibility = useMemo(() => {
    if (loading) return true;
    return (posDetails as any)?.restrict_cost_visibility_in_tooltip ?? true;
  }, [posDetails, loading]);

  useEffect(() => {
    const fetchFullData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/method/klik_pos.api.item.item_details.get_full_pricing_and_batch_details?item_code=${encodeURIComponent(item.id)}&warehouse=${encodeURIComponent(String(warehouse ?? ""))}`,
        );
        const res = await response.json();
        if (res?.message) setData(res.message);
      } catch (error) {
        console.error("Tooltip fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (warehouse !== null) {
      fetchFullData();
    }
  }, [item.id, warehouse]);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;

    const parent = el.offsetParent as HTMLElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const centerY = parentRect.top + parentRect.height / 2;
    const centerX = parentRect.left + parentRect.width / 2;
    const screenMidY = window.innerHeight / 2;
    const screenThirdX = window.innerWidth / 3;

    setPosition({
      top: centerY < screenMidY,
      left: centerX < screenThirdX,
    });
  }, [isLoading]);

  const costPrice = data?.valuation_rate || data?.standard_rate || item.cost_price || 0;
  const margin = item.price - costPrice;
  const marginPercentage = costPrice > 0 ? (margin / item.price) * 100 : 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onViewDetails(item);
  };

  const verticalClass = position.top
    ? "top-[calc(100%-5px)]"
    : "bottom-full -mb-2";
  const horizontalClass = position.left ? "left-0" : "right-0";

  if (restrictCostVisibility) {
    return (
      <div
        ref={tooltipRef}
        onClick={handleClick}
        className={`absolute z-[100] w-80 !opacity-100 bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${verticalClass} ${horizontalClass} text-left cursor-pointer`}
      >
        <div className="border-b border-gray-100 dark:border-gray-700 pb-2 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-white leading-tight truncate">
                {item.name}
              </h3>
              <p className="text-[10px] text-gray-400 font-mono">{item.id}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close tooltip"
            >
              ×
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
              Loading details...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
              <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold tracking-wide">
                Sale Price
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(item.price, item.currency_symbol)}
              </p>
            </div>

            {data?.batches && data.batches.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>📦</span> Batch Stock
                </p>
                <div className="space-y-1">
                  {data.batches.slice(0, 3).map((batch, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-gray-500 font-mono">
                        {batch.batch_id}
                      </span>
                      <div className="flex gap-3">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          Qty: {batch.qty}
                        </span>
                        {batch.expiry_date && (
                          <span className="text-gray-400 text-[10px]">
                            Exp:{" "}
                            {new Date(batch.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {data.batches.length > 3 && (
                    <div className="text-[10px] text-gray-400 text-center pt-1">
                      +{data.batches.length - 3} more batches
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                Click to view full details →
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={tooltipRef}
      onClick={handleClick}
      className={`absolute z-[100] w-80 bg-white dark:bg-gray-800 shadow-2xl rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${verticalClass} ${horizontalClass} text-left cursor-pointer`}
    >
      <div className="border-b border-gray-100 dark:border-gray-700 pb-2 mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white leading-tight truncate">
              {item.name}
            </h3>
            <p className="text-[10px] text-gray-400 font-mono">{item.id}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close tooltip"
          >
            ×
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center py-6">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Loading details...
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                Sale Price
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(item.price, item.currency_symbol)}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                Our Cost
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(costPrice, item.currency_symbol)}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-3 rounded-lg">
            <div className="flex justify-between items-baseline">
              <div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold tracking-wide">
                  Profit Margin
                </p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatCurrencyWithSymbol(margin, item.currency_symbol)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold tracking-wide">
                  Markup
                </p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {marginPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-emerald-200 dark:bg-emerald-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                style={{ width: `${Math.min(marginPercentage, 100)}%` }}
              />
            </div>
          </div>

          {data?.price_lists && data.price_lists.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span>📋</span> Alternative Prices
              </p>
              <div className="space-y-1.5">
                {data.price_lists.slice(0, 3).map((pl, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-xs p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded"
                  >
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px] font-medium">
                      {pl.price_list}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatCurrencyWithSymbol(pl.rate, item.currency_symbol)}
                    </span>
                  </div>
                ))}
                {data.price_lists.length > 3 && (
                  <div className="text-[10px] text-gray-400 text-center pt-1 italic">
                    +{data.price_lists.length - 3} more price lists available
                  </div>
                )}
              </div>
            </div>
          )}

          {data?.batches && data.batches.length > 0 && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span>📦</span> Batch Stock
              </p>
              <div className="space-y-1">
                {data.batches.slice(0, 2).map((batch, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-gray-500 font-mono">
                      {batch.batch_id}
                    </span>
                    <div className="flex gap-3">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Qty: {batch.qty}
                      </span>
                      {batch.expiry_date && (
                        <span className="text-gray-400 text-[10px]">
                          Exp:{" "}
                          {new Date(batch.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {data.batches.length > 2 && (
                  <div className="text-[10px] text-gray-400 text-center pt-1">
                    +{data.batches.length - 2} more batches
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center pt-2">
            <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">
              Click to view full details →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}