import { formatCurrencyWithSymbol } from "../../utils/currency";
import type { BackendTaxPreview, Calculations } from "./types";

interface TaxSectionProps {
  selectedCustomer: any;
  invoiceSubmitted: boolean;
  isProcessingPayment: boolean;
  taxPin: string;
  onTaxPinChange: (pin: string) => void;
  calculations: Calculations;
  displayCurrencySymbol: string;
  backendTaxPreview: BackendTaxPreview | null;
  isTaxPreviewLoading: boolean;
  taxPreviewError: string | null;
}

export default function TaxSection({
  selectedCustomer,
  invoiceSubmitted,
  isProcessingPayment,
  taxPin,
  onTaxPinChange,
  calculations,
  displayCurrencySymbol,
  backendTaxPreview,
  isTaxPreviewLoading,
  taxPreviewError,
}: TaxSectionProps) {
  const hasBackendPreview = backendTaxPreview !== null;
  const backendTaxLines = backendTaxPreview?.tax_breakdown || [];
  const hasBackendBreakdown = backendTaxLines.length > 0;
  const isIncluded = hasBackendBreakdown
    ? backendTaxLines.some((line) => Number(line.included_in_print_rate) === 1)
    : calculations.isInclusive;
  const taxTotal = hasBackendPreview
    ? backendTaxPreview?.total_taxes_and_charges || 0
    : calculations.taxAmount;

  return (
    <div>
      <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tax Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch">
        <div className="min-w-0 h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 flex flex-col">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {invoiceSubmitted ? "Customer Tax ID" : "Customer Tax ID (optional)"}
          </label>
          {selectedCustomer?.isWalkin === 1 ? (
            <input
              type="text"
              value={taxPin}
              onChange={(e) => onTaxPinChange(e.target.value.toUpperCase())}
              onBlur={() => onTaxPinChange(taxPin.trim().toUpperCase())}
              placeholder="A123456789P"
              disabled={invoiceSubmitted || isProcessingPayment}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white uppercase tracking-widest ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}
            />
          ) : (
            <div className="flex-1 flex items-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Available for walk-in customers only.</p>
            </div>
          )}
        </div>
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sales & Tax Charges</label>
          <select
            value={selectedSalesTaxCharges}
            onChange={(e) => onTaxChange(e.target.value)}
            disabled={invoiceSubmitted || isProcessingPayment}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {salesTaxCharges.map((tax) => (
              <option key={tax.id} value={tax.id}>
                {tax.name} ({tax.rate}% {tax.is_inclusive ? "Incl." : "Excl."})
              </option>
            ))}
          </select>
        </div> */}
        <div className="min-w-0 h-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 flex flex-col">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax Amount {isIncluded && "(Included)"}
          </label>
          <div
            className={`px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg font-medium ${isIncluded ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}
          >
            {isIncluded
              ? `(${formatCurrencyWithSymbol(taxTotal, displayCurrencySymbol)})`
              : formatCurrencyWithSymbol(taxTotal, displayCurrencySymbol)}
          </div>
          {isTaxPreviewLoading && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Refreshing tax preview...</p>
          )}
          {!isTaxPreviewLoading && taxPreviewError && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{taxPreviewError}</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
