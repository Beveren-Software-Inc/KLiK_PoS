import { Loader2, Search } from "lucide-react";
import type { MpesaRegisterPayment } from "../../services/mpesa";
import { formatCurrencyWithSymbol } from "../../utils/currency";

interface MpesaOptionsModalProps {
  isOpen: boolean;
  modeOfPayment: string;
  amount: number;
  phoneNumber: string;
  currencySymbol: string;
  searchTerm: string;
  payments: MpesaRegisterPayment[];
  pendingCount: number;
  selectedPaymentNames: string[];
  selectedTotal: number;
  mergePayments: boolean;
  isLoadingPayments: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onPhoneNumberChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onTogglePayment: (paymentName: string) => void;
  onToggleMergePayments: (checked: boolean) => void;
  onInitiateStk: () => void;
  onAddPayments: () => void;
}

export default function MpesaOptionsModal({
  isOpen,
  modeOfPayment,
  amount,
  phoneNumber,
  currencySymbol,
  searchTerm,
  payments,
  pendingCount,
  selectedPaymentNames,
  selectedTotal,
  mergePayments,
  isLoadingPayments,
  isProcessing,
  onClose,
  onPhoneNumberChange,
  onSearchChange,
  onTogglePayment,
  onToggleMergePayments,
  onInitiateStk,
  onAddPayments,
}: MpesaOptionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">M-Pesa Payment Options</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {modeOfPayment} • Expected amount {formatCurrencyWithSymbol(amount, currencySymbol)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
            <div>
              <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">Initiate STK Push</h3>
              <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
                Send a payment request to any phone number, not just the customer default.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(event) => onPhoneNumberChange(event.target.value)}
                placeholder="0712345678 or 254712345678"
                disabled={isProcessing}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={onInitiateStk}
              disabled={isProcessing}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Send STK Push</span>
            </button>
          </section>

          <section className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Reconcile Received C2B Payments</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pending register entries: {pendingCount}. Search by sender, transaction ID, or reference.
              </p>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Type at least 3 characters"
                disabled={isProcessing}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingPayments ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading M-Pesa payments...</span>
                </div>
              ) : searchTerm.trim().length < 3 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Enter at least 3 characters to search register payments.
                </div>
              ) : payments.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  No pending payments matched your search.
                </div>
              ) : (
                payments.map((payment) => {
                  const checked = selectedPaymentNames.includes(payment.name);
                  return (
                    <label
                      key={payment.name}
                      className={`flex items-start gap-3 p-3 cursor-pointer ${checked ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-white dark:bg-gray-900"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onTogglePayment(payment.name)}
                        disabled={isProcessing}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {payment.full_name || payment.name}
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrencyWithSymbol(Number(payment.transamount || 0), currencySymbol)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                          <div>{payment.transid || payment.name}</div>
                          <div>{payment.msisdn || payment.billrefnumber || "No phone/reference"}</div>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={mergePayments}
                onChange={(event) => onToggleMergePayments(event.target.checked)}
                disabled={isProcessing}
              />
              <span>Merge selected payments into one row</span>
            </label>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Selected total</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrencyWithSymbol(selectedTotal, currencySymbol)}
              </span>
            </div>

            <button
              type="button"
              onClick={onAddPayments}
              disabled={isProcessing || selectedPaymentNames.length === 0}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Add Selected Payments</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}