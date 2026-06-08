import { Receipt, Grid3X3, BarChart3, Users, MonitorX, Banknote } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { useUserInfo } from "../hooks/useUserInfo"
import { usePOSProfileStore } from "../stores/posProfileStore";

// Inside your component
export default function RetailSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userInfo } = useUserInfo()
  const {posDetails} = usePOSProfileStore()

  const canAccessSalesDashboard = userInfo?.is_admin_user ?? false

  const menuItems = [
    { icon: Grid3X3, path: "/pos", label: "POS" },
     { icon: Receipt, path: "/invoice", label: "InvoiceHistory" },
     { icon: Banknote, path: "/payments", label: "Payments" },
     { icon: Users, path: "/customers", label: "Customers", requiresEditCreatePermission: true },
    { icon: BarChart3, path: "/dashboard", label: "Dashboard", requiresSalesDashboard: true },
    { icon: MonitorX, path: "/closing_shift", label: "Closing Shift" },

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

  if (!posDetails) return (
    <div className="hidden lg:flex fixed h-screen w-20 top-0 left-0 bg-white dark:bg-gray-800 shadow-lg flex-col border-r border-gray-200 dark:border-gray-700 z-50">
      <div
          className="h-20 flex items-center justify-center border-gray-100 dark:border-gray-700 cursor-pointer active:scale-90 transition-transform duration-150"
          onClick={() => navigate("/")}
        >
          <img
            src="/assets/klik_pos/klik_spa/bev_logo.jpeg"
            alt="KLiK PoS"
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>
    </div>
  )

  return (
<div className="hidden lg:flex fixed h-screen w-20 top-0 left-0 bg-white dark:bg-gray-800 shadow-lg flex-col border-r border-gray-200 dark:border-gray-700 z-50">
      {/* Logo Section - Fixed height to match other sections */}
      <div
          className="h-20 flex items-center justify-center border-gray-100 dark:border-gray-700 cursor-pointer active:scale-90 transition-transform duration-150"
          onClick={() => navigate("/")}
        >
          <img
            src="/assets/klik_pos/klik_spa/bev_logo.jpeg"
            alt="KLiK PoS"
            className="w-12 h-12 rounded-full object-cover"
          />
        </div>

      {/* Menu Items - Flexible space */}
      <div className="flex-1 flex flex-col items-center py-6 space-y-4">
        {menuItems.map((item, index) => {
          const disabled = item.requiresSalesDashboard && !canAccessSalesDashboard
          if (item.requiresEditCreatePermission && posDetails?.custom_allow_to_create_and_edit_customers !== 1) {
            return null; // Don't render this menu item if the user doesn't have permission
           }
           
          return (
          <button
            key={index}
            onClick={() => handleNav(item)}
            disabled={disabled}
            title={disabled ? "Sales Dashboard (Sales Manager, System Manager or Administrator only)" : item.label}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 ${
              disabled
                ? "opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600"
                : "cursor-pointer active:scale-90 " + (
              isActive(item.path)
                ? "bg-beveren-100 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                : "text-beveren-600 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            )
            }`}
          >
            <item.icon size={20} />
          </button>
        )})}
      </div>

      {/* Settings at bottom */}
      {/* <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => navigate("/settings")}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mx-auto"
        >
          <Settings size={20} />
        </button>
      </div> */}
    </div>
  )
}
