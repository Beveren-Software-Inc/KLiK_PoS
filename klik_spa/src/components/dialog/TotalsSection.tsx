import { formatCurrencyWithSymbol } from "../../utils/currency";
import { subtractCurrency } from "../../utils/currencyMath";
import type { BackendTaxPreview, Calculations } from "./types";

interface TotalsSectionProps {
  calculations: Calculations;
  displaySubtotal: number;
  displayTaxTotal: number;
  displayTaxIsIncluded: boolean;
  checkoutGrandTotal: number;
  loyaltyAmount?: number;
  checkoutPayableTotal?: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  displayCurrencySymbol: string;
  isB2B: boolean;
  backendTaxPreview: BackendTaxPreview | null;
}

export default function TotalsSection({
  calculations,
  displaySubtotal,
  displayTaxTotal,
  displayTaxIsIncluded,
  checkoutGrandTotal,
  loyaltyAmount = 0,
  checkoutPayableTotal,
  totalPaidAmount,
  outstandingAmount,
  displayCurrencySymbol,
  isB2B,
  backendTaxPreview,
}: TotalsSectionProps) {
  const backendTaxLines = backendTaxPreview?.tax_breakdown || [];
  const hasBackendTaxBreakdown = backendTaxLines.length > 0;
  const amountDue = checkoutPayableTotal ?? checkoutGrandTotal;
  const changeDue = totalPaidAmount > amountDue ? subtractCurrency(totalPaidAmount, amountDue) : 0;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {isB2B ? "Invoice Summary" : "Payment Summary"}
      </h3>
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(displaySubtotal, displayCurrencySymbol)}
              </span>
            </div>
            {calculations.couponDiscount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>Coupon Discount</span>
                <span>-{formatCurrencyWithSymbol(calculations.couponDiscount, displayCurrencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {calculations.selectedTax
                  ? `Tax (${calculations.selectedTax.rate}% ${displayTaxIsIncluded ? "Incl." : "Excl."})`
                  : `Tax ${displayTaxIsIncluded ? "(Incl.)" : ""}`}
              </span>
              <span className={`font-medium ${displayTaxIsIncluded ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                {displayTaxIsIncluded
                  ? `(${formatCurrencyWithSymbol(displayTaxTotal, displayCurrencySymbol)})`
                  : formatCurrencyWithSymbol(displayTaxTotal, displayCurrencySymbol)}
              </span>
            </div>
            {hasBackendTaxBreakdown && (
              <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 space-y-1 text-xs">
                {backendTaxLines.map((line, index) => (
                  <div key={`${line.account_head || line.description || "tax"}-${index}`} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{line.description || line.account_head || "Tax"}</span>
                    <span className="text-gray-900 dark:text-white">
                      {Number(line.included_in_print_rate) === 1
                        ? `(${formatCurrencyWithSymbol(Number(line.tax_amount) || 0, displayCurrencySymbol)})`
                        : formatCurrencyWithSymbol(Number(line.tax_amount) || 0, displayCurrencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 md:border-l md:border-gray-200 md:dark:border-gray-600 md:pl-6">
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 md:border-t-0 md:pt-0">
              <div className="flex justify-between">
                <span className="text-xl font-bold text-gray-900 dark:text-white">Grand Total</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrencyWithSymbol(checkoutGrandTotal, displayCurrencySymbol)}
                </span>
              </div>
            </div>
            {loyaltyAmount > 0 && (
              <>
                <div className="flex justify-between text-amber-700 dark:text-amber-300">
                  <span>Loyalty Redeemed</span>
                  <span className="font-medium">-{formatCurrencyWithSymbol(loyaltyAmount, displayCurrencySymbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Amount Due</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrencyWithSymbol(amountDue, displayCurrencySymbol)}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cash Received</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {formatCurrencyWithSymbol(totalPaidAmount, displayCurrencySymbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Change Due</span>
              <span className={`font-bold ${changeDue > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-white"}`}>
                {formatCurrencyWithSymbol(changeDue, displayCurrencySymbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Outstanding Amount</span>
              <span className={`font-bold ${outstandingAmount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {formatCurrencyWithSymbol(outstandingAmount, displayCurrencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
