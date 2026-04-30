"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useProduct } from "../providers/ProductProvider";
import ProductCard from "./ProductCard";
import ProductLineView from "./ProductLineView";
import { useCartStore } from "../stores/cartStore";
import { usePOSProfileStore } from "../stores/posProfileStore";


interface ProductGridProps {
  scannerOnly?: boolean;
  viewMode?: "grid" | "list";
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  isSearching?: boolean;
}

export default function ProductGrid({
  scannerOnly = false,
  viewMode: propViewMode,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  totalCount = 0,
  isSearching = false,
}: ProductGridProps) {
  const { filteredItems, hideUnavailableItems } = useProduct();
  const { addToCart } = useCartStore();
  const { posDetails } = usePOSProfileStore();

  const defaultView = posDetails?.custom_default_view || "Grid View";
  const viewMode = propViewMode || (defaultView === "List View" ? "list" : "grid");

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const inStockItems = useMemo(
    () => (hideUnavailableItems ? filteredItems.filter((item) => item.available > 0) : filteredItems),
    [filteredItems, hideUnavailableItems],
  );

  const handleAddToCart = useCallback((item: any) => {
    if (item.available <= 0) return;
    if (scannerOnly) return;
    
    addToCart({
      ...item,
      item_code: item.id,
    });
  }, [addToCart, scannerOnly]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (!target) return;
      if (target.isIntersecting && hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, onLoadMore],
  );

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    };

    const observer = new IntersectionObserver(handleObserver, option);

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [handleObserver]);

  if (viewMode === "list") {
    return (
      <div className="flex flex-col relative">
        {isSearching && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-beveren-600"></div>
          </div>
        )}
        <ProductLineView
          items={inStockItems}
          onAddToCart={handleAddToCart}
          scannerOnly={scannerOnly}
        />

        {onLoadMore && (
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-beveren-600"></div>
                <span className="text-gray-500 dark:text-gray-400 text-sm">
                  Loading more items...
                </span>
              </div>
            )}
            {!isLoadingMore && hasMore && (
              <span className="text-gray-400 dark:text-gray-500 text-sm">
                Showing {inStockItems.length} of {totalCount} items
              </span>
            )}
            {!hasMore && inStockItems.length > 0 && (
              <span className="text-gray-400 dark:text-gray-500 text-sm">
                All {inStockItems.length} items loaded
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (inStockItems.length === 0 && !isSearching) {
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
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 relative">
      {isSearching && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 z-10 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-beveren-600"></div>
        </div>
      )}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        {inStockItems.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            onAddToCart={handleAddToCart}
            scannerOnly={scannerOnly}
          />
        ))}
      </div>

      {onLoadMore && (
        <div ref={loadMoreRef} className="py-6 flex justify-center">
          {isLoadingMore && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-beveren-600"></div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                Loading more items...
              </span>
            </div>
          )}
          {!isLoadingMore && hasMore && (
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              Showing {inStockItems.length} of {totalCount} items • Scroll for more
            </span>
          )}
          {!hasMore && inStockItems.length > 0 && totalCount > 0 && (
            <span className="text-gray-400 dark:text-gray-500 text-sm">
              All {inStockItems.length} items loaded
            </span>
          )}
        </div>
      )}
    </div>
  );
}