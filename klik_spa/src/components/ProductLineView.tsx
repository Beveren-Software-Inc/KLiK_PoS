"use client"

import { useState } from "react"
import type { MenuItem } from "../../types"
import ProductTooltip from "./ProductTooltip"
import ProductDetailsModal from "./ProductDetailsModal"

import { formatCurrencyWithSymbol } from "../utils/currency"

interface ProductLineViewProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
  showItemCode?: boolean
}

export default function ProductLineView({
  items,
  onAddToCart,
  isMobile = false,
  scannerOnly = false,
  showItemCode = false,
}: ProductLineViewProps) {
  const [hoveredItemId, setHoveredItemId] = useState<string | number | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const handleInfoClick = (item: MenuItem) => {
    setSelectedItem(item)
    setShowDetailsModal(true)
    setHoveredItemId(null)
  }

  const handleModalClose = () => {
    setShowDetailsModal(false)
    setSelectedItem(null)
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No items found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      </div>
    )
  }
  

  return (
    <>
      <div className={`${isMobile ? "p-4" : "p-2"} bg-gray-50 dark:bg-gray-900`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-visible">
          <div className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} bg-gray-50 dark:bg-gray-700 border-b`}>
            <div className="col-span-4 text-xs font-semibold text-gray-900 dark:text-white">Product</div>
            <div className="col-span-2 text-xs font-semibold text-center text-gray-900 dark:text-white">Rate</div>
            <div className="col-span-2 text-xs font-semibold text-center text-gray-900 dark:text-white">Qty</div>
            {!isMobile && <div className="col-span-2 text-xs font-semibold text-center text-gray-900 dark:text-white">UOM</div>}
            <div className="col-span-2 text-xs font-semibold text-center text-gray-900 dark:text-white">Action</div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-600">
            {items.map((item) => {
              const isOutOfStock = item.available <= 0
              const isDisabled = isOutOfStock || scannerOnly
              const formattedPrice = formatCurrencyWithSymbol(item.price, item.currency_symbol)

              return (
                <div
                  key={item.id}
                  className={`grid ${isMobile ? "grid-cols-8" : "grid-cols-12"} gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !isDisabled && "cursor-pointer"
                  }`}
                  onClick={() => !isDisabled && onAddToCart(item)}
                >
                  <div className={`${isMobile ? "col-span-3" : "col-span-4"} flex items-center gap-2`}>
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className={`flex-shrink-0 rounded object-cover ${isMobile ? "w-8 h-8" : "w-9 h-9"} ${isDisabled ? "opacity-60" : ""}`}
                      />
                    ) : (
                      <div className={`flex-shrink-0 rounded bg-gray-100 dark:bg-gray-700 ${isMobile ? "w-8 h-8" : "w-9 h-9"} ${isDisabled ? "opacity-60" : ""}`} />
                    )}
                    <div className="flex-1 min-w-0 relative">
                      <div className="flex items-center gap-1">
                        <h3 className={`font-medium text-gray-900 dark:text-white ${isMobile ? "text-xs leading-tight" : "text-sm"} ${isMobile ? "break-words" : "truncate"} ${isDisabled ? "opacity-60" : ""}`}>
                          {item.name}
                        </h3>
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => !isMobile && setHoveredItemId(item.id)}
                          onMouseLeave={() => !isMobile && setHoveredItemId(null)}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInfoClick(item)
                            }}
                            className={`text-gray-400 hover:text-blue-500 text-sm focus:outline-none transition-colors ${isDisabled ? "opacity-60" : ""}`}
                          >
                            ℹ️
                          </button>
                          {hoveredItemId === item.id && !isMobile && (
                            <ProductTooltip
                              item={item}
                              onClose={() => setHoveredItemId(null)}
                              onViewDetails={() => {
                                handleInfoClick(item)
                              }}
                            />
                          )}
                        </div>
                      </div>
                      {showItemCode && (
                        <p className={`text-gray-600 dark:text-gray-300 ${isMobile ? "text-xs leading-tight" : "text-sm"} ${isMobile ? "break-words" : "truncate"} ${isDisabled ? "opacity-60" : ""}`}>
                          {item.item_code || item.id}
                        </p>
                      )}
                      <p className={`text-gray-500 dark:text-gray-400 ${isMobile ? "text-xs leading-tight" : "text-sm"} ${isMobile ? "break-words" : "truncate"} ${isDisabled ? "opacity-60" : ""}`}>
                        {item.category}
                      </p>
                    </div>
                  </div>


                  <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center ${isDisabled ? "opacity-60" : ""}`}>
                    <span className={`font-semibold text-beveren-600 dark:text-beveren-400 ${isMobile ? "text-xs" : "text-sm"}`}>
                      {formattedPrice}
                    </span>
                  </div>

                  <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center ${isDisabled ? "opacity-60" : ""}`}>
                    <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"} ${
                      isOutOfStock ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
                    }`}>
                      {isOutOfStock ? "0" : item.available}
                    </span>
                  </div>

                  {!isMobile && (
                    <div className={`col-span-2 flex items-center justify-center ${isDisabled ? "opacity-60" : ""}`}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {item.uom || "Nos"}
                      </span>
                    </div>
                  )}

                  <div className={`${isMobile ? "col-span-1" : "col-span-2"} flex items-center justify-center`}>
                    {isDisabled ? (
                      <span className={`text-gray-400 dark:text-gray-500 ${isMobile ? "text-xs" : "text-xs"} opacity-60`}>
                        {isOutOfStock ? "Out" : "Scan"}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToCart(item)
                        }}
                        className={`bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 hover:border-slate-400 dark:hover:border-slate-500 ${
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

      {showDetailsModal && selectedItem && (
        <ProductDetailsModal
          item={selectedItem}
          onClose={handleModalClose}
        />
      )}
    </>
  )
}
