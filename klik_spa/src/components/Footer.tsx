"use client"

import { useLocation } from "react-router-dom"
import ConnectionStatus from "./ConnectionStatus"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { useI18n } from "../hooks/useI18n"
import { cn } from "../lib/utils"

export default function Footer() {
  // Hide footer on mobile/tablet screens (same breakpoint as mobile layout)
  const isMobile = useMediaQuery("(max-width: 1024px)")
  const location = useLocation()
  const { isRTL, tl } = useI18n()
  const showConnectionStatus = location.pathname.startsWith("/pos")

  // Don't render footer on mobile devices
  if (isMobile) {
    return null
  }

  return (
    <footer
      className={cn(
        "fixed bottom-0 z-20 border-t border-app-border bg-app-surface/95 backdrop-blur-xl",
        isRTL ? "left-0 right-20" : "left-20 right-0",
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 py-2">
        <div className={cn("flex min-w-0 items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="shrink-0 text-sm font-bold text-app-primary">
            KLiK PoS
          </div>
          {showConnectionStatus ? (
            <ConnectionStatus className="min-w-0 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1.5 text-xs" />
          ) : null}
        </div>

        <div className="shrink-0 text-xs text-app-muted">
          © {new Date().getFullYear()} {tl("Powered by")}{" "}
          <a
            href="https://beverensoftware.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold hover:underline text-app-primary"
          >
            Beveren Software
          </a>
        </div>
      </div>
    </footer>
  )
}
