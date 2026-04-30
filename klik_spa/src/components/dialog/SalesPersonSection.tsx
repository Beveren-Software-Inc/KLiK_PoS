import { Loader2, Check } from "lucide-react";

interface SalesPersonSectionProps {
  requiresSalespersonPin: boolean;
  invoiceSubmitted: boolean;
  currentSalesperson: { name: string; salesperson_name: string } | null;
  isVerifyingPin: boolean;
  salespersonPin: string;
  salespersonPinError: string;
  rememberSalesperson: boolean;
  onPinChange: (pin: string) => void;
  onVerifyPin: () => void;
  onClearSalesperson: () => void;
  onRememberChange: (checked: boolean) => void;
}

export default function SalesPersonSection({
  requiresSalespersonPin,
  invoiceSubmitted,
  currentSalesperson,
  isVerifyingPin,
  salespersonPin,
  salespersonPinError,
  rememberSalesperson,
  onPinChange,
  onVerifyPin,
  onClearSalesperson,
  onRememberChange,
}: SalesPersonSectionProps) {
  if (!requiresSalespersonPin || invoiceSubmitted) {
    if (currentSalesperson) {
      return (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">Sales Person</p>
          <div className="flex items-center justify-between bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-2">
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
            {!invoiceSubmitted && (
              <button
                onClick={onClearSalesperson}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Change
              </button>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales Person</h3>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberSalesperson}
            onChange={(e) => onRememberChange(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">Remember</span>
        </label>
      </div>
      {isVerifyingPin ? (
        <div className="flex items-center justify-center py-4 space-x-2 text-gray-500">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Verifying...</span>
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
            onClick={onClearSalesperson}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter Your 4-Digit PIN</label>
          <div className="flex space-x-2">
            <input
              type="password"
              value={salespersonPin}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && onVerifyPin()}
              maxLength={4}
              placeholder="••••"
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-xl tracking-widest"
            />
            <button
              onClick={onVerifyPin}
              disabled={isVerifyingPin}
              className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              <Check size={16} />
              <span>Verify</span>
            </button>
          </div>
          {salespersonPinError && (
            <p className="text-sm text-red-600 dark:text-red-400 border-l-2 border-red-500 pl-2 mt-1">
              {salespersonPinError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}