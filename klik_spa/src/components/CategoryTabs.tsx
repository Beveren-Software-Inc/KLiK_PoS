
"use client";

import { itemGroupIconMap } from "../utils/iconMap";
import { useItemGroups } from "../hooks/useItemGroups";
import { useI18n } from "../hooks/useI18n";
import { cn } from "../lib/utils";

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
  const { language, isRTL } = useI18n();

 const {
  itemGroups,
  isLoading: isValidating,
  error,
  total_item_count,
} = useItemGroups();


  if (isValidating) {
    return <div className="px-1 py-2 text-sm text-app-muted">{language === "ar" ? "جار تحميل الفئات..." : "Loading categories..."}</div>;
  }

  if (error) {
    console.error("❌ Error fetching item groups:", error);

    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
        <p>{language === "ar" ? "تعذر تحميل الفئات:" : "Error loading categories:"}</p>
        <pre className="mt-2 overflow-auto rounded-xl bg-rose-950/20 p-2 text-xs">{error}</pre>
      </div>
    );
  }

  if (!itemGroups || itemGroups.length === 0) {
    return <div className="px-1 py-2 text-sm text-app-muted">{language === "ar" ? "لا توجد مجموعات أصناف." : "No item groups found."}</div>;
  }

  const categories = [
    {
      id: "all",
      name: language === "ar" ? "كل الأصناف" : "All Items",
      icon: itemGroupIconMap["All Items"] ?? "📦",
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
    <div
      className={cn(
        "flex gap-2 overflow-x-auto py-2 [scrollbar-width:none]",
        isRTL && "justify-start",
      )}
    >
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            "flex min-w-fit flex-shrink-0 items-center justify-center rounded-2xl border px-4 py-3 whitespace-nowrap transition-all duration-200",
            selectedCategory === category.id
              ? "border-app-primary/30 bg-app-primary/15 text-app-primary shadow-[0_18px_35px_rgba(19,127,236,0.2)]"
              : "border-app-border bg-app-elevated text-app-muted hover:bg-app-surface hover:text-foreground"
          )}
        >
          <div className="flex flex-col items-center">
            <span className="mb-1 text-xl leading-none">{category.icon}</span>
            <span className={`font-semibold ${isMobile ? "text-xs" : "text-sm"}`}>
              {category.name}
            </span>
            <span className={`${isMobile ? "text-xs" : "text-xs"} font-medium opacity-70`}>
              {category.count} {language === "ar" ? "صنف" : `Item${category.count !== 1 ? "s" : ""}`}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
