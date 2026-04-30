import { Loader2, Check, ShoppingBag, Pencil, PlusCircle } from "lucide-react";

interface ActionButtonsProps {
  invoiceSubmitted: boolean;
  isProcessingPayment: boolean;
  isHoldingOrder: boolean;
  isActionButtonDisabled: () => boolean;
  getActionButtonText: () => string;
  onCompletePayment: () => void;
  onHoldOrder: () => void;
  onEditOrder?: () => void;
  onNewOrder?: () => void;
  isB2B: boolean;
  allow_holding_invoices: boolean;
}

export default function ActionButtons({
  invoiceSubmitted,
  isProcessingPayment,
  isHoldingOrder,
  isActionButtonDisabled,
  getActionButtonText,
  onCompletePayment,
  onHoldOrder,
  onEditOrder,
  onNewOrder,
  isB2B,
  allow_holding_invoices,
}: ActionButtonsProps) {
  if (invoiceSubmitted) {
    return (
      <div className="flex justify-end space-x-4 w-full">
        <button
          onClick={onNewOrder}
          className="px-6 py-2 rounded-lg font-semibold bg-beveren-600 hover:bg-beveren-700 text-white transition-colors flex items-center space-x-2"
        >
          <PlusCircle size={16} />
          <span>New Order</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-end space-x-4 w-full">
      <button
        onClick={onEditOrder}
        disabled={isProcessingPayment || isHoldingOrder}
        className={`px-6 py-2 border border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center space-x-2 ${isProcessingPayment || isHoldingOrder ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <Pencil size={16} />
        <span>Edit</span>
      </button>
       {allow_holding_invoices && (
          <button
            onClick={onHoldOrder}
            disabled={isProcessingPayment || isHoldingOrder}
            className={`px-6 py-2 border border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg font-medium hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors flex items-center space-x-2 ${isProcessingPayment || isHoldingOrder ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {isHoldingOrder ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Holding...</span>
              </>
            ) : (
              <>
                <ShoppingBag size={16} />
                <span>Hold</span>
              </>
            )}
          </button>
       )}
      <button
        onClick={onCompletePayment}
        disabled={isActionButtonDisabled()}
        className={`px-8 py-2 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 ${isB2B ? "bg-beveren-500 hover:bg-blue-700 text-white" : "bg-beveren-600 hover:bg-beveren-700 text-white"}`}
      >
        {isProcessingPayment ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>{getActionButtonText()}</span>
          </>
        ) : (
          <>
            <Check size={16} />
            <span>{getActionButtonText()}</span>
          </>
        )}
      </button>
    </div>
  );
}