import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { clearCacheAndReload } from "../../utils/clearCache";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import { usePOSDetails } from "../../hooks/usePOSProfile";
import AppIcon from "../ui/AppIcon";
import { cn } from "../../lib/utils";

interface ShellUserMenuProps {
  className?: string;
}

export default function ShellUserMenu({ className }: ShellUserMenuProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t, tl, isRTL } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { posDetails } = usePOSDetails();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user?.full_name || user?.name || tl("Guest User");
  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2),
    [displayName],
  );

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/klik_pos/login";
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={cn("relative z-40 flex items-center gap-3", isRTL && "flex-row-reverse", className)}
    >
      <div className={cn("text-end", isRTL && "text-start")}>
        <p className="text-sm font-semibold text-foreground">{posDetails?.name || tl("POS Profile")}</p>
        <p className="text-xs text-app-muted">{displayName}</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="app-touch-icon flex size-10 items-center justify-center rounded-2xl bg-app-primary text-sm font-semibold text-white shadow-[0_12px_32px_rgba(19,127,236,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {initials}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-full z-[120] mt-3 w-72 overflow-hidden rounded-[24px] border border-app-border bg-app-surface text-foreground shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
            isRTL ? "left-0" : "right-0",
          )}
        >
          <div className="border-b border-app-border bg-app-elevated px-4 py-4">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-app-primary text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-app-muted">{user?.email || user?.name || tl("No email")}</p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="app-touch-target flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-app-elevated active:scale-[0.99]"
            >
              <AppIcon name="settings" className="size-5 text-app-muted" />
              <span>{t("SETTINGS")}</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setOpen(false);
              }}
              className="app-touch-target flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-app-elevated active:scale-[0.99]"
            >
              <AppIcon
                name={theme === "dark" ? "light_mode" : "dark_mode"}
                className="size-5 text-app-muted"
              />
              <span>{theme === "dark" ? t("LIGHT_MODE") : t("DARK_MODE")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLanguage(language === "en" ? "ar" : "en");
                setOpen(false);
              }}
              className="app-touch-target flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-app-elevated active:scale-[0.99]"
            >
              <AppIcon name="translate" className="size-5 text-app-muted" />
              <span>{language === "en" ? "العربية" : "English"}</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await clearCacheAndReload();
                setOpen(false);
              }}
              className="app-touch-target flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-app-elevated active:scale-[0.99]"
            >
              <AppIcon name="refresh" className="size-5 text-app-muted" />
              <span>{t("CLEAR_CACHE")}</span>
            </button>

            <div className="my-2 border-t border-app-border" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              <AppIcon name="logout" className="size-5" />
              <span>{t("LOGOUT")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
