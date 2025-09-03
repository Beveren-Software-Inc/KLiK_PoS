"use client"

import type { MenuItem } from "../../types"

interface MenuItemCardProps {
  item: MenuItem
  onAddToCart: () => void
}

export default function MenuItemCard({ item, onAddToCart }: MenuItemCardProps) {
  const isOutOfStock = item.available <= 0

  return (
    <div
      className={`rounded-xl p-3 shadow-sm transition-shadow relative ${
        isOutOfStock
          ? "bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 opacity-70 cursor-not-allowed"
          : "bg-white dark:bg-gray-800 hover:shadow-md cursor-pointer"
      }`}
      onClick={isOutOfStock ? undefined : onAddToCart}
    >
      {/* Discount Badge - Smaller size */}
      {item.discount && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white px-1.5 py-0.5 rounded-md text-xs font-medium z-10 text-[10px]">
          {item.discount}% Off
        </div>
      )}

      {/* Image - Smaller aspect ratio */}
      <div className="aspect-[4/3] rounded-lg overflow-hidden mb-3">
        <img
          src={item.image || "/placeholder.svg"}
          alt={item.name}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
      </div>

      {/* Content */}
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-800 dark:text-white text-sm leading-tight">{item.name}</h3>

        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{item.available} Available</span>
          <span>•</span>
          <span>{item.sold} Sold</span>
        </div>

        <div className="flex items-center space-x-1">
          {item.originalPrice && (
            <span className="text-gray-400 line-through text-xs">${item.originalPrice.toFixed(2)}</span>
          )}
          <span className="font-bold text-base">${item.price.toFixed(2)}</span>
          <span className="text-gray-500 text-xs">/ Portion</span>
        </div>
      </div>
    </div>
  )
}
