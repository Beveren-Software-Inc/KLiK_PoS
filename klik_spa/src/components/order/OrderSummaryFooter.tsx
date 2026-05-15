"use client";

import { formatCurrencyWithSymbol } from "../../utils/currency";

interface OrderSummaryFooterProps {
  subtotal: number;
  total: number;
  totalItemDiscount: number;
  couponDiscount: number;
  onCheckout: () => void;
  onClearCart: () => void;
  onHoldOrder: () => void;
  isHoldingOrder?: boolean;
  isValidating: boolean;
  isMobile?: boolean;
  currency_symbol?: string;
  allow_holding_invoices?: boolean;
}

export const OrderSummaryFooter = ({
  subtotal,
  total,
  totalItemDiscount,
  couponDiscount,
  onCheckout,
  onClearCart,
  onHoldOrder,
  isHoldingOrder = false,
  isValidating,
  isMobile,
  currency_symbol,
  allow_holding_invoices,
}: OrderSummaryFooterProps) => {
  return (
    <div
      className={`${
        isMobile
          ? "flex-shrink-0 p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg"
          : "p-4 border-t border-gray-100 dark:border-gray-700"
      } space-y-3`}
    >
      {/* Action Buttons */}
      <div
        className={`grid ${
          allow_holding_invoices ? "grid-cols-2" : "grid-cols-1"
        } gap-3 ${isMobile ? "mb-3" : ""}`}
      >
        {allow_holding_invoices && (
          <button
            onClick={onHoldOrder}
            disabled={isHoldingOrder}
            className={`px-3 py-2 border border-beveren-600 text-beveren-600 dark:text-beveren-400 rounded-lg font-medium hover:bg-beveren-600 hover:text-white transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed ${isHoldingOrder ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isHoldingOrder ? 'Holding...' : 'Hold'}
          </button>
        )}
        <button
          onClick={onClearCart}
          className="px-3 py-2 border border-red-500 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
        >
          Clear Cart
        </button>
      </div>

      {/* Pay Button */}
      <button
        onClick={onCheckout}
        disabled={isValidating}
        className={`w-full bg-beveren-600 text-white rounded-xl font-semibold hover:bg-beveren-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isMobile ? "py-3 text-base" : "py-2 text-sm"
        }`}
      >
        {isValidating
          ? "Checking cart..."
          : `Checkout ${formatCurrencyWithSymbol(total, currency_symbol)}`}
      </button>
    </div>
  );
};