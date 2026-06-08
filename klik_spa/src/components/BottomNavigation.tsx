import { Receipt, FileText, Grid3X3, BarChart3, Users, Banknote } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useUserInfo } from "../hooks/useUserInfo"
import { usePOSProfileStore } from "../stores/posProfileStore"

export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userInfo } = useUserInfo()
  const { posDetails } = usePOSProfileStore()

  const canAccessSalesDashboard = userInfo?.is_admin_user ?? false

   const menuItems = [
    { icon: Grid3X3, path: "/pos", label: "POS" },
     { icon: Receipt, path: "/invoice", label: "Invoice" },
     { icon: Banknote, path: "/payments", label: "Payments" },
     { icon: Users, path: "/customers", label: "Customers", requiresEditCreatePermission: true },
    { icon: BarChart3, path: "/dashboard", label: "Dashboard", requiresSalesDashboard: true },
    { icon: FileText, path: "/closing_shift", label: "Closing" },

  ]

  const isActive = (path: string) => {
    if (path === "/pos") {
      return location.pathname === "/" || location.pathname === "/pos"
    }
    return location.pathname.startsWith(path)
  }

  const handleNav = (item: (typeof menuItems)[0]) => {
    if (item.requiresSalesDashboard && !canAccessSalesDashboard) return
    navigate(item.path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-pb">
      <div className="flex items-center justify-around py-2 px-4">
        {menuItems.map((item, index) => {
          if (item.requiresEditCreatePermission && posDetails?.custom_allow_to_create_and_edit_customers !== 1) {
            return null
          }
          const disabled = item.requiresSalesDashboard && !canAccessSalesDashboard
          return (
          <button
            key={index}
            onClick={() => handleNav(item)}
            disabled={disabled}
            title={disabled ? "Sales Dashboard (Sales Manager, System Manager or Administrator only)" : item.label}
            className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 transition-colors ${
              disabled
                ? "opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500"
                : (isActive(item.path)
                ? "text-beveren-600 dark:text-beveren-400"
                : "text-gray-400 dark:text-gray-500")
            }`}
          >
            <item.icon
              size={20}
              className={`mb-1 ${
                disabled
                  ? "text-gray-400 dark:text-gray-500"
                  : (isActive(item.path)
                  ? "text-beveren-600 dark:text-beveren-400"
                  : "text-gray-400 dark:text-gray-500")
              }`}
            />
            <span
              className={`text-xs font-medium truncate ${
                disabled
                  ? "text-gray-400 dark:text-gray-500"
                  : (isActive(item.path)
                  ? "text-beveren-600 dark:text-beveren-400"
                  : "text-gray-400 dark:text-gray-500")
              }`}
            >
              {item.label}
            </span>
          </button>
        )})}
      </div>
    </div>
  )
}
