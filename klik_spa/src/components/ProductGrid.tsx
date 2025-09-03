"use client"

import { useI18n } from "../hooks/useI18n"
import ProductCard from "./ProductCard"
import type { MenuItem } from "../../types"

interface ProductGridProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
}

export default function ProductGrid({ items, onAddToCart, isMobile = false, scannerOnly = false }: ProductGridProps) {
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
      <div
        className={`grid gap-4 ${
          isMobile
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        }`}
      >
        {items.map((item) => (
          <ProductCard key={item.id} item={item} onAddToCart={onAddToCart} isMobile={isMobile} scannerOnly={scannerOnly} />
        ))}
      </div>
    </div>
  )
}
