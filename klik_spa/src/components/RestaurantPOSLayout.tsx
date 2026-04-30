"use client";

import { useState, useEffect } from "react";
import { useProducts } from "../hooks/useProducts";
import { usePOSProfileStore } from "../stores/posProfileStore";
import MenuGrid from "./MenuGrid";
import OrderSummary from "./order/OrderSummary";
import MobilePOSLayout from "./MobilePOSLayout";
import LoadingSpinner from "./LoadingSpinner";
import type { MenuItem, CartItem, GiftCoupon } from "../../types";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { toast } from "react-toastify";

export default function RetailPOSLayout() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [appliedCoupons, setAppliedCoupons] = useState<GiftCoupon[]>([]);

  const { products: menuItems, isLoading: loading, error, refetch } = useProducts();
  const { posDetails } = usePOSProfileStore();
  const useScannerOnly = posDetails?.custom_use_scanner_fully || false;
  const isMobile = useMediaQuery("(max-width: 1024px)");

  useEffect(() => {
    if (error) {
      console.error("POS Error:", error);
    }
  }, [error]);

  const addItemToCart = (item: MenuItem) => {
    const existingItem = cartItems.find((cartItem) => cartItem.id === item.id);

    if (item.available <= 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }

    if (existingItem) {
      if (existingItem.quantity >= item.available) {
        toast.error(`Only ${item.available} ${item.uom || "units"} of ${item.name} available`);
        return;
      }

      setCartItems(
        cartItems.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        )
      );
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
          available: item.available,
          uom: item.uom,
          item_code: item.id,
        },
      ]);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.available <= 0) return;
    if (useScannerOnly) {
      toast.info("Scanner-only mode: Use barcode scanner to add items");
      return;
    }
    addItemToCart(item);
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter((item) => item.id !== id));
    } else {
      const item = cartItems.find((cartItem) => cartItem.id === id);
      if (item && item.available !== undefined && quantity > item.available) {
        toast.error(`Only ${item.available} ${item.uom || "units"} of ${item.name} available`);
        return;
      }
      setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity } : item)));
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleApplyCoupon = (coupon: GiftCoupon) => {
    if (!appliedCoupons.some((c) => c.code === coupon.code)) {
      setAppliedCoupons([...appliedCoupons, coupon]);
    }
  };

  const handleRemoveCoupon = (couponCode: string) => {
    setAppliedCoupons(appliedCoupons.filter((coupon) => coupon.code !== couponCode));
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return <LoadingSpinner message="Loading products..." />;
  }

  const scannerOnlyIndicator = useScannerOnly && !isMobile && (
    <div className="fixed z-50 bg-blue-600/90 text-white px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm top-20 right-4">
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1zm12 0h2a1 1 0 001-1V6a1 1 0 00-1-1h-2a1 1 0 00-1 1v1a1 1 0 001 1z" />
        </svg>
        <span className="text-sm font-medium">Scanner Only</span>
      </div>
    </div>
  );

  if (error && filteredItems.length === 0) {
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
    );
  }

  if (isMobile) {
    return (
      <MobilePOSLayout
        items={filteredItems}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        scannerOnly={useScannerOnly}
        onAddToCart={handleAddToCart}
      />
    );
  }

  return (
    <>
      {scannerOnlyIndicator}
      <div className="flex h-screen bg-gray-50 pb-8">
        <div className="flex-1 overflow-hidden lg:ml-20">
          <MenuGrid
            items={filteredItems}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddToCart={handleAddToCart}
            scannerOnly={useScannerOnly}
          />
        </div>
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
    </>
  );
}