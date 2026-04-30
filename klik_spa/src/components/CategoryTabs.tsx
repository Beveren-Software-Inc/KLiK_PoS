"use client";

import { useProductStore } from "../stores/productStore";

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
  const itemGroups = useProductStore((state) => state.itemGroups);
  const isLoading = useProductStore((state) => state.isLoading);
  const isSearching = useProductStore((state) => state.isSearching);
  const searchProducts = useProductStore((state) => state.searchProducts);
  const searchQuery = useProductStore((state) => state.searchQuery);

  const isValidating = isLoading && !isSearching;

  if (isValidating) {
    return (
      <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-hide">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse min-w-[80px]"
          />
        ))}
      </div>
    );
  }

  const allItemsCount = itemGroups.reduce((sum, group) => sum + (group.total_count || group.count || 0), 0);

  const categories = [
    {
      id: "all",
      name: "All Items",
      count: allItemsCount,
    },
    ...itemGroups.map((group) => ({
      id: group.id,
      name: group.name,
      count: group.total_count || group.count || 0,
    })),
  ];

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    if (searchQuery) {
      searchProducts(searchQuery);
    }
  };

  if (categories.length === 1 && categories[0].id === "all" && categories[0].count === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No categories available
      </div>
    );
  }

  return (
    <div className="flex space-x-2 overflow-x-auto py-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category.id)}
          className={`flex items-center justify-center px-3 py-2 rounded-xl whitespace-nowrap transition-all duration-200 flex-shrink-0 min-w-fit ${
            selectedCategory === category.id
              ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-700 dark:text-beveren-300 border border-beveren-200 dark:border-beveren-800 shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="flex flex-col items-center">
            <span className={`font-semibold ${isMobile ? "text-xs" : "text-sm"}`}>
              {category.name}
            </span>
            <span className={`${isMobile ? "text-xs" : "text-xs"} font-medium opacity-70`}>
              {category.count} Item{category.count !== 1 ? "s" : ""}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}