import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../hooks/useI18n";
import { useUserInfo } from "../../hooks/useUserInfo";
import { cn } from "../../lib/utils";
import { APP_NAV_ITEMS, isNavItemActive } from "../../config/navigation";
import AppIcon from "../ui/AppIcon";

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, isRTL, tl } = useI18n();
  const { userInfo } = useUserInfo();

  const canAccessDashboard = userInfo?.is_admin_user ?? false;

  const navItems = APP_NAV_ITEMS.filter((item) => !item.adminOnly || canAccessDashboard);

  return (
    <aside
      className={cn(
        "group/sidebar fixed inset-y-0 z-40 hidden lg:flex w-20 hover:w-64 flex-col overflow-hidden border-app-border bg-app-surface/95 backdrop-blur-xl transition-[width] duration-300",
        isRTL ? "right-0 border-l" : "left-0 border-r",
      )}
    >
      <button
        type="button"
        onClick={() => navigate("/pos")}
        className="flex h-20 items-center gap-3 border-b border-app-border px-5 text-start transition-colors hover:bg-app-elevated/80"
      >
        <img
          src="/assets/klik_pos/klik_spa/bev_logo.jpeg"
          alt="KLiK PoS"
          className="size-11 rounded-2xl object-cover shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
        />
        <div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
          <p className="truncate text-sm font-semibold text-foreground">KLiK PoS</p>
          <p className="truncate text-xs text-app-muted">{tl("Printhub Cloud UI")}</p>
        </div>
      </button>

      <nav className="flex-1 px-3 py-5">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active = isNavItemActive(location.pathname, item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-4 rounded-2xl px-4 py-3 text-start transition-all duration-200",
                  active
                    ? "bg-app-primary/15 text-app-primary shadow-[0_12px_32px_rgba(19,127,236,0.2)]"
                    : "text-app-muted hover:bg-app-elevated hover:text-foreground",
                )}
                title={item.label[language === "ar" ? "ar" : "en"]}
              >
                <AppIcon name={item.icon} className="size-6 shrink-0" />
                <span className="min-w-0 overflow-hidden text-sm font-medium opacity-0 transition-all duration-200 group-hover/sidebar:opacity-100">
                  {item.label[language === "ar" ? "ar" : "en"]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-app-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-app-elevated px-3 py-3">
          <AppIcon name="storefront" className="size-5 text-app-primary" />
          <div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            <p className="truncate text-xs font-medium text-foreground">
              {userInfo?.pos_profile_name || userInfo?.pos_profile || tl("POS Profile")}
            </p>
            <p className="truncate text-[11px] text-app-muted">
              {userInfo?.full_name || userInfo?.user || tl("Guest User")}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
