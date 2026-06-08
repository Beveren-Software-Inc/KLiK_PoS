"use client";

import { useState } from "react";
import type { MenuItem } from "../../types";
import ProductTooltip from "./ProductTooltip";
import ProductDetailsModal from "./ProductDetailsModal";
import { formatCurrencyWithSymbol } from "../utils/currency";

interface ProductCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  isMobile?: boolean;
  scannerOnly?: boolean;
  showItemCode?: boolean;
}

export default function ProductCard({
  item,
  onAddToCart,
  isMobile = false,
  scannerOnly = false,
  showItemCode = false,
}: ProductCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const isServiceItem = item.is_stock_item === false;
  const isOutOfStock = item.is_stock_item !== false && item.available <= 0;
  const isDisabled = isOutOfStock || scannerOnly;
  const bundleCount = item.is_product_bundle ? item.bundle_items?.length || 0 : 0;
  const variantCount = item.is_variant_template ? item.variant_count || 0 : 0;
  const expectedPrice = Number(item.price_with_vat ?? item.price);
  const basePrice = Number(item.price || 0);
  const showsAdjustedPrice = Math.abs(expectedPrice - basePrice) > 0.004;
  const formattedPrice = formatCurrencyWithSymbol(
    expectedPrice,
    item.currency_symbol,
  );
  const formattedBasePrice = formatCurrencyWithSymbol(
    basePrice,
    item.currency_symbol,
  );
  const taxRate = Number(item.tax_info?.total_tax_rate || 0);
  const taxBadgeLabel = item.tax_info?.has_vat
    ? `VAT ${taxRate.toFixed(taxRate % 1 === 0 ? 0 : 2)}% ${item.tax_info.is_inclusive ? "Incl" : "Excl"}`
    : "No VAT";
  const taxBadgeClass = item.tax_info?.has_vat
    ? item.tax_info.is_inclusive
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700"
    : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600";

  const handleModalOpen = () => {
    setShowTooltip(false);
    setShowDetailsModal(true);
  };

  const handleModalClose = () => {
    setShowDetailsModal(false);
  };

  return (
    <>
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-visible transition-all duration-200 relative flex flex-col ${
          showTooltip ? "z-[2]" : "z-1"
        } ${
          isDisabled
            ? "cursor-not-allowed"
            : "hover:shadow-lg hover:scale-105 cursor-pointer active:scale-95"
        } ${isMobile ? "touch-manipulation" : ""}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          if (!isDisabled) onAddToCart(item);
        }}
      >
        <div
          className="absolute top-2 left-2 z-[70]"
          onMouseEnter={() => !isMobile && setShowTooltip(true)}
          onMouseLeave={() => !isMobile && setShowTooltip(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleModalOpen();
            }}
            className={`text-gray-600 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:text-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-xs border border-gray-200 dark:border-gray-600 shadow-sm transition-colors ${isDisabled ? "opacity-70" : ""}`}
          >
            ℹ️
          </button>

          {showTooltip && !isMobile && (
            <ProductTooltip
              item={item}
              onClose={() => setShowTooltip(false)}
              onViewDetails={() => {
                handleModalOpen();
              }}
            />
          )}
        </div>

        <div className={`relative overflow-hidden rounded-t-xl ${isDisabled ? "opacity-70" : ""}`}>
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className={`w-full object-cover ${isMobile ? "h-24" : "h-32"}`}
              crossOrigin="anonymous"
            />
          ) : (
            <div
              className={`w-full ${isMobile ? "h-24" : "h-32"} bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}
            >
              <div className="text-gray-400 dark:text-gray-500 text-sm font-medium">
                No Image
              </div>
            </div>
          )}

          {item.discount && (
            <div className="absolute top-2 right-10 bg-red-500 text-white px-1.5 py-0.5 rounded-md text-xs font-bold z-10">
              -{item.discount}%
            </div>
          )}

          {item.is_product_bundle && (
            <div className="absolute bottom-2 left-2 bg-amber-600 text-white px-1.5 py-0.5 rounded-md text-xs font-medium z-10">
              Bundle
            </div>
          )}

          {item.is_variant_template && (
            <div className="absolute bottom-2 left-2 bg-sky-600 text-white px-1.5 py-0.5 rounded-md text-xs font-medium z-10">
              Options
            </div>
          )}

          {!isOutOfStock && (
            <div
              className={`absolute top-2 right-2 text-white px-1.5 py-0.5 rounded-md text-xs font-medium z-10 ${
                item.is_variant_template ? "bg-sky-700" : item.is_product_bundle ? "bg-amber-700" : isServiceItem ? "bg-indigo-600" : "bg-slate-600"
              }`}
            >
              {item.is_variant_template ? variantCount : item.is_product_bundle ? item.available : isServiceItem ? "Service" : item.available}
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
              <span className="text-white font-bold text-xs">Out of Stock</span>
            </div>
          )}

          {scannerOnly && !isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs bg-white/90 dark:bg-gray-800/90 px-2 py-1 rounded-md shadow-sm border border-blue-200 dark:border-blue-700">
                Scan Only
              </span>
            </div>
          )}
        </div>

        <div
          className={`${isMobile ? "p-2 min-h-[5.25rem]" : "p-2 h-20"} flex flex-col justify-between ${isDisabled ? "opacity-70" : ""}`}
        >
          <div>
            <h3
              className={`font-semibold text-gray-900 dark:text-white ${isMobile ? "text-xs leading-tight break-words whitespace-normal" : "text-sm truncate"}`}
            >
              {item.name}
            </h3>
            {showItemCode && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {item.item_code || item.id}
              </p>
            )}
            {item.is_product_bundle && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 truncate">
                {bundleCount} packed {bundleCount === 1 ? "item" : "items"}
              </p>
            )}
            {item.is_variant_template && (
              <p className="text-[10px] text-sky-700 dark:text-sky-300 truncate">
                {variantCount} {variantCount === 1 ? "variant" : "variants"}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p
              className={`text-gray-500 dark:text-gray-400 capitalize ${isMobile ? "text-xs" : "text-xs"}`}
            >
              {item.category}
            </p>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none ${taxBadgeClass}`}
              title={item.tax_info?.item_tax_template || item.tax_info?.source || taxBadgeLabel}
            >
              {taxBadgeLabel}
            </span>
          </div>
          <div className="flex items-center justify-end">
            <div className="text-right">
              <span
                className={`block font-bold text-beveren-600 dark:text-beveren-400 ${isMobile ? "text-xs" : "text-sm"}`}
              >
                {formattedPrice}
              </span>
              {showsAdjustedPrice && (
                <span className="block text-[10px] font-medium leading-tight text-gray-600 dark:text-gray-300">
                  Base {formattedBasePrice}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDetailsModal && (
        <ProductDetailsModal item={item} onClose={handleModalClose} />
      )}
    </>
  );
}
