import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { useI18n } from "../hooks/useI18n"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { usePOSDetails } from "../hooks/usePOSProfile"
import { Search, Settings, LogOut, Moon, Sun, Store } from "lucide-react"

export default function NavBar() {
  const { t, language, setLanguage } = useI18n()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { posDetails } = usePOSDetails()
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
      window.location.href = "/klik_pos/login"
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if logout fails
      window.location.href = "/klik_pos/login"
    }
  }

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Generate initials from user's full name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

  const displayName = user?.full_name || user?.name || "Guest User"
  const posProfileName = posDetails?.name || "POS Profile"
  // const userRole = user?.role || "User"
  const initials = getInitials(displayName)

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 relative z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Left - Search */}
          <div className="flex items-center flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search menu"
                className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              />
            </div>
          </div>

          {/* Center - User Info */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <h3 className="font-semibold text-gray-800">{posProfileName}</h3>
              <p className="text-sm text-gray-500">{displayName}</p>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  console.log('Avatar clicked, current showUserMenu:', showUserMenu)
                  setShowUserMenu(!showUserMenu)
                }}
                className="w-10 h-10 bg-beveren-600 rounded-full flex items-center justify-center hover:bg-beveren-700 transition-colors focus:outline-none focus:ring-2 focus:ring-beveren-300 cursor-pointer"
                aria-label="User menu"
                type="button"
              >
                <span className="text-white font-medium text-sm pointer-events-none">{initials}</span>
              </button>

              {/* User dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] overflow-hidden">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-base">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{posProfileName}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Store size={14} className="text-gray-400 flex-shrink-0" />
                          <p className="text-sm text-gray-600 border border-gray-200 rounded px-2 py-1 bg-white truncate">
                            {displayName}
                          </p>
                        </div>
                        {/* <p className="text-xs text-beveren-600 font-medium mt-1">{userRole}</p> */}
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Settings size={16} className="mr-3 text-gray-500" />
                      <span>Settings</span>
                    </Link>

                    <button
                      onClick={() => {
                        toggleTheme()
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      type="button"
                    >
                      {theme === 'dark' ? (
                        <Sun size={16} className="mr-3 text-gray-500" />
                      ) : (
                        <Moon size={16} className="mr-3 text-gray-500" />
                      )}
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setLanguage(language === "en" ? "ar" : "en")
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      type="button"
                    >
                      <span className="mr-3 text-gray-500">🌐</span>
                      <span>{language === "en" ? "Switch to Arabic" : "Switch to English"}</span>
                    </button>

                    <div className="border-t border-gray-100 my-1"></div>

                    <button
                      onClick={() => {
                        handleLogout()
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
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

          {/* Right - Empty space for balance */}
          <div className="flex-1 max-w-md"></div>
        </div>
      </div>
    </nav>
  )
}
