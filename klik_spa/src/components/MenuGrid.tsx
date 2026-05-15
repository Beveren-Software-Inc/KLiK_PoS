"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useProduct } from "../providers/ProductProvider";
import { usePOSProfileStore } from "../stores/posProfileStore";
import { Settings, LogOut, Moon, Sun, Grid3X3, List, Store, RefreshCw, Lock, Unlock } from "lucide-react";
import { clearCacheAndReload } from "../utils/clearCache";
import CategoryTabs from "./CategoryTabs";
import ProductGrid from "./ProductGrid";
import SearchBar from "./SearchBar";
import SalespersonAuthModal from "./dialog/SalespersonAuthModal";
import { useSalespersonStore } from "../stores/salespersonStore";

interface MenuGridProps {
  onRefreshStock?: () => void;
  onScanBarcode?: () => void;
}

export default function MenuGrid({ onRefreshStock, onScanBarcode }: MenuGridProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    searchQuery,
    isSearching,
    hasMore,
    isLoadingMore,
    loadMoreProducts,
    totalCount,
    useScannerOnly,
    selectedCategory,
    setCategory,
    searchProducts,
    defaultView,
  } = useProduct();
  
  const { posDetails } = usePOSProfileStore();
  const { activeSalesperson, rememberLocked, ensureInitialized } = useSalespersonStore();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSalespersonModal, setShowSalespersonModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewMode(defaultView);
  }, [defaultView]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (posDetails?.custom_sales_person_pin_required) {
      void ensureInitialized();
    }
  }, [posDetails?.custom_sales_person_pin_required, ensureInitialized]);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/klik_pos/login";
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = "/klik_pos/login";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
  };

  const displayName = user?.full_name || user?.name || "Guest User";
  const userEmail = user?.email || user?.name || "No email";
  const posProfileName = posDetails?.name || "POS Profile";
  const initials = getInitials(displayName);
  const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required;

  const handleSearchChange = (query: string) => {
    searchProducts(query);
  };

  const handleCategoryChange = (category: string) => {
    setCategory(category);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 flex-1 max-w-md">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onScanBarcode={onScanBarcode}
            />
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 text-beveren-600 dark:text-beveren-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-beveren-600 dark:text-beveren-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 ml-6 relative" ref={dropdownRef}>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{posProfileName}</div>
              {requiresSalespersonPin ? (
                <button
                  type="button"
                  onClick={() => setShowSalespersonModal(true)}
                  className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-beveren-300 hover:text-beveren-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {rememberLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  <span>{activeSalesperson?.salesperson_name || "Verify salesperson"}</span>
                </button>
              ) : null}
              <div className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</div>
            </div>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-beveren-600 rounded-full flex items-center justify-center hover:bg-beveren-700 transition-colors focus:outline-none focus:ring-2 focus:ring-beveren-300 cursor-pointer"
              aria-label="User menu"
              type="button"
            >
              <span className="text-white text-sm font-medium pointer-events-none">{initials}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-base">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{posProfileName}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <Store size={14} className="text-gray-400 flex-shrink-0" />
                        <p className="text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-600 truncate">
                          {displayName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                    <span>Settings</span>
                  </Link>

                  <button
                    onClick={() => {
                      toggleTheme();
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    type="button"
                  >
                    {theme === 'dark' ? (
                      <Sun size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <Moon size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                    )}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (onRefreshStock) onRefreshStock();
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    type="button"
                  >
                    <RefreshCw size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                    <span>Refresh Stock</span>
                  </button>

                  <button
                    onClick={async () => {
                      await clearCacheAndReload();
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    type="button"
                  >
                    <RefreshCw size={16} className="mr-3 text-gray-500 dark:text-gray-400" />
                    <span>Clear Cache</span>
                  </button>

                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    type="button"
                  >
                    <LogOut size={16} className="mr-3" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6">
          <CategoryTabs
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ProductGrid
          scannerOnly={useScannerOnly}
          viewMode={viewMode}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMoreProducts}
          totalCount={totalCount}
          isSearching={isSearching}
        />
      </div>

      <SalespersonAuthModal
        isOpen={showSalespersonModal}
        onClose={() => setShowSalespersonModal(false)}
        title="Change salesperson"
        description="Switch the active salesperson for this POS session."
      />
    </div>
  );
}