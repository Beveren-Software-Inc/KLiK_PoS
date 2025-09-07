"use client"

import { useI18n } from "../hooks/useI18n"
import type { MenuItem } from "../../types"

interface ProductLineViewProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
}

export default function ProductLineView({ items, onAddToCart, isMobile = false, scannerOnly = false }: ProductLineViewProps) {
  const { t } = useI18n()

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No items found</h3>
          <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobile ? "p-4" : "p-6"} bg-gray-50 dark:bg-gray-900`}>
      {/* Header Row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
        <div className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600`}>
          <div className={`${isMobile ? "col-span-3" : "col-span-4"}`}>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Product</span>
          </div>
          <div className={`${isMobile ? "col-span-2" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Rate</span>
          </div>
          <div className={`${isMobile ? "col-span-2" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Qty</span>
          </div>
          {!isMobile && (
            <div className="col-span-2 text-center">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">UOM</span>
            </div>
          )}
          <div className={`${isMobile ? "col-span-1" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Action</span>
          </div>
        </div>

        {/* Product Rows */}
        <div className="divide-y divide-gray-200 dark:divide-gray-600">
          {items.map((item) => {
            const isOutOfStock = item.available <= 0
            const isDisabled = isOutOfStock || scannerOnly
            const formattedPrice = `${item.currency_symbol}${item.price.toFixed(2)}`

            return (
              <div
                key={item.id}
                className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  isDisabled ? "opacity-60" : "cursor-pointer"
                }`}
                onClick={() => !isDisabled && onAddToCart(item)}
              >
                {/* Product Name */}
                <div className={`${isMobile ? "col-span-3" : "col-span-4"} flex items-start`}>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium text-gray-900 dark:text-white ${isMobile ? "text-xs leading-tight" : "text-sm"} ${
                      isMobile ? "break-words" : "truncate"
                    }`}>
                      {item.name}
                    </h3>
                    <p className={`text-gray-500 dark:text-gray-400 ${isMobile ? "text-xs leading-tight" : "text-sm"} ${
                      isMobile ? "break-words" : "truncate"
                    }`}>
                      {item.category}
                    </p>
                  </div>
                </div>

                {/* Rate */}
                <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center`}>
                  <span className={`font-semibold text-beveren-600 dark:text-beveren-400 ${isMobile ? "text-xs" : "text-sm"}`}>
                    {formattedPrice}
                  </span>
                </div>

                {/* Available Qty */}
                <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center`}>
                  <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"} ${
                    isOutOfStock
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-white"
                  }`}>
                    {isOutOfStock ? "0" : item.available}
                  </span>
                </div>

                {/* UOM - Desktop only */}
                {!isMobile && (
                  <div className="col-span-2 flex items-center justify-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.uom || "Nos"}
                    </span>
                  </div>
                )}

                {/* Action */}
                <div className={`${isMobile ? "col-span-1" : "col-span-2"} flex items-center justify-center`}>
                  {isDisabled ? (
                    <span className={`text-gray-400 dark:text-gray-500 ${isMobile ? "text-xs" : "text-xs"}`}>
                      {isOutOfStock ? "0" : "S"}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToCart(item)
                      }}
                      className={`bg-beveren-600 hover:bg-beveren-700 text-white font-medium rounded-md transition-colors ${
                        isMobile ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
                      }`}
                    >
                      {isMobile ? "+" : "Add"}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
