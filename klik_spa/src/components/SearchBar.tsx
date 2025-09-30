"use client"

import { useState } from "react"
import { Scan } from "lucide-react"

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

  const getPlaceholder = () => {
    if (isMobile) {
      return "Search menu..."
    }
    return "Search for products, categories, item codes, barcodes, or ingredients..."
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
          className={`flex-1 px-4 py-3 pl-12 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:border-transparent transition-all duration-200 ${
            isFocused ? "shadow-lg" : "shadow-sm"
          }`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <svg
            className="w-5 h-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Scanner Button - Integrated into search bar */}
        {onScanBarcode && (
          <button
            onClick={onScanBarcode}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-beveren-600 dark:hover:text-beveren-400 transition-colors focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:ring-offset-2 rounded-lg"
            title="Scan Barcode"
          >
            <Scan size={20} />
          </button>
        )}

        {/* Clear Button - Only show when there's text and no scanner button */}
        {searchQuery && !onScanBarcode && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
