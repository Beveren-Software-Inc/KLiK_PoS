import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Footer from "../Footer";
import { useI18n } from "../../hooks/useI18n";
import { cn } from "../../lib/utils";

const HIDDEN_SHELL_PATHS = ["/login"];

export default function AppLayout() {
  const location = useLocation();
  const { isRTL } = useI18n();

  const hideShell =
    location.pathname === "/" ||
    HIDDEN_SHELL_PATHS.some((path) => location.pathname.startsWith(path));

  return (
    <div className={cn("min-h-screen font-sans", hideShell ? "bg-app-bg" : "app-shell")}>
      {!hideShell && <AppSidebar />}
      <div
        className={cn(
          "min-h-screen",
          !hideShell && (isRTL ? "lg:pr-20" : "lg:pl-20"),
        )}
      >
        <Outlet />
      </div>
      {!hideShell && <Footer />}
    </div>
  );
}
