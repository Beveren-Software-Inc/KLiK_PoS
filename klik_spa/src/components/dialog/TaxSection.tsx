import { formatCurrencyWithSymbol } from "../../utils/currency";
import type { BackendTaxPreview, Calculations } from "./types";

interface TaxSectionProps {
  selectedCustomer: any;
  invoiceSubmitted: boolean;
  isProcessingPayment: boolean;
  taxPin: string;
  onTaxPinChange: (pin: string) => void;
  selectedSalesTaxCharges: string;
  onTaxChange: (value: string) => void;
  salesTaxCharges: any[];
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
  selectedSalesTaxCharges,
  onTaxChange,
  salesTaxCharges,
  calculations,
  displayCurrencySymbol,
  backendTaxPreview,
  isTaxPreviewLoading,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          {selectedCustomer?.is_walkin === 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {invoiceSubmitted ? "Customer Tax ID" : "Customer Tax ID (optional)"}
              </label>
              <input
                type="text"
                value={taxPin}
                onChange={(e) => onTaxPinChange(e.target.value.toUpperCase())}
                onBlur={() => onTaxPinChange(taxPin.trim().toUpperCase())}
                placeholder="A123456789P"
                disabled={invoiceSubmitted || isProcessingPayment}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase tracking-widest ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}
              />
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
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax Amount {isIncluded && "(Included)"}
          </label>
          <div
            className={`px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-medium ${isIncluded ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}
          >
            {isIncluded
              ? `(${formatCurrencyWithSymbol(taxTotal, displayCurrencySymbol)})`
              : formatCurrencyWithSymbol(taxTotal, displayCurrencySymbol)}
          </div>
          
        </div> */}
      </div>
      </div>
    </div>
  );
}