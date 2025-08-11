
"use client";

import { itemGroupIconMap } from "../utils/iconMap";
import { useI18n } from "../hooks/useI18n";
import { useItemGroups } from "../hooks/useItemGroups";

interface CategoryTabsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isMobile?: boolean;
}

export default function CategoryTabs({
  selectedCategory,
  onCategoryChange,
  isMobile = false,
}: CategoryTabsProps) {
  const { isRTL } = useI18n();

 const {
  itemGroups,
  isLoading: isValidating,
  error,
  count,
  total_item_count,
} = useItemGroups();


  if (isValidating) return <div>Loading categories...</div>;

  if (error) {
    console.error("❌ Error fetching item groups:", error);

    return (
      <div className="text-red-600">
        <p>Error loading categories:</p>
        <pre className="text-xs bg-red-100 p-2 rounded">{error}</pre>
      </div>
    );
  }

  if (!itemGroups || itemGroups.length === 0) {
    return <div>No item groups found.</div>;
  }

  const categories = [
    {
      id: "all",
      name: "All Menu",
      icon: itemGroupIconMap["All Menu"] ?? "📦",
      count: total_item_count
    },
    ...itemGroups.map((group) => ({
      id: group.id,
      name: group.name,
      icon: itemGroupIconMap[group.name] ?? "📦",
      count: group.count ?? 1,
    })),
  ];

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
            <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>
              {category.name}
            </span>
            <span className={`${isMobile ? "text-xs" : "text-xs"} opacity-75`}>
              {category.count} Item{category.count !== 1 ? "s" : ""}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

