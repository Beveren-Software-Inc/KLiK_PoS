"use client";

import { useState, useEffect, useCallback } from "react";
import { useCartStore } from "../stores/cartStore";
import MenuGrid from "./MenuGrid";
import OrderSummary from "./order/OrderSummary";
import MobilePOSLayout from "./MobilePOSLayout";
import LoadingSpinner from "./LoadingSpinner";
import BarcodeScannerModal from "./BarcodeScanner";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useProduct } from "../providers/ProductProvider";
import { usePOSProfileStore } from "../stores/posProfileStore";

export default function RetailPOSLayout() {
  const [showScanner, setShowScanner] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const isMobile = useMediaQuery("(max-width: 1024px)");
  
  const {
    isLoading: isProductsLoading,
    error: productError,
    filteredItems,
    useScannerOnly,
    searchQuery,
    hasMore,
    isLoadingMore,
    loadMoreProducts,
    totalCount,
    isSearching,
    searchProducts,
    setCategory,
    selectedCategory,
    refreshStockOnly,
    fetchProducts,
  } = useProduct();

  const { 
    fetchPOSDetails, 
    posDetails,
    clearCache,
  } = usePOSProfileStore();

  const { clearCart } = useCartStore();

  useEffect(() => {
    const handleBeforeUnload = () => {
      clearCache();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clearCache]);

  useEffect(() => {
    const init = async () => {
      await fetchPOSDetails(true);
      setIsInitializing(false);
    };

    init();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      if (posDetails && !isProductsLoading && !isInitializing) {
        await fetchProducts(true);
      }
    };

    loadProducts();
  }, [posDetails, isInitializing]);

  const handleSearchInput = useCallback((query: string) => {
    searchProducts(query);
  }, [searchProducts]);

  const handleCategoryChange = useCallback((category: string) => {
    setCategory(category);
  }, [setCategory]);

  const handleRefreshStock = useCallback(() => {
    refreshStockOnly();
  }, [refreshStockOnly]);

  useEffect(() => {
    const handleFocus = () => {
      refreshStockOnly();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshStockOnly]);

  if (isInitializing && !posDetails) {
    return <LoadingSpinner message="Loading POS configuration..." />;
  }

  if (productError && filteredItems.length === 0 && !isSearching) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load POS</h2>
          <p className="text-gray-600 mb-4">{productError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <MobilePOSLayout
          items={filteredItems}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchInput}
          onScanBarcode={() => setShowScanner(true)}
          scannerOnly={useScannerOnly}
          hasMore={hasMore && !searchQuery}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreProducts}
          totalCount={totalCount}
          isSearching={isSearching}
        />
        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onBarcodeDetected={() => setShowScanner(false)}
        />
      </>
    );
  }

  return (
    <>
      {useScannerOnly && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600/90 text-white px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Scanner Only</span>
          </div>
        </div>
      )}
      
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 pb-8">
        <div className="flex-1 overflow-hidden ml-20">
          <MenuGrid
            onRefreshStock={handleRefreshStock}
            onScanBarcode={() => setShowScanner(true)}
          />
        </div>
        
        <div className="w-[35%] min-w-[420px] max-w-[600px] bg-white shadow-lg overflow-y-auto">
          <OrderSummary onClearCart={clearCart} />
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onBarcodeDetected={() => setShowScanner(false)}
      />
    </>
  );
}