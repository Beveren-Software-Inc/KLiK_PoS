"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import ProductCard from "./ProductCard"
import ProductLineView from "./ProductLineView"
import type { MenuItem } from "../../types"
import { useCartStore } from "../stores/cartStore"
import { useI18n } from "../hooks/useI18n"

interface ProductGridProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
  viewMode?: 'grid' | 'list'
  // Infinite scroll props
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  totalCount?: number
}

export default function ProductGrid({
  items,
  onAddToCart,
  isMobile = false,
  scannerOnly = false,
  viewMode = 'grid',
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  totalCount = 0,
}: ProductGridProps) {
  const { tl } = useI18n()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const cartItems = useCartStore((state) => state.cartItems)
  const cartQuantities = useMemo(
    () => new Map(cartItems.map((cartItem) => [cartItem.id, cartItem.quantity])),
    [cartItems],
  )

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0]
    if (target.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore()
    }
  }, [hasMore, isLoadingMore, onLoadMore])

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "200px", // Load more before reaching the bottom
      threshold: 0,
    }

    const observer = new IntersectionObserver(handleObserver, option)
    const node = loadMoreRef.current

    if (node) {
      observer.observe(node)
    }

    return () => {
      if (node) {
        observer.unobserve(node)
      }
      observer.disconnect()
    }
  }, [handleObserver])

  // If viewMode is 'list', render the line view
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col">
        <ProductLineView
          items={items}
          onAddToCart={onAddToCart}
          isMobile={isMobile}
          scannerOnly={scannerOnly}
          cartQuantities={cartQuantities}
        />

        {/* Load more trigger and indicator */}
        {onLoadMore && (
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-beveren-600"></div>
                <span className="text-sm text-app-muted">{tl("Loading more items...")}</span>
              </div>
            )}
            {!isLoadingMore && hasMore && (
              <span className="text-sm text-app-muted">
                {tl("Showing {{loaded}} of {{total}} items", { loaded: items.length, total: totalCount })}
              </span>
            )}
            {!hasMore && items.length > 0 && (
              <span className="text-sm text-app-muted">
                {tl("All {{count}} items loaded", { count: items.length })}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Default grid view
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">{tl("No items found")}</h3>
          <p className="text-app-muted">{tl("Try adjusting your search or filters")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobile ? "p-4" : "p-6"} bg-transparent`}>
      <div
        className={`grid gap-4 ${
          isMobile
            ? "grid-cols-2 sm:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        }`}
      >
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onAddToCart={onAddToCart}
            isMobile={isMobile}
            scannerOnly={scannerOnly}
            cartQuantity={cartQuantities.get(item.id) ?? 0}
          />
        ))}
      </div>

      {/* Load more trigger and indicator */}
      {onLoadMore && (
        <div ref={loadMoreRef} className="py-6 flex justify-center">
          {isLoadingMore && (
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-app-primary"></div>
              <span className="text-sm text-app-muted">{tl("Loading more items...")}</span>
            </div>
          )}
          {!isLoadingMore && hasMore && (
            <span className="text-sm text-app-muted">
              {tl("Showing {{loaded}} of {{total}} items", { loaded: items.length, total: totalCount })} • {tl("Scroll for more")}
            </span>
          )}
          {!hasMore && items.length > 0 && totalCount > 0 && (
            <span className="text-sm text-app-muted">
              {tl("All {{count}} items loaded", { count: items.length })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
