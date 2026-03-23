"use client"

import { useState } from "react"
import { Scan, Search as SearchIcon } from "lucide-react"
import { useI18n } from "../hooks/useI18n"
import { cn } from "../lib/utils"

interface SearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onScanBarcode?: () => void
  onSearchKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  isMobile?: boolean
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  onScanBarcode,
  onSearchKeyPress,
  isMobile = false
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const { isRTL, tl } = useI18n()

  const getPlaceholder = () => {
    if (isMobile) {
      return tl("Search menu...")
    }
    return tl("Search by product, category, item code, barcode, batch or serial...")
  }

  return (
    <div className={`relative ${isMobile ? "w-full" : "w-full max-w-3xl"}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={onSearchKeyPress}
          placeholder={getPlaceholder()}
          className={cn(
            "app-input flex-1 rounded-2xl py-3 text-sm shadow-[0_20px_40px_rgba(3,14,31,0.24)] transition-all duration-200 sm:text-base",
            isRTL ? "pr-12 pl-16 text-right" : "pl-12 pr-16 text-left",
            isFocused ? "shadow-lg" : "shadow-sm"
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 text-app-muted",
            isRTL ? "right-4" : "left-4",
          )}
        >
          <SearchIcon className="h-5 w-5" />
        </div>

        {/* Scanner Button - Integrated into search bar */}
        {onScanBarcode && (
          <button
            onClick={onScanBarcode}
            className={cn(
              "app-touch-icon absolute top-1/2 -translate-y-1/2 rounded-xl p-2 text-app-muted transition-colors hover:bg-app-elevated hover:text-foreground focus:outline-none focus:ring-2 focus:ring-app-primary active:scale-[0.98]",
              isRTL ? "left-3" : "right-3",
            )}
            title={tl("Scan Barcode")}
          >
            <Scan size={20} />
          </button>
        )}

        {/* Clear Button - Only show when there's text and no scanner button */}
        {searchQuery && !onScanBarcode && (
          <button
            onClick={() => onSearchChange("")}
            className={cn(
              "app-touch-icon absolute top-1/2 -translate-y-1/2 rounded-lg p-1 text-app-muted transition-colors hover:text-foreground active:scale-[0.98]",
              isRTL ? "left-4" : "right-4",
            )}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
