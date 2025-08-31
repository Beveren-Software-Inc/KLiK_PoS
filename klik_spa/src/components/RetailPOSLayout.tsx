"use client"

import { useState, useEffect } from "react"
import { useProducts } from "../hooks/useProducts"
import RetailSidebar from "./RetailSidebar"
import MenuGrid from "./MenuGrid"
import OrderSummary from "./OrderSummary"
import MobilePOSLayout from "./MobilePOSLayout"
import LoadingSpinner from "./LoadingSpinner"
import BarcodeScannerModal from "./BarcodeScanner"
import { useBarcodeScanner } from "../hooks/useBarcodeScanner"
import type { MenuItem, CartItem, GiftCoupon } from "../../types"
import { useMediaQuery } from "../hooks/useMediaQuery"

export default function RetailPOSLayout() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [appliedCoupons, setAppliedCoupons] = useState<GiftCoupon[]>([])
  const [showScanner, setShowScanner] = useState(false)

  // Use professional data management
  const { products: menuItems, isLoading: loading, error, refetch } = useProducts()

  // Use media query to detect mobile/tablet screens
  const isMobile = useMediaQuery("(max-width: 1024px)")

  const handleAddToCart = (item: MenuItem) => {
    // Don't add if item is not available
    if (item.available <= 0) return

    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id)
    if (existingItem) {
      setCartItems(
        cartItems.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
        ),
      )
    } else {
      setCartItems([
        ...cartItems,
        {
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          image: item.image,
          quantity: 1,
        },
      ])
    }
  }

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter((item) => item.id !== id))
    } else {
      setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity } : item)))
    }
  }

  const handleRemoveItem = (id: string) => {
    setCartItems(cartItems.filter((item) => item.id !== id))
  }

  const handleClearCart = () => {
    setCartItems([])
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
  const { scanBarcode } = useBarcodeScanner(handleAddToCart)

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

  // Show error state with retry option
  if (error) {
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
          <p className="text-gray-600 mb-4">{error}</p>
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
      <div className="flex h-screen bg-gray-50">
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
