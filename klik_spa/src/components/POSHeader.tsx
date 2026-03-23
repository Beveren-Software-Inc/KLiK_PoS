import SearchBar from "./SearchBar";
import ShellUserMenu from "./layout/ShellUserMenu";
import AppIcon from "./ui/AppIcon";
import { useI18n } from "../hooks/useI18n";
import { cn } from "../lib/utils";

interface POSHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchKeyPress?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onScanBarcode?: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export default function POSHeader({
  searchQuery,
  onSearchChange,
  onSearchKeyPress,
  onScanBarcode,
  viewMode,
  onViewModeChange,
}: POSHeaderProps) {
  const { language, isRTL } = useI18n();

  return (
    <header className="relative z-30 border-b border-app-border bg-app-surface/95 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className={cn("flex items-start gap-4", isRTL && "xl:flex-row-reverse")}>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-app-primary text-white shadow-[0_18px_40px_rgba(19,127,236,0.35)]">
            <AppIcon name="print" className="size-6" />
          </div>
          <div className="min-w-0">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {language === "ar" ? "Printhub Cloud" : "Printhub Cloud"}
              </h1>
              <span className="rounded-full border border-app-border bg-app-elevated px-3 py-1 text-xs font-medium text-app-muted">
                {language === "ar" ? "نقطة البيع" : "Point of Sale"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:w-[min(68vw,960px)]">
          <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="min-w-0 flex-1">
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                onSearchKeyPress={onSearchKeyPress}
                onScanBarcode={onScanBarcode}
              />
            </div>

            <div className={cn("flex flex-wrap items-center gap-3", isRTL && "xl:flex-row-reverse")}>
              <ShellUserMenu className="shrink-0" />

              <div className="flex items-center gap-2 rounded-2xl border border-app-border bg-app-elevated p-1.5">
                <button
                  type="button"
                  onClick={() => onViewModeChange("grid")}
                  className={cn(
                    "app-touch-target flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98]",
                    viewMode === "grid"
                      ? "bg-app-primary text-white"
                      : "text-app-muted hover:text-foreground",
                  )}
                >
                  <AppIcon name="grid_view" className="size-[18px]" />
                  <span>{language === "ar" ? "شبكة" : "Grid"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("list")}
                  className={cn(
                    "app-touch-target flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors active:scale-[0.98]",
                    viewMode === "list"
                      ? "bg-app-primary text-white"
                      : "text-app-muted hover:text-foreground",
                  )}
                >
                  <AppIcon name="view_list" className="size-[18px]" />
                  <span>{language === "ar" ? "قائمة" : "List"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
