import { Award } from "lucide-react";
import type { Customer } from "../../types/customer";
import { formatCurrencyWithSymbol } from "../../utils/currency";

interface CustomerLoyaltySummaryProps {
  customer: Customer | null;
  currencySymbol?: string;
  compact?: boolean;
}

export default function CustomerLoyaltySummary({
  customer,
  currencySymbol = "$",
  compact = false,
}: CustomerLoyaltySummaryProps) {
  const loyalty = customer?.loyalty;

  if (!customer || !loyalty?.enabled || !loyalty.loyalty_program) {
    return null;
  }

  const tier = loyalty.loyalty_program_tier || loyalty.customer_loyalty_program_tier;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
          <Award className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {loyalty.loyalty_program_name || loyalty.loyalty_program}
              </div>
              {tier && (
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  {tier}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {Number(loyalty.loyalty_points || 0).toLocaleString()} pts
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {formatCurrencyWithSymbol(Number(loyalty.redeemable_value || 0), currencySymbol)}
              </div>
            </div>
          </div>
          {!compact && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Available</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Number(loyalty.available_points ?? loyalty.loyalty_points ?? 0).toLocaleString()} pts
                </span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400">Redeemable</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrencyWithSymbol(Number(loyalty.redeemable_value || 0), currencySymbol)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
