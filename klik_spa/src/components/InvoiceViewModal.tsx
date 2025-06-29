"use client";

import {
  X,
  Download,
  Printer,
  RefreshCw,
  XCircle,
  Calendar,
  User,
  CreditCard,
  Tag,
} from "lucide-react";
import type { SalesInvoice } from "../../types";
import { useInvoiceDetails } from "../hooks/useInvoiceDetails";

interface InvoiceViewModalProps {
  invoice: SalesInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  onRefund: (invoiceId: string) => void;
  onCancel: (invoiceId: string) => void;
}

export default function InvoiceViewModal({
  invoice,
  isOpen,
  onClose,
  onRefund,
  onCancel,
}: InvoiceViewModalProps) {
  if (!isOpen || !invoice) return null;

  const { invoice: fullInvoice, isLoading, error } = useInvoiceDetails(invoice.id || null);

  if (isLoading) return <div>Loading invoice...</div>;
  if (error) return <div>Error loading invoice: {error}</div>;

  const displayInvoice = fullInvoice || invoice;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "Refunded":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Details</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(displayInvoice.status)}`}>
                {displayInvoice.status}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Printer className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoItem icon={<Calendar />} label="Date & Time" value={`${displayInvoice.posting_date} at ${displayInvoice.posting_time}`} />
                    <InfoItem icon={<User />} label="Customer" value={displayInvoice.customer} />
                    <InfoItem icon={<User />} label="Cashier" value={displayInvoice.cashier} />
                    <InfoItem icon={<CreditCard />} label="Payment Method" value={displayInvoice.paymentMethod} />
                  </div>
                </div>

                {/* Items Table */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              <tr>
                                <th className="px-6 py-3 text-left uppercase tracking-wider font-medium">Item</th>
                                <th className="px-6 py-3 text-left uppercase tracking-wider font-medium">Item Code</th>
                                <th className="px-6 py-3 text-left uppercase tracking-wider font-medium">Quantity</th>
                                <th className="px-6 py-3 text-left uppercase tracking-wider font-medium">Price</th>
                                <th className="px-6 py-3 text-left uppercase tracking-wider font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                              {displayInvoice.items.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.category}</div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                    <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono text-gray-800 dark:text-gray-200">
                                      {item.item_code}
                                    </code>
                                  </td>
                                  <td className="px-6 py-4 text-gray-900 dark:text-white">{item.qty}</td>
                                  <td className="px-6 py-4 text-gray-900 dark:text-white">${item.rate.toFixed(2)}</td>
                                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">${item.amount.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div className="space-y-6">
                {displayInvoice.giftCardCode && (
                  <GiftCardSection
                    code={displayInvoice.giftCardCode}
                    discount={displayInvoice.giftCardDiscount}
                  />
                )}

                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h3>
                  <div className="space-y-3">
                    <SummaryRow label="Subtotal" value={displayInvoice.total} />
                    {displayInvoice.giftCardDiscount > 0 && (
                      <SummaryRow label="Gift Card Discount" value={-displayInvoice.giftCardDiscount} color="green" />
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                      <SummaryRow label="Total" value={displayInvoice.grand_total} bold />
                    </div>
                    {displayInvoice.status === "Refunded" && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                        <SummaryRow label="Refunded Amount" value={displayInvoice.refundAmount} color="red" bold />
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {displayInvoice.status === "Completed" && (
                    <ActionButton onClick={() => onRefund(displayInvoice.id)} icon={<RefreshCw />} color="orange" text="Process Return" />
                  )}
                  {displayInvoice.status === "Pending" && (
                    <ActionButton onClick={() => onCancel(displayInvoice.id)} icon={<XCircle />} color="red" text="Cancel Order" />
                  )}
                  <ActionButton icon={<Printer />} text="Print Receipt" />
                </div>

                {/* Notes */}
                {displayInvoice.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Notes</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{displayInvoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable components
function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-3">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  const base = `flex justify-between ${color ? `text-${color}-600 dark:text-${color}-400` : ""}`;
  const valueClass = bold ? "font-bold" : "font-semibold";
  return (
    <div className={base}>
      <span className={bold ? "text-lg font-bold" : ""}>{label}</span>
      <span className={valueClass}>${Math.abs(value)}</span>
    </div>
  );
}

function GiftCardSection({ code, discount }: { code: string; discount: number }) {
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Gift Card Applied</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-purple-700 dark:text-purple-300">Code</span>
          <span className="font-semibold text-purple-900 dark:text-purple-100">{code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-purple-700 dark:text-purple-300">Discount</span>
          <span className="font-semibold text-purple-900 dark:text-purple-100">-${discount}</span>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, text, color }: { onClick?: () => void; icon: React.ReactNode; text: string; color?: string }) {
  const base =
    color === "red"
      ? "bg-red-600 hover:bg-red-700"
      : color === "orange"
      ? "bg-orange-600 hover:bg-orange-700"
      : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700";

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-colors ${base} text-white`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
