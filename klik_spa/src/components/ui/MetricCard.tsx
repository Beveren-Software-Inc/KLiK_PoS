import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface MetricCardProps {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  light?: boolean;
}

export default function MetricCard({
  title,
  value,
  hint,
  icon,
  className,
  light = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:p-6",
        light
          ? "border-app-light-border bg-white"
          : "border-app-border bg-app-surface",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", light ? "text-app-light-muted" : "text-app-muted")}>
            {title}
          </p>
          <div className={cn("mt-3 text-2xl font-bold tracking-tight", light ? "text-slate-900" : "text-foreground")}>
            {value}
          </div>
          {hint ? (
            <div className={cn("mt-3 text-sm", light ? "text-app-light-muted" : "text-app-muted")}>
              {hint}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl",
              light ? "bg-slate-100 text-app-primary" : "bg-app-elevated text-app-primary",
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
