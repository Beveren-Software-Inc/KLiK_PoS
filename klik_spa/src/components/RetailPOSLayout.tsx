"use client"

import { useState, useEffect } from "react"
import { useProducts } from "../hooks/useProducts"
import { usePOSDetails } from "../hooks/usePOSProfile"
import RetailSidebar from "./RetailSidebar"
import MenuGrid from "./MenuGrid"
import OrderSummary from "./OrderSummary"
import MobilePOSLayout from "./MobilePOSLayout"
import LoadingSpinner from "./LoadingSpinner"
import BarcodeScannerModal from "./BarcodeScanner"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import type { MenuItem, CartItem, GiftCoupon } from "../../types"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { useCartStore } from "../stores/cartStore"

export default function RetailPOSLayout() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [appliedCoupons, setAppliedCoupons] = useState<GiftCoupon[]>([])
  const [showScanner, setShowScanner] = useState(false)

  // Use cart store instead of local state
  const { cartItems, addToCart, updateQuantity, removeItem, clearCart } = useCartStore()

  // Use professional data management
  const { products: menuItems, isLoading: loading, error, refetch } = useProducts()

  // Get POS details including scanner-only setting
  const { posDetails } = usePOSDetails()
  const useScannerOnly = posDetails?.custom_use_scanner_fully || false
  const hideUnavailableItems = posDetails?.hide_unavailable_items || false

    // Use media query to detect mobile/tablet screens
  const isMobile = useMediaQuery("(max-width: 1024px)")

  const handleAddToCart = (item: MenuItem) => {
    // Don't add if item is not available
    if (item.available <= 0) return

    // If scanner-only mode is enabled, prevent adding items by clicking
    if (useScannerOnly) {
      console.log('Scanner-only mode enabled. Items can only be added via barcode scanning.')
      return
    }

    addItemToCart(item)
  }

  // Separate function for adding items to cart (used by both click and barcode)
  const addItemToCart = (item: MenuItem) => {
    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id)
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      addToCart({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        image: item.image,
      })
    }

    // Show success message for barcode scanning
    if (useScannerOnly) {
      console.log(`✅ Added ${item.name} to cart via barcode scanning`)
    }
  }

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
    } else {
      updateQuantity(id, quantity)
    }
  }

  const handleRemoveItem = (id: string) => {
    removeItem(id)
  }

  const handleClearCart = () => {
    clearCart()
  }

  const handleApplyCoupon = (coupon: GiftCoupon) => {
    // Check if coupon is already applied
    if (!appliedCoupons.some((c) => c.code === coupon.code)) {
      setAppliedCoupons([...appliedCoupons, coupon])
    }
  }

  const handleRemoveCoupon = (couponCode: string) => {
    setAppliedCoupons(appliedCoupons.filter((coupon) => coupon.code !== couponCode))
  }

  // Barcode scanning functionality - moved after handleAddToCart is defined
  const { scanBarcode } = useBarcodeScanner(addItemToCart)

  const handleBarcodeDetected = async (barcode: string) => {
    const success = await scanBarcode(barcode)
    if (success) {
      setShowScanner(false)
    }
  }

  // Handle search input for both product search and barcode scanning
  const handleSearchInput = (query: string) => {
    setSearchQuery(query)

    // If input looks like a barcode (numeric/alphanumeric, 8+ characters),
    // it might be from a hardware scanner
    if (query.length >= 8 && /^[0-9A-Za-z]+$/.test(query)) {
      console.log('Potential barcode input detected:', query)
    }
  }

  // Handle Enter key for barcode processing
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()

      // Check if this looks like a barcode (numeric/alphanumeric, 8+ characters)
      if (searchQuery.length >= 8 && /^[0-9A-Za-z]+$/.test(searchQuery)) {
        console.log('Processing as barcode:', searchQuery)
        handleBarcodeDetected(searchQuery.trim())
        setSearchQuery('') // Clear after processing
      } else {
        // Regular search - just let it filter products
        console.log('Processing as product search:', searchQuery)
      }
    }
  }

  // Auto-process barcode after a short delay (for hardware scanners)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 8 && /^[0-9A-Za-z]+$/.test(searchQuery)) {
        console.log('Auto-processing potential barcode:', searchQuery)
        handleBarcodeDetected(searchQuery.trim())
        setSearchQuery('')
      }
    }, 500) // Wait 500ms after last input

    return () => clearTimeout(timer)
  }, [searchQuery, handleBarcodeDetected])

  const filteredItems = menuItems.filter((item) => {
    // Availability filter - hide items with 0 quantity if hide_unavailable_items is enabled
    if (hideUnavailableItems && item.available <= 0) {
      return false
    }

    // Category filter
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory

    // Search filter - search by name, category, or any text content
    const matchesSearch =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesCategory && matchesSearch
  })

  // Show loading state
  if (loading) {
    return <LoadingSpinner message="Loading products..." />
  }

  // Show scanner-only mode indicator (desktop only)
  const scannerOnlyIndicator = useScannerOnly && !isMobile && (
    <div className="fixed top-4 right-4 z-50 bg-blue-600/90 text-white px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm">
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1zm12 0h2a1 1 0 001-1V6a1 1 0 00-1-1h-2a1 1 0 00-1 1v1a1 1 0 001 1z" />
        </svg>
        <span className="text-sm font-medium">Scanner Only</span>
      </div>
    </div>
  )

  // Show error state with retry option
  if (error) {
    const getUserFriendlyError = (errorMessage: string): string => {
      if (errorMessage.includes('HTTP 403') || errorMessage.includes('403')) {
        return "Access denied. Please check your permissions or contact your administrator.";
      }
      if (errorMessage.includes('HTTP 401') || errorMessage.includes('401')) {
        return "Authentication required. Please log in again.";
      }
      if (errorMessage.includes('HTTP 404') || errorMessage.includes('404')) {
        return "Product service not available. Please contact your administrator.";
      }
      if (errorMessage.includes('HTTP 500') || errorMessage.includes('500')) {
        return "Server error. Please try again later.";
      }
      if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        return "Unable to connect to the server. Please check your internet connection.";
      }
      if (errorMessage.includes('Authentication required')) {
        return "Please log in to access products.";
      }
      return errorMessage;
    };

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Products</h2>
          <p className="text-gray-600 mb-4">{getUserFriendlyError(error)}</p>
          <button
            onClick={refetch}
            className="bg-beveren-600 text-white px-6 py-2 rounded-lg hover:bg-beveren-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Render mobile layout for screens smaller than 1024px
  if (isMobile) {
    return (
      <>
        <MobilePOSLayout
          items={filteredItems}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onScanBarcode={() => setShowScanner(true)}
          scannerOnly={useScannerOnly}
        />
        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onBarcodeDetected={handleBarcodeDetected}
        />
      </>
    )
  }

    // Desktop layout for larger screens
  return (
    <>
      {scannerOnlyIndicator}
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 pb-8">
        {/* Sidebar */}
        <RetailSidebar />

        {/* Menu Section - Takes remaining space minus cart width */}
        <div className="flex-1 overflow-hidden ml-20">
          <MenuGrid
            items={filteredItems}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={handleSearchInput}
            onSearchKeyPress={handleSearchKeyPress}
            onAddToCart={handleAddToCart}
            onScanBarcode={() => setShowScanner(true)}
            scannerOnly={useScannerOnly}
          />
        </div>

        {/* Order Summary - 30% width on medium and large screens */}
        <div className="w-[30%] min-w-[380px] max-w-[500px] bg-white shadow-lg overflow-y-auto">
          <OrderSummary
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            appliedCoupons={appliedCoupons}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
          />
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onBarcodeDetected={handleBarcodeDetected}
      />
    </>
  )
}
