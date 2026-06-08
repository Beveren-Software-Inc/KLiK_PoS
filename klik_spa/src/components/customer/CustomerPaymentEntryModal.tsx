import { useEffect, useMemo, useState } from "react";
import { Banknote, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import type { Customer } from "../../types/customer";
import { usePaymentModes } from "../../hooks/usePaymentModes";
import { usePOSProfileStore } from "../../stores/posProfileStore";
import { createCustomerPaymentEntry } from "../../services/paymentEntry";
import { formatCurrencyWithSymbol } from "../../utils/currency";
import { extractErrorFromException } from "../../utils/errorExtraction";

interface CustomerPaymentEntryModalProps {
  customer: Customer;
  salesInvoiceName?: string;
  outstandingAmount?: number;
  defaultAmount?: number;
  invoiceCurrency?: string;
  onClose: () => void;
  onCreated?: (paymentEntryName: string) => void;
}

export default function CustomerPaymentEntryModal({
  customer,
  salesInvoiceName,
  outstandingAmount,
  defaultAmount,
  invoiceCurrency,
  onClose,
  onCreated,
}: CustomerPaymentEntryModalProps) {
  const { posDetails, currencySymbol } = usePOSProfileStore();
  const posProfileName = posDetails?.name || "";
  const { modes, isLoading, error } = usePaymentModes(posProfileName);
  const defaultMode = useMemo(
    () => modes.find((mode) => mode.default === 1)?.mode_of_payment || modes[0]?.mode_of_payment || "",
    [modes]
  );

  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!modeOfPayment && defaultMode) {
      setModeOfPayment(defaultMode);
    }
  }, [defaultMode, modeOfPayment]);

  const numericAmount = Number(amount);
  const exceedsOutstanding = Boolean(
    salesInvoiceName && outstandingAmount !== undefined && numericAmount > Number(outstandingAmount) + 0.00001
  );
  const canSubmit = numericAmount > 0 && Boolean(modeOfPayment) && !exceedsOutstanding && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const result = await createCustomerPaymentEntry({
        customer: customer.id,
        amount: numericAmount,
        mode_of_payment: modeOfPayment,
        sales_invoice: salesInvoiceName,
        allocated_amount: salesInvoiceName ? numericAmount : undefined,
        reference_no: referenceNo.trim() || undefined,
        reference_date: referenceDate || undefined,
        remarks: remarks.trim() || undefined,
      });

      toast.success(`Payment received: ${result.name}`);
      onCreated?.(result.name);
      onClose();
    } catch (err) {
      toast.error(extractErrorFromException(err, "Failed to receive customer payment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-beveren-100 text-beveren-700 dark:bg-beveren-900 dark:text-beveren-300">
              <Banknote size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Receive Payment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {customer.name}
                {salesInvoiceName ? ` • ${salesInvoiceName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {salesInvoiceName && outstandingAmount !== undefined && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Outstanding: {formatCurrencyWithSymbol(outstandingAmount, invoiceCurrency || currencySymbol)}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              autoFocus
            />
            {numericAmount > 0 && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatCurrencyWithSymbol(numericAmount, invoiceCurrency || currencySymbol)}
              </p>
            )}
            {exceedsOutstanding && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                Amount cannot exceed the invoice outstanding balance.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mode of Payment
            </label>
            <select
              value={modeOfPayment}
              onChange={(event) => setModeOfPayment(event.target.value)}
              disabled={isLoading || modes.length === 0}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/60"
            >
              <option value="">Select payment mode</option>
              {modes.map((mode) => (
                <option key={mode.mode_of_payment} value={mode.mode_of_payment}>
                  {mode.mode_of_payment}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reference No.
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reference Date
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-beveren-600 px-4 py-2 text-sm font-medium text-white hover:bg-beveren-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
            <span>Receive Payment</span>
          </button>
        </div>
      </form>
    </div>
  );
}
