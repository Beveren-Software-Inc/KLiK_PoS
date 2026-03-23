import type { ReactNode } from "react";
import { useI18n } from "../../hooks/useI18n";
import { cn } from "../../lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  light?: boolean;
}

export default function PageHeader({
  title,
  description,
  actions,
  leading,
  trailing,
  className,
  light = false,
}: PageHeaderProps) {
  const { isRTL } = useI18n();

  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b px-4 py-4 backdrop-blur-xl sm:px-6",
        light
          ? "border-app-light-border bg-white/95 text-slate-900"
          : "border-app-border bg-app-surface/95 text-foreground",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={cn("flex min-w-0 items-center gap-3", isRTL && "flex-row-reverse")}>
          {leading}
          <div className="min-w-0">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <h1 className={cn("text-xl font-bold tracking-tight sm:text-2xl", light ? "text-slate-900" : "text-foreground")}>
                {title}
              </h1>
              {trailing}
            </div>
            {description ? (
              <p className={cn("mt-1 text-sm", light ? "text-app-light-muted" : "text-app-muted")}>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
