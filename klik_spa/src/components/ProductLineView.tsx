"use client"

// import { useI18n } from "../hooks/useI18n"
import { useState, useEffect, useRef } from "react"
import { usePOSDetails } from "../hooks/usePOSProfile"
import PharmacyItemDetailsModal from "./PharmacyItemDetailsModal"
import type { MenuItem } from "../../types"

interface ProductLineViewProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
}

export default function ProductLineView({ items, onAddToCart, isMobile = false, scannerOnly = false }: ProductLineViewProps) {
  // const { t } = useI18n()
  const { posDetails } = usePOSDetails()
  const [showPharmacyModal, setShowPharmacyModal] = useState(false)
  const [selectedPharmacyItem, setSelectedPharmacyItem] = useState<MenuItem | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Check if pharmacy mode is enabled
  const isPharmacy = posDetails?.custom_is_pharmacy === 1 ||
                     posDetails?.custom_is_pharmacy === true ||
                     posDetails?.custom_is_pharmacy === "1"
  
  // Track mouse position for better hover handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).lastMouseX = e.clientX
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).lastMouseY = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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
    <div className={`${isMobile ? "p-4" : "p-2"} bg-gray-50 dark:bg-gray-900`}>
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
            
            // Check if item has pharmacy fields
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itemData = item as any
            const hasPharmacyData = isPharmacy && (
              itemData.custom_strength ||
              itemData.custom_pharmaceutical_form ||
              itemData.custom_number_of_pack !== null ||
              itemData.custom_number_of_pack !== undefined ||
              itemData.custom_pack_size ||
              itemData.custom_route_of_administration
            )

            return (
              <div
                key={item.id}
                className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  isDisabled ? "opacity-60" : "cursor-pointer"
                }`}
                onClick={() => !isDisabled && onAddToCart(item)}
                onMouseEnter={() => {
                  if (hasPharmacyData) {
                    // Clear any pending timeout
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current)
                      hoverTimeoutRef.current = null
                    }
                    setSelectedPharmacyItem(item)
                    setShowPharmacyModal(true)
                  }
                }}
                onMouseLeave={() => {
                  if (hasPharmacyData) {
                    // Clear any existing timeout
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current)
                    }
                    // Longer delay to allow moving to next product - tooltip stays visible
                    hoverTimeoutRef.current = setTimeout(() => {
                      // Check if mouse is over another product or the modal
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const mouseX = (window as any).lastMouseX || 0
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const mouseY = (window as any).lastMouseY || 0
                      const hoveredElement = document.elementFromPoint(mouseX, mouseY)
                      const isOverProduct = hoveredElement?.closest('[data-pharmacy-item]')
                      const isOverModal = hoveredElement?.closest('.pharmacy-tooltip')
                      
                      // Only close if not over any product or modal
                      if (!isOverProduct && !isOverModal) {
                        setShowPharmacyModal(false)
                        setSelectedPharmacyItem(null)
                      }
                    }, 500) // Longer delay to keep tooltip visible when moving between products
                  }
                }}
                data-pharmacy-item={hasPharmacyData ? 'true' : undefined}
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
      
      {/* Pharmacy Item Details Modal - List View (right side) */}
      {selectedPharmacyItem && (
        <PharmacyItemDetailsModal
          isOpen={showPharmacyModal}
          onClose={() => {
            setShowPharmacyModal(false)
            setSelectedPharmacyItem(null)
          }}
          itemName={selectedPharmacyItem.name}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom_strength={(selectedPharmacyItem as any).custom_strength}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom_pharmaceutical_form={(selectedPharmacyItem as any).custom_pharmaceutical_form}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom_number_of_pack={(selectedPharmacyItem as any).custom_number_of_pack}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom_pack_size={(selectedPharmacyItem as any).custom_pack_size}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom_route_of_administration={(selectedPharmacyItem as any).custom_route_of_administration}
          position="right"
        />
      )}
    </div>
  )
}
