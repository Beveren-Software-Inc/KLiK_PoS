"use client"

import { X, Download, Printer, RefreshCw, XCircle, Calendar, User, CreditCard, Tag } from "lucide-react"
import type { SalesInvoice } from "../../types"

interface InvoiceViewModalProps {
  invoice: SalesInvoice | null
  isOpen: boolean
  onClose: () => void
  onRefund: (invoiceId: string) => void
  onCancel: (invoiceId: string) => void
}

export default function InvoiceViewModal({ invoice, isOpen, onClose, onRefund, onCancel }: InvoiceViewModalProps) {
  if (!isOpen || !invoice) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      case "Refunded":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice Details</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <Printer className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Information */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Info */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {invoice.date} at {invoice.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{invoice.customer}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Cashier</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{invoice.cashier}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Payment Method</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{invoice.paymentMethod}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {invoice.items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <img
                                  src="/placeholder.svg"
                                  alt={item.name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                  crossOrigin="anonymous"
                                />
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                    {item.category}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              ${item.unitPrice.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              ${item.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-6">
                {/* Gift Card Info */}
                {invoice.giftCardCode && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">Gift Card Applied</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-purple-700 dark:text-purple-300">Code</span>
                        <span className="font-semibold text-purple-900 dark:text-purple-100">
                          {invoice.giftCardCode}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-purple-700 dark:text-purple-300">Discount</span>
                        <span className="font-semibold text-purple-900 dark:text-purple-100">
                          -${invoice.giftCardDiscount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${invoice.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {invoice.giftCardDiscount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Gift Card Discount</span>
                        <span className="font-semibold">-${invoice.giftCardDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                      <div className="flex justify-between">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          ${invoice.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {invoice.status === "Refunded" && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                        <div className="flex justify-between text-red-600 dark:text-red-400">
                          <span className="font-semibold">Refunded Amount</span>
                          <span className="font-bold">${invoice.refundAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {invoice.status === "Completed" && (
                    <button
                      onClick={() => onRefund(invoice.id)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Process Return</span>
                    </button>
                  )}
                  {invoice.status === "Pending" && (
                    <button
                      onClick={() => onCancel(invoice.id)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancel Order</span>
                    </button>
                  )}
                  <button className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <Printer className="w-4 h-4" />
                    <span>Print Receipt</span>
                  </button>
                </div>

                {/* Notes */}
                {invoice.notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Notes</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
