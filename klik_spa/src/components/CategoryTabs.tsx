"use client"

import { useI18n } from "../hooks/useI18n"
import { categories } from "../data/mockData"

interface CategoryTabsProps {
  selectedCategory: string
  onCategoryChange: (category: string) => void
  isMobile?: boolean
}

export default function CategoryTabs({ selectedCategory, onCategoryChange, isMobile = false }: CategoryTabsProps) {
  const { isRTL } = useI18n()

  return (
    <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all duration-200 flex-shrink-0 min-w-fit ${
            selectedCategory === category.id
              ? "bg-beveren-600 text-white shadow-md"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          <span className={`${isMobile ? "text-sm" : "text-base"}`}>{category.icon}</span>
          <div className="flex flex-col items-start">
            <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{category.name}</span>
            <span className={`${isMobile ? "text-xs" : "text-xs"} opacity-75`}>
              {category.count} Item{category.count !== 1 ? "s" : ""}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
