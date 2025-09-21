import React from 'react';
import { X, ShoppingCart, FileText } from 'lucide-react';
import type { SalesInvoice } from '../../types';

interface EditDraftInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SalesInvoice | null;
  onGoToCart: (invoice: SalesInvoice) => void;
  onSubmitPayment: (invoice: SalesInvoice) => void;
}

export default function EditDraftInvoiceDialog({
  isOpen,
  onClose,
  invoice,
  onGoToCart,
  onSubmitPayment
}: EditDraftInvoiceDialogProps) {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Draft Invoice
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Invoice Info */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Invoice:</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {invoice.id}
          </p>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            What would you like to do with this draft invoice?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => onGoToCart(invoice)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
          >
            <ShoppingCart size={20} />
            <span>Go to Cart</span>
          </button>

          <button
            onClick={() => onSubmitPayment(invoice)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <FileText size={20} />
            <span>Submit Payment</span>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
