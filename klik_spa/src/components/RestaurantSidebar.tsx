import { Receipt, FileText, Grid3X3, Settings, BarChart3, Users } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"

export default function RetailSidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { icon: Grid3X3, path: "/pos", label: "POS" },
    { icon: BarChart3, path: "/dashboard", label: "Dashboard" },
    { icon: Users, path: "/customers", label: "Customers" },
    { icon: FileText, path: "/reports", label: "Reports" },
    { icon: Receipt, path: "/invoice", label: "InvoiceHistory" },
  ]

  const isActive = (path: string) => {
    if (path === "/pos") {
      return location.pathname === "/" || location.pathname === "/pos"
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="w-20 bg-white dark:bg-gray-800 shadow-lg flex flex-col border-r border-gray-200 dark:border-gray-700">
      {/* Logo Section - Fixed height to match other sections */}
      <div className="h-20 flex items-center justify-center border-b border-gray-100 dark:border-gray-700">
        <img src="/beveren-software-icon.webp" alt="Beveren Software" className="w-12 h-12 rounded-full object-cover" />
      </div>

      {/* Menu Items - Flexible space */}
      <div className="flex-1 flex flex-col items-center py-6 space-y-4">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => navigate(item.path)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isActive(item.path)
                ? "bg-beveren-100 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={item.label}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>

      {/* Settings at bottom */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => navigate("/settings")}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mx-auto"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}
