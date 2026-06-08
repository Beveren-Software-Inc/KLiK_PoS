import { CheckCircle } from "lucide-react";
import type { PaymentMethod } from "./types";

interface PaymentMethodsProps {
  paymentMethods: PaymentMethod[];
  invoiceSubmitted: boolean;
  isProcessingPayment: boolean;
  onAmountChange: (methodId: string, amount: string) => void;
  onAutoFill: (methodId: string) => void;
  setActiveMethodId: (id: string | null) => void;
}

export default function PaymentMethods({
  paymentMethods,
  invoiceSubmitted,
  isProcessingPayment,
  onAmountChange,
  onAutoFill,
  setActiveMethodId,
}: PaymentMethodsProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className={`${paymentMethods.length <= 3 ? "flex-1 min-w-0" : "min-w-[300px] flex-shrink-0"} border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-beveren-300 transition-colors ${invoiceSubmitted || isProcessingPayment ? "bg-gray-50 dark:bg-gray-800" : ""}`}
          >
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-8 h-6 rounded-md ${method.color} text-white flex items-center justify-center`}>
                <div className="scale-75">{method.icon}</div>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{method.name}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Amount</label>
                <div className="flex space-x-1">
                  <button
                    onClick={() => onAutoFill(method.id)}
                    disabled={invoiceSubmitted || isProcessingPayment}
                    className={`p-1 rounded text-xs ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : "hover:bg-beveren-100 text-beveren-600"}`}
                    title="Auto-fill with grand total"
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={method.amount || ""}
                onChange={(e) => {
                  setActiveMethodId(method.id);
                  const inputValue = e.target.value;
                  const numValue = inputValue === "" ? 0 : parseFloat(inputValue);
                  onAmountChange(method.id, isNaN(numValue) ? "0" : numValue.toString());
                }}
                onBlur={(e) => {
                  setActiveMethodId(method.id);
                  const numValue = parseFloat(e.target.value);
                  if (!isNaN(numValue)) {
                    onAmountChange(method.id, parseFloat(numValue.toFixed(2)).toString());
                  }
                }}
                placeholder="0.00"
                disabled={invoiceSubmitted || isProcessingPayment}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${invoiceSubmitted || isProcessingPayment ? "cursor-not-allowed opacity-50" : ""}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}