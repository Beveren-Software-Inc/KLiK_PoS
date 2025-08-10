import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useI18n } from "../hooks/useI18n"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { useCartStore } from "../stores/cartStore"
import { ShoppingCart, Menu, X, Search, Settings, LogOut, Moon, Sun, Mail } from "lucide-react"
import CategoryTabs from "./CategoryTabs"
import ProductGrid from "./ProductGrid"
import BottomNavigation from "./BottomNavigation"
import type { MenuItem, CartItem } from "../../types"

interface MobilePOSLayoutProps {
  items: MenuItem[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export default function MobilePOSLayout({
  items,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: MobilePOSLayoutProps) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { cartItems, addToCart } = useCartStore()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownRef])

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/login"
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = "/login"
    }
  }

  // Generate initials from user's full name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  const displayName = user?.full_name || user?.name || "Guest User"
  const userRole = user?.role || "User"
  const initials = getInitials(displayName)

  const totalItems = cartItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0)
  const totalAmount = cartItems.reduce((sum: number, item: CartItem) => sum + item.price * item.quantity, 0)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <img src="/assets/klik_pos/klik_spa/beveren-logo-180.png" alt="KLIK POS" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-bold text-beveren-600 dark:text-beveren-400">KLIK POS</span>
          </div>

          <div className="flex items-center space-x-2 relative" ref={dropdownRef}>
            <div className="text-right">
              <div className="text-xs font-medium text-gray-900 dark:text-white">{displayName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email || "No email"}</div>
            </div>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-beveren-600 rounded-full flex items-center justify-center hover:bg-beveren-700 transition-colors focus:outline-none focus:ring-2 focus:ring-beveren-300 cursor-pointer"
              aria-label="User menu"
              type="button"
            >
              <span className="text-white text-xs font-medium pointer-events-none">{initials}</span>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <Mail size={12} className="text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-600 truncate">
                          {user?.email || "No email"}
                        </p>
                      </div>
                      <p className="text-xs text-beveren-600 dark:text-beveren-400 font-medium mt-1">{user?.role || "User"}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings size={14} className="mr-3 text-gray-500 dark:text-gray-400" />
                    <span>Settings</span>
                  </Link>
                  
                  <button
                    onClick={() => {
                      toggleTheme()
                      setShowUserMenu(false)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    type="button"
                  >
                    {theme === 'dark' ? (
                      <Sun size={14} className="mr-3 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <Moon size={14} className="mr-3 text-gray-500 dark:text-gray-400" />
                    )}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                  
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  
                  <button
                    onClick={() => {
                      handleLogout()
                      setShowUserMenu(false)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    type="button"
                  >
                    <LogOut size={14} className="mr-3" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={t("SEARCH_PRODUCTS")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 pb-2">
          <CategoryTabs selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} isMobile={true} />
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto">
        <ProductGrid items={items} onAddToCart={addToCart} isMobile={true} />
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-20 right-6 bg-beveren-600 text-white rounded-full p-4 shadow-lg hover:bg-beveren-700 transition-colors z-30"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {totalItems}
            </span>
          </div>
        </button>
      )}

      {/* Bottom Cart Summary - Above Bottom Navigation */}
      {totalItems > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 z-40">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">{totalItems} items</div>
            <div className="text-lg font-bold text-beveren-600 dark:text-beveren-400">${totalAmount.toFixed(2)}</div>
            <button
              onClick={() => navigate('/cart')}
              className="bg-beveren-600 text-white px-6 py-2 rounded-lg hover:bg-beveren-700 transition-colors font-medium"
            >
              View Cart
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />

    </div>
  )
}
