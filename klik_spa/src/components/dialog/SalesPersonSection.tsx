import { Loader2 } from "lucide-react";

interface SalesPersonSectionProps {
  requiresSalespersonPin: boolean;
  invoiceSubmitted: boolean;
  currentSalesperson: { name: string; salesperson_name: string } | null;
  isLoading: boolean;
  onOpenSalespersonModal: () => void;
}

export default function SalesPersonSection({
  requiresSalespersonPin,
  invoiceSubmitted,
  currentSalesperson,
  isLoading,
  onOpenSalespersonModal,
}: SalesPersonSectionProps) {
  if (!requiresSalespersonPin) {
    return null;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales Person</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-4 space-x-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading salesperson...</span>
        </div>
      ) : currentSalesperson ? (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-beveren-500 to-beveren-700 text-white flex items-center justify-center font-semibold text-sm">
              {currentSalesperson.salesperson_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {currentSalesperson.salesperson_name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{currentSalesperson.name}</div>
            </div>
          </div>
          <button
            onClick={onOpenSalespersonModal}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            No active salesperson for this transaction.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Verify a salesperson before holding or completing payment.
          </p>
          {!invoiceSubmitted && (
            <button
              type="button"
              onClick={onOpenSalespersonModal}
              className="mt-3 rounded-lg bg-beveren-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-beveren-700"
            >
              Verify salesperson
            </button>
          )}
        </div>
      )}
    </div>
  );
}