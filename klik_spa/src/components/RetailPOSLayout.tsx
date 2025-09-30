"use client"

import { useState, useEffect, useCallback } from "react"
import { useProducts } from "../hooks/useProducts"
import { usePOSDetails } from "../hooks/usePOSProfile"

import MenuGrid from "./MenuGrid"
import OrderSummary from "./OrderSummary"
import MobilePOSLayout from "./MobilePOSLayout"
import LoadingSpinner from "./LoadingSpinner"
import BarcodeScannerModal from "./BarcodeScanner"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import type { MenuItem, GiftCoupon, POSProfile } from "../../types"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { useCartStore } from "../stores/cartStore"

export default function RetailPOSLayout() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [appliedCoupons, setAppliedCoupons] = useState<GiftCoupon[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [pinnedItemId, setPinnedItemId] = useState<string | null>(null)

  // Use cart store instead of local state
  const { cartItems, addToCart, updateQuantity, removeItem, clearCart } = useCartStore()

  // Use professional data management
  const { products: menuItems, isLoading: loading, error, refetch } = useProducts()

  // Get POS details including scanner-only setting
  const { posDetails } = usePOSDetails()
  const useScannerOnly = posDetails?.custom_use_scanner_fully || false
  const hideUnavailableItems = posDetails?.hide_unavailable_items || false
  type POSProfileWithCustom = POSProfile & { custom_scale_barcodes_start_with?: string }
  const scalePrefix = (posDetails as POSProfileWithCustom)?.custom_scale_barcodes_start_with || ""

  // Debug: show configured scale prefix once per mount/changes
  useEffect(() => {
    console.log('[ScaleDebug] scalePrefix:', scalePrefix)
  }, [scalePrefix])

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

  // Helpers for scale barcodes like in posawesome
  const parseScaleBarcode = useCallback((raw: string) => {
    if (!scalePrefix || !raw.startsWith(scalePrefix)) return { isScale: false as const }

    // First 7 chars represent the item code/barcode identifier (as per posawesome)
    const base = raw.substring(0, 7)
    // Accept 1-5 trailing digits while typing; DO NOT left-pad (match posawesome logic)
    const qtyBlock = raw.substring(7)
    if (!/^\d{1,5}$/.test(qtyBlock)) {
      return { isScale: false as const }
    }

    // Convert qtyBlock to decimal mimicking posawesome rules
    // 00089 -> 0.89, 00900 -> 0.900, 01234 -> 1.234, 12345 -> 12.345
    let qtyStr = ""
    if (qtyBlock.startsWith("0000")) {
      qtyStr = "0.00" + qtyBlock.substring(4)
    } else if (qtyBlock.startsWith("000")) {
      qtyStr = "0.0" + qtyBlock.substring(3)
    } else if (qtyBlock.startsWith("00")) {
      qtyStr = "0." + qtyBlock.substring(2)
    } else if (qtyBlock.startsWith("0")) {
      qtyStr = qtyBlock.substring(1, 2) + "." + qtyBlock.substring(2)
    } else {
      qtyStr = qtyBlock.substring(0, 2) + "." + qtyBlock.substring(2)
    }

    const qty = parseFloat(qtyStr)
    if (Number.isNaN(qty) || qty <= 0) return { isScale: false as const }

    return { isScale: true as const, baseBarcode: base, quantity: qty }
  }, [scalePrefix])

  const addOrIncreaseWithQuantity = useCallback((item: MenuItem, quantity: number) => {
    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id)
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + quantity)
    } else {
      // Add directly to cart with base quantity 0, then set exact quantity
      addToCart({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        image: item.image,
        available: item.available,
        uom: item.uom,
        item_code: item.id,
      })
      updateQuantity(item.id, quantity)
    }
  }, [cartItems, updateQuantity, addToCart])

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
        available: item.available,
        uom: item.uom,
        item_code: item.id, // item.id is the item_code from the API
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

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const success = await scanBarcode(barcode)
    if (success) {
      setShowScanner(false)
    }
  }, [scanBarcode])

  // Handle search input for both product search and barcode scanning
  const handleSearchInput = (query: string) => {
    setSearchQuery(query)

    // If input looks like a barcode (numeric-only, 8+ digits),
    // it might be from a hardware scanner (reduced false positives)
    if (useScannerOnly && query.length >= 8 && /^[0-9]+$/.test(query)) {
      console.log('Potential barcode input detected:', query)
    }

    // Manage pinning behavior for scale barcodes while typing
    const isScaleTyping = !!scalePrefix &&
      query &&
      /^[0-9]+$/.test(query) &&
      query.startsWith(scalePrefix) &&
      query.length >= 7

    if (isScaleTyping) {
      const base = query.substring(0, 7)
      const matched = menuItems.find(mi => mi.id === base || (mi.barcode && mi.barcode === base))
      setPinnedItemId(matched ? matched.id : null)
      console.log('[ScaleDebug] typing:', { query, base, matchedId: matched?.id, pinnedItemId: matched ? matched.id : null })
    } else {
      if (pinnedItemId) {
        console.log('[ScaleDebug] clearing pinned due to not scale typing:', { query })
        setPinnedItemId(null)
      }
    }
  }

  // Handle Enter key for barcode processing
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()

      // First: handle scale barcodes regardless of scanner-only setting
      if (/^[0-9]+$/.test(searchQuery) && scalePrefix && searchQuery.startsWith(scalePrefix)) {
        const parsed = parseScaleBarcode(searchQuery.trim())
        if (parsed.isScale) {
          const base = parsed.baseBarcode
          const qty = parsed.quantity

          const item = menuItems.find(mi => mi.id === base || (mi.barcode && mi.barcode === base))
          if (item) {
            console.log('[ScaleDebug] enter scale add:', { base, qty, itemId: item.id })
            addOrIncreaseWithQuantity(item, qty)
            setSearchQuery('')
            setPinnedItemId(null)
            return
          }

          // Fallback: process via barcode flow with base identifier
          console.log('[ScaleDebug] enter scale fallback via handleBarcodeDetected:', { base, qty })
          handleBarcodeDetected(base)
          const fallbackItem = menuItems.find(mi => mi.id === base)
          if (fallbackItem) {
            console.log('[ScaleDebug] enter scale fallback update qty:', { fallbackId: fallbackItem.id, qty })
            addOrIncreaseWithQuantity(fallbackItem, qty)
          }
          setSearchQuery('')
          setPinnedItemId(null)
          return
        }
      }

      // Non-scale numeric barcode: only process automatically in scanner-only mode
      if (useScannerOnly && /^[0-9]+$/.test(searchQuery)) {
        console.log('Processing as barcode:', searchQuery)
        handleBarcodeDetected(searchQuery.trim())
        setSearchQuery('')
        setPinnedItemId(null)
        return
      }

      // Regular search - do not clear the input
      console.log('Processing as product search:', searchQuery)
    }
  }

  // Auto-process barcode after a short delay (for hardware scanners)
  useEffect(() => {
    if (!useScannerOnly) return

    const timer = setTimeout(() => {
      if (searchQuery.length >= 8 && /^[0-9]+$/.test(searchQuery)) {
        const parsed = parseScaleBarcode(searchQuery.trim())
        if (parsed.isScale) {
          const base = parsed.baseBarcode
          const qty = parsed.quantity
          const item = menuItems.find(mi => mi.id === base || (mi.barcode && mi.barcode === base))
          if (item) {
            console.log('[ScaleDebug] auto scale add:', { base, qty, itemId: item.id })
            addOrIncreaseWithQuantity(item, qty)
            setSearchQuery('')
            setPinnedItemId(null)
            return
          }
        }
        console.log('Auto-processing potential barcode:', searchQuery)
        handleBarcodeDetected(searchQuery.trim())
        setSearchQuery('')
        setPinnedItemId(null)
      }
    }, 500) // Wait 500ms after last input

    return () => clearTimeout(timer)
  }, [searchQuery, handleBarcodeDetected, useScannerOnly, menuItems, parseScaleBarcode, addOrIncreaseWithQuantity])

  const filteredItems = menuItems.filter((item) => {
    // Availability filter - hide items with 0 quantity if hide_unavailable_items is enabled
    if (hideUnavailableItems && item.available <= 0) {
      return false
    }

    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory

    // Special handling for scale barcodes while typing: if a scale prefix is set and
    // the search starts with that numeric prefix, use only the base part (first 7 chars)
    // for filtering so that extra quantity digits do not hide the item
    const isScaleTyping = !!scalePrefix &&
      searchQuery &&
      /^[0-9]+$/.test(searchQuery) &&
      searchQuery.startsWith(scalePrefix) &&
      searchQuery.length >= 7

    // If exactly one item is already matched and pinned, keep it visible regardless of extra digits
    const queryForFilter = pinnedItemId && isScaleTyping ? searchQuery.substring(0, 7) : (isScaleTyping ? searchQuery.substring(0, 7) : searchQuery)
    if (isScaleTyping) {
      console.log('[ScaleDebug] filter using base:', { searchQuery, base: queryForFilter, pinnedItemId })
    }

    // Search filter - search by name, category, item_code, barcode, or any text content
    const matchesSearch =
      queryForFilter === "" ||
      item.name.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.id.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.description?.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(queryForFilter.toLowerCase()))

    // If pinned, ensure the pinned item always passes
    const passes = matchesCategory && matchesSearch
    if (pinnedItemId && isScaleTyping) {
      const keep = passes || item.id === pinnedItemId
      if (!passes && keep) {
        console.log('[ScaleDebug] keeping pinned in results:', { itemId: item.id, pinnedItemId })
      }
      return keep
    }
    return passes
  })

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
