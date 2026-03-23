import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-app-border bg-app-elevated/80 text-foreground",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  accent: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
};

// eslint-disable-next-line react-refresh/only-export-components
export function getStatusTone(status?: string): StatusTone {
  const normalized = status?.trim().toLowerCase() || "";

  if (["paid", "completed", "ready", "reported", "cleared", "active"].includes(normalized)) {
    return "success";
  }

  if (["pending", "partly paid", "unpaid", "draft", "low stock"].includes(normalized)) {
    return "warning";
  }

  if (["overdue", "cancelled", "not cleared", "out of stock", "error"].includes(normalized)) {
    return "danger";
  }

  if (["return", "refunded"].includes(normalized)) {
    return "accent";
  }

  if (["not reported", "reported", "review"].includes(normalized)) {
    return "info";
  }

  return "neutral";
}

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

export default function StatusBadge({
  children,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
