import { CreditCard, FileText, Grid3X3, Settings, BarChart3, Users } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"

export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { icon: Grid3X3, path: "/pos", label: "POS" },
    { icon: BarChart3, path: "/dashboard", label: "Dashboard" },
    { icon: Users, path: "/customers", label: "Customers" },
    { icon: FileText, path: "/reports", label: "Reports" },
    { icon: Settings, path: "/settings", label: "Settings" },
  ]

  const isActive = (path: string) => {
    if (path === "/pos") {
      return location.pathname === "/" || location.pathname === "/pos"
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-pb">
      <div className="flex items-center justify-around py-2 px-4">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 transition-colors ${
              isActive(item.path)
                ? "text-beveren-600 dark:text-beveren-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            <item.icon 
              size={20} 
              className={`mb-1 ${
                isActive(item.path)
                  ? "text-beveren-600 dark:text-beveren-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            />
            <span 
              className={`text-xs font-medium truncate ${
                isActive(item.path)
                  ? "text-beveren-600 dark:text-beveren-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
