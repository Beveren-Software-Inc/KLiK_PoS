"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useProducts } from "../hooks/useProducts"
import { usePOSDetails } from "../hooks/usePOSProfile"

import MenuGrid from "./MenuGrid"
import OrderSummary from "./OrderSummary"
import MobilePOSLayout from "./MobilePOSLayout"
import LoadingSpinner from "./LoadingSpinner"
import BarcodeScannerModal from "./BarcodeScanner"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import type { MenuItem, GiftCoupon } from "../../types"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { useCartStore } from "../stores/cartStore"
import { toast } from "react-toastify"
import { getItemPriceForCustomer } from "../services/dynamicPricing"

export default function RetailPOSLayout() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [localSearchQuery, setLocalSearchQuery] = useState("")
  const [appliedCoupons, setAppliedCoupons] = useState<GiftCoupon[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [pinnedItemId, setPinnedItemId] = useState<string | null>(null)
  const [identifierItemId, setIdentifierItemId] = useState<string | null>(null)

  // Debounce timer ref for search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Use cart store instead of local state
  const { cartItems, addToCart, updateQuantity, removeItem, clearCart, selectedCustomer } = useCartStore()

  // Use professional data management with pagination
  const {
    products: menuItems,
    isLoading: loading,
    isLoadingMore,
    isSearching,
    error,
    refetch,
    loadMoreProducts,
    searchProducts,
    hasMore,
    totalCount,
    searchQuery: serverSearchQuery,
  } = useProducts()

  // Get POS details including scanner-only setting
  const { posDetails } = usePOSDetails()
  const useScannerOnly = posDetails?.custom_use_scanner_fully || false
  const hideUnavailableItems = posDetails?.hide_unavailable_items || false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scalePrefix = (posDetails as any)?.custom_scale_barcodes_start_with || ""

  const isPharmacy = posDetails?.custom_is_pharmacy === 1 ||
    posDetails?.custom_is_pharmacy === true ||
    posDetails?.custom_is_pharmacy === "1"

  const pharmacyDefaultUom =
    typeof posDetails?.custom_pharmacy_default_uom === "string"
      ? posDetails.custom_pharmacy_default_uom.trim()
      : ""

  const resolveUomForCart = (item: MenuItem) => {
    if (isPharmacy && pharmacyDefaultUom) return pharmacyDefaultUom
    return item.uom
  }

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

  // Helpers for scale barcodes
  const parseScaleBarcode = useCallback((raw: string) => {
    if (!scalePrefix || !raw.startsWith(scalePrefix)) return { isScale: false as const }

    // Expect EAN-13 style: [7 digits item][5 digits weight][1 digit check]
    // Example: 9900001 00760 6
    if (!/^\d{12,13}$/.test(raw)) {
      return { isScale: false as const }
    }

    const base = raw.substring(0, 7)
    // If 13 digits: last is check digit; if 12 while typing, skip validation
    const hasCheck = raw.length >= 13
    const body12 = raw.substring(0, 12)
    const check = hasCheck ? raw.substring(12, 13) : null

    // Extract 5-digit weight block (positions 7..11)
    const qtyBlock = body12.substring(7, 12)
    if (!/^\d{5}$/.test(qtyBlock)) {
      return { isScale: false as const }
    }

    // Optional check-digit validation (EAN-13 mod10)
    if (hasCheck) {
      const computeEAN13 = (digits12: string): string => {
        let sum = 0
        for (let i = 0; i < 12; i++) {
          const n = parseInt(digits12.charAt(i), 10)
          sum += (i % 2 === 0) ? n : n * 3
        }
        const mod = sum % 10
        return mod === 0 ? '0' : String(10 - mod)
      }
      const expected = computeEAN13(body12)
      if (expected !== check) {
        // Invalid check digit - continue parsing
      }
    }

    // Convert qtyBlock to decimal weight.
    // For scale labels using grams in 5 digits (e.g., 00760 = 760g),
    // convert to kilograms with two decimals: 00760 -> 0.76 (divide by 1000)
    const qtyNum = parseInt(qtyBlock, 10)
    const qty = qtyNum / 1000
    if (Number.isNaN(qty) || qty <= 0) return { isScale: false as const }

    return { isScale: true as const, baseBarcode: base, quantity: qty }
  }, [scalePrefix])

  const addOrIncreaseWithQuantity = useCallback(async (item: MenuItem, quantity: number) => {
    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id)
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + quantity)
    } else {
      const uomToUse = resolveUomForCart(item)
      let priceToUse = item.price

      // If we override the UOM in pharmacy mode and no customer is selected,
      // fetch the base price for that UOM so the cart starts with the correct rate.
      if (isPharmacy && pharmacyDefaultUom && !selectedCustomer && pharmacyDefaultUom !== item.uom) {
        const priceInfo = await getItemPriceForCustomer(item.id, undefined, pharmacyDefaultUom)
        if (priceInfo?.success && priceInfo.price > 0) {
          priceToUse = priceInfo.price
        }
      }

      // Add to cart first (async), then set exact quantity to avoid initial qty=1
      await addToCart({
        id: item.id,
        name: item.name,
        category: item.category,
        price: priceToUse,
        image: item.image,
        available: item.available,
        uom: uomToUse,
        item_code: item.id,
      })
      updateQuantity(item.id, quantity)
    }
  }, [cartItems, updateQuantity, addToCart, isPharmacy, pharmacyDefaultUom, selectedCustomer])

  // Separate function for adding items to cart (used by both click and barcode)
  const addItemToCart = (item: MenuItem) => {
    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id)
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      const uomToUse = resolveUomForCart(item)
      const shouldFetchPrice = isPharmacy && pharmacyDefaultUom && !selectedCustomer && pharmacyDefaultUom !== item.uom

      if (shouldFetchPrice) {
        getItemPriceForCustomer(item.id, undefined, pharmacyDefaultUom).then((priceInfo) => {
          const priceToUse = (priceInfo?.success && priceInfo.price > 0) ? priceInfo.price : item.price
          addToCart({
            id: item.id,
            name: item.name,
            category: item.category,
            price: priceToUse,
            image: item.image,
            available: item.available,
            uom: uomToUse,
            item_code: item.id, // item.id is the item_code from the API
          })
        }).catch(() => {
          addToCart({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            image: item.image,
            available: item.available,
            uom: uomToUse,
            item_code: item.id, // item.id is the item_code from the API
          })
        })
      } else {
        addToCart({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
          available: item.available,
          uom: uomToUse,
          item_code: item.id, // item.id is the item_code from the API
        })
      }
    }

    // Show success message for barcode scanning
    if (useScannerOnly) {
      // Barcode scanning success handled silently
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
    setLocalSearchQuery(query)

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
    } else {
      if (pinnedItemId) {
        setPinnedItemId(null)
      }
    }

    // Reset identifier resolution when query changes; will re-resolve via effect
    setIdentifierItemId(null)

    // Debounced server-side search for any query (text or numeric); still keep barcode paths elsewhere
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    const trimmedQuery = query.trim()

    // Trigger server-side search for any non-empty query (length >= 1)
    if (trimmedQuery.length >= 1) {
      searchDebounceRef.current = setTimeout(() => {
        searchProducts(trimmedQuery)
      }, 300) // 300ms debounce
    } else if (!trimmedQuery) {
      // Clear search when query is empty
      searchProducts('')
    }
  }

  // Handle Enter key for barcode processing
  const handleSearchKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && localSearchQuery.trim()) {
      e.preventDefault()

      // First: handle scale barcodes regardless of scanner-only setting
      if (/^[0-9]+$/.test(localSearchQuery) && scalePrefix && localSearchQuery.startsWith(scalePrefix)) {
        const raw = localSearchQuery.trim()

        // Enforce presence of single check digit (total 13 digits) for scale barcodes
        if (raw.length !== 13) {
          toast.error('Scale barcode must be 13 digits including check digit')
          return
        }

        // Validate EAN-13 check digit strictly before proceeding
        const body12 = raw.substring(0, 12)
        const providedCheck = raw.substring(12, 13)
        const computeEAN13 = (digits12: string): string => {
          let sum = 0
          for (let i = 0; i < 12; i++) {
            const n = parseInt(digits12.charAt(i), 10)
            sum += (i % 2 === 0) ? n : n * 3
          }
          const mod = sum % 10
          return mod === 0 ? '0' : String(10 - mod)
        }
        const expectedCheck = computeEAN13(body12)
        if (expectedCheck !== providedCheck) {
          toast.error('Invalid scale barcode check digit')
          return
        }

        const parsed = parseScaleBarcode(raw)
        if (parsed.isScale) {
          const base = parsed.baseBarcode
          const qty = parsed.quantity

          const item = menuItems.find(mi => mi.id === base || (mi.barcode && mi.barcode === base))
          if (item) {
            await addOrIncreaseWithQuantity(item, qty)
            setLocalSearchQuery('')
            setPinnedItemId(null)
            return
          }

          // Fallback: resolve item by identifier via API, then add with correct qty
          try {
            const res = await fetch(`/api/method/klik_pos.api.item.get_item_by_identifier?code=${encodeURIComponent(base)}`)
            const data = await res.json()
            if (data?.message?.item_code) {
              const fetched: MenuItem = {
                id: data.message.item_code,
                name: data.message.item_name || data.message.item_code,
                category: data.message.item_group || 'General',
                price: data.message.price || 0,
                available: data.message.available || 0,
                image: data.message.image,
                sold: 0,
                uom: data.message.stock_uom,
              }
              await addOrIncreaseWithQuantity(fetched, qty)
            }
          } catch {
            // ignore
          }
          setLocalSearchQuery('')
          setPinnedItemId(null)
          return
        }
      }

      // Non-scale numeric barcode: only process automatically in scanner-only mode
      if (useScannerOnly && /^[0-9]+$/.test(localSearchQuery)) {
        console.log('Processing as barcode:', localSearchQuery)
        handleBarcodeDetected(localSearchQuery.trim())
        setLocalSearchQuery('')
        setPinnedItemId(null)
        return
      }

      // Regular search - trigger server-side search on Enter
      console.log('Processing as product search:', localSearchQuery)
      searchProducts(localSearchQuery.trim())

      // Additionally try resolving batch/serial on Enter for user convenience
      ;(async () => {
        try {
          const res = await fetch(`/api/method/klik_pos.api.item.get_item_by_identifier?code=${encodeURIComponent(localSearchQuery.trim())}`)
          const data = await res.json()
          console.log('Batch/Serial lookup result:', data)
          if (data?.message?.item_code) {
            const item = {
              id: data.message.item_code,
              name: data.message.item_name || data.message.item_code,
              category: data.message.item_group || 'General',
              price: data.message.price || 0,
              available: data.message.available || 0,
              image: data.message.image,
              sold: 0,
            } as MenuItem
            addOrIncreaseWithQuantity(item, 1)
            // Pre-select batch or serial if matched
            const matchedType = data.message.matched_type
            const matchedValue = data.message.matched_value
            if (matchedType === 'batch') {
              window.dispatchEvent(new CustomEvent('cart:setBatchForItem', { detail: { itemCode: item.id, batchId: matchedValue } }))
            } else if (matchedType === 'serial') {
              window.dispatchEvent(new CustomEvent('cart:setSerialForItem', { detail: { itemCode: item.id, serialNo: matchedValue } }))
            }
            setLocalSearchQuery('')
            setPinnedItemId(null)
          }
        } catch {
          // ignore
        }
      })()
    }
  }

  // Auto-process barcode after a short delay (for hardware scanners)
  useEffect(() => {
    if (!useScannerOnly) return

    const timer = setTimeout(() => {
      if (localSearchQuery.length >= 8 && /^[0-9]+$/.test(localSearchQuery)) {
        const parsed = parseScaleBarcode(localSearchQuery.trim())
        if (parsed.isScale) {
          const base = parsed.baseBarcode
          const qty = parsed.quantity
          const item = menuItems.find(mi => mi.id === base || (mi.barcode && mi.barcode === base))
          if (item) {
            addOrIncreaseWithQuantity(item, qty)
            setLocalSearchQuery('')
            setPinnedItemId(null)
            return
          }
        }
        console.log('Auto-processing potential barcode:', localSearchQuery)
        handleBarcodeDetected(localSearchQuery.trim())
        setLocalSearchQuery('')
        setPinnedItemId(null)
      }
    }, 500) // Wait 500ms after last input

    return () => clearTimeout(timer)
  }, [localSearchQuery, handleBarcodeDetected, useScannerOnly, menuItems, parseScaleBarcode, addOrIncreaseWithQuantity])

  // Resolve item by batch/serial/barcode while typing to show in results list (non-blocking)
  useEffect(() => {
    // Skip when empty or when scale typing (handled separately)
    if (!localSearchQuery) return
    const isScaleTyping = !!scalePrefix && /^[0-9]+$/.test(localSearchQuery) && localSearchQuery.startsWith(scalePrefix) && localSearchQuery.length >= 7
    if (isScaleTyping) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/method/klik_pos.api.item.get_item_by_identifier?code=${encodeURIComponent(localSearchQuery.trim())}`)
        const data = await res.json()
        if (!cancelled && data?.message?.item_code) {
          setIdentifierItemId(data.message.item_code)
        }
      } catch {
        if (!cancelled) setIdentifierItemId(null)
      }
    }, 250)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [localSearchQuery, scalePrefix])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [])

  // When server-side search is active, use menuItems directly (already filtered by server)
  // Only apply local filtering for category and scale barcode typing
  const filteredItems = menuItems.filter((item) => {
    // Availability filter - hide items with 0 quantity if hide_unavailable_items is enabled
    if (hideUnavailableItems && item.available <= 0) {
      return false
    }

    // If server-side search is active, do NOT apply category filter locally.
    // Server already filtered; just return the item (respecting availability above).
    if (serverSearchQuery) {
      return true
    }

    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory

    // Special handling for scale barcodes while typing: if a scale prefix is set and
    // the search starts with that numeric prefix, use only the base part (first 7 chars)
    // for filtering so that extra quantity digits do not hide the item
    const isScaleTyping = !!scalePrefix &&
      localSearchQuery &&
      /^[0-9]+$/.test(localSearchQuery) &&
      localSearchQuery.startsWith(scalePrefix) &&
      localSearchQuery.length >= 7

    // If exactly one item is already matched and pinned, keep it visible regardless of extra digits
    const queryForFilter = pinnedItemId && isScaleTyping ? localSearchQuery.substring(0, 7) : (isScaleTyping ? localSearchQuery.substring(0, 7) : '')

    // Local filtering for barcode typing or when no server search
    const matchesSearch =
      queryForFilter === "" ||
      item.name.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.id.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      item.description?.toLowerCase().includes(queryForFilter.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(queryForFilter.toLowerCase()))

    // If pinned or identifier resolved, ensure the item always passes
    const passes = matchesCategory && matchesSearch
    if (pinnedItemId && isScaleTyping) {
      const keep = passes || item.id === pinnedItemId
      return keep
    }
    if (identifierItemId) {
      return passes || item.id === identifierItemId
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

  // Show error state with retry option (but keep showing products if we have any)
  if (error && filteredItems.length === 0) {
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
          searchQuery={localSearchQuery}
          onSearchChange={handleSearchInput}
          onScanBarcode={() => setShowScanner(true)}
          scannerOnly={useScannerOnly}
          hasMore={hasMore && !serverSearchQuery}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreProducts}
          totalCount={totalCount}
          isSearching={isSearching}
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
            searchQuery={localSearchQuery}
            onSearchChange={handleSearchInput}
            onSearchKeyPress={handleSearchKeyPress}
            onAddToCart={handleAddToCart}
            onScanBarcode={() => setShowScanner(true)}
            scannerOnly={useScannerOnly}
            hasMore={hasMore && !serverSearchQuery}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreProducts}
            totalCount={totalCount}
            isSearching={isSearching}
          />
        </div>

        {/* Order Summary - 35% width on medium and large screens */}
        <div className="w-[35%] min-w-[420px] max-w-[600px] bg-white shadow-lg overflow-y-auto">
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
