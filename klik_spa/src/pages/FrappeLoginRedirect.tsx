import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function FrappeLoginRedirect() {
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null;
    const requestedPath = state?.from?.pathname || "/pos";
    const path = requestedPath.startsWith("/klik_pos/")
      ? requestedPath
      : `/klik_pos${requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`}`;
    const target = `${path}${state?.from?.search || ""}${state?.from?.hash || ""}`;

    window.location.replace(`/login?redirect-to=${encodeURIComponent(target)}`);
  }, [location]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to the ERPNext login...</p>
    </div>
  );
}
