import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { useI18n } from "../hooks/useI18n"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { Settings, LogOut, Moon, Sun, Mail } from "lucide-react"
import CategoryTabs from "./CategoryTabs"
import ProductGrid from "./ProductGrid"
import SearchBar from "./SearchBar"
import type { MenuItem } from "../../types"

interface MenuGridProps {
  items: MenuItem[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearchKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onAddToCart: (item: MenuItem) => void
  onScanBarcode?: () => void
}

export default function MenuGrid({
  items,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onSearchKeyPress,
  onAddToCart,
  onScanBarcode,
}: MenuGridProps) {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
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

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        {/* Search and User Info */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 max-w-md">
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              onSearchKeyPress={onSearchKeyPress}
              onScanBarcode={onScanBarcode}
            />
          </div>
          <div className="flex items-center space-x-4 ml-6 relative" ref={dropdownRef}>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email || "No email"}</div>
            </div>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-beveren-600 rounded-full flex items-center justify-center hover:bg-beveren-700 transition-colors focus:outline-none focus:ring-2 focus:ring-beveren-300 cursor-pointer"
              aria-label="User menu"
              type="button"
            >
              <span className="text-white text-sm font-medium pointer-events-none">{initials}</span>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[100] overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-base">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <Mail size={14} className="text-gray-400 flex-shrink-0" />
                        <p className="text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-600 truncate">
                          {user?.email || "No email"}
                        </p>
                      </div>
                      <p className="text-xs text-beveren-600 dark:text-beveren-400 font-medium mt-1">{userRole}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
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
                      toggleTheme()
                      setShowUserMenu(false)
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

                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                  <button
                    onClick={() => {
                      handleLogout()
                      setShowUserMenu(false)
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

        {/* Categories */}
        <div className="px-6">
          <CategoryTabs selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} />
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto">
        <ProductGrid items={items} onAddToCart={onAddToCart} />
      </div>
    </div>
  )
}
