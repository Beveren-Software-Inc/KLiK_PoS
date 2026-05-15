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
  const isOutOfStock = item.available <= 0;
  const isDisabled = isOutOfStock || scannerOnly;
  const formattedPrice = formatCurrencyWithSymbol(
    item.price,
    item.currency_symbol,
  );

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

          {!isOutOfStock && (
            <div className="absolute top-2 right-2 bg-slate-600 text-white px-1.5 py-0.5 rounded-md text-xs font-medium z-10">
              {item.available}
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
          className={`${isMobile ? "p-2 h-12" : "p-3 h-16"} flex flex-col justify-between ${isDisabled ? "opacity-70" : ""}`}
        >
          <div>
            <h3
              className={`font-semibold text-gray-900 dark:text-white truncate ${isMobile ? "text-xs" : "text-sm"}`}
            >
              {item.name}
            </h3>
            {showItemCode && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {item.item_code || item.id}
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
              className={`font-bold text-beveren-600 dark:text-beveren-400 ${isMobile ? "text-xs" : "text-sm"}`}
            >
              {formattedPrice}
            </span>
          </div>
        </div>
      </div>

      {showDetailsModal && (
        <ProductDetailsModal item={item} onClose={handleModalClose} />
      )}
    </>
  );
}