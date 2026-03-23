import { useNavigate, useLocation } from "react-router-dom"
import { useUserInfo } from "../hooks/useUserInfo"
import { useI18n } from "../hooks/useI18n"
import { APP_NAV_ITEMS, isNavItemActive } from "../config/navigation"
import { cn } from "../lib/utils"
import AppIcon from "./ui/AppIcon"

export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userInfo } = useUserInfo()
  const { language } = useI18n()

  const canAccessSalesDashboard = userInfo?.is_admin_user ?? false

  const menuItems = APP_NAV_ITEMS.filter((item) => !item.adminOnly || canAccessSalesDashboard)

  const handleNav = (item: (typeof menuItems)[number]) => {
    navigate(item.path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-app-border bg-app-surface/95 safe-area-pb backdrop-blur-xl">
      <div className="flex items-center justify-around py-2 px-4">
        {menuItems.map((item, index) => {
          const active = isNavItemActive(location.pathname, item.path)
          return (
          <button
            key={index}
            onClick={() => handleNav(item)}
            title={item.label[language === "ar" ? "ar" : "en"]}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-2 px-1 transition-colors",
              active ? "text-app-primary" : "text-app-muted",
            )}
          >
            <AppIcon name={item.icon} className="mb-1 size-[22px]" />
            <span
              className={cn(
                "text-xs font-medium truncate",
                active ? "text-app-primary" : "text-app-muted",
              )}
            >
              {item.label[language === "ar" ? "ar" : "en"]}
            </span>
          </button>
        )})}
      </div>
    </div>
  )
}
