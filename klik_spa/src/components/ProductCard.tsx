"use client"

import { useI18n } from "../hooks/useI18n"
import type { MenuItem } from "../../types"

interface ProductCardProps {
  item: MenuItem
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
}

export default function ProductCard({ item, onAddToCart, isMobile = false, scannerOnly = false }: ProductCardProps) {
  const { t } = useI18n()
  const isOutOfStock = item.available <= 0
  const isDisabled = isOutOfStock || scannerOnly

  // Format price based on currency
  const formattedPrice = `${item.currency_symbol}${item.price.toFixed(2)}`

return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 ${
        isDisabled
          ? "opacity-70 cursor-not-allowed"
          : "hover:shadow-lg hover:scale-105 cursor-pointer active:scale-95"
      } ${isMobile ? "touch-manipulation" : ""}`}
      onClick={() => !isDisabled && onAddToCart(item)}
    >
      <div className="relative">
        <img
          src={item.image || "/placeholder.svg?height=120&width=120"}
          alt={item.name}
          className={`w-full object-cover ${isMobile ? "h-24" : "h-32"}`}
          crossOrigin="anonymous"
        />
        {item.discount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-1.5 py-0.5 rounded-md text-xs font-bold">
            -{item.discount}%
          </div>
        )}
        {!isOutOfStock && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-1.5 py-0.5 rounded-md text-xs font-medium">
            {item.available}
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-bold text-xs">Out of Stock</span>
          </div>
        )}
        {scannerOnly && !isOutOfStock && (
          <div className="absolute inset-0  flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs bg-white/90 dark:bg-gray-800/90 px-2 py-1 rounded-md shadow-sm border border-blue-200 dark:border-blue-700">
              Scan Only
            </span>
          </div>
        )}
      </div>
      <div className={`${isMobile ? "p-2 h-12" : "p-3 h-16"} flex flex-col justify-between`}>
        <div>
          <h3 className={`font-semibold text-gray-900 dark:text-white truncate ${isMobile ? "text-xs" : "text-sm"}`}>
            {item.name}
          </h3>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-gray-500 dark:text-gray-400 capitalize ${isMobile ? "text-xs" : "text-xs"}`}>
            {item.category}
          </p>
          <span className={`font-bold text-beveren-600 dark:text-beveren-400 ${isMobile ? "text-xs" : "text-sm"}`}>
            {formattedPrice}
          </span>
        </div>
      </div>
    </div>
  )
}

