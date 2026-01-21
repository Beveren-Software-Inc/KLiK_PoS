"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import type { InpatientMedicationOrder } from "../services/patientService";

interface InpatientMedicationOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: InpatientMedicationOrder[];
  selectedOrders: Set<string>;
  onToggleOrder: (orderName: string) => void;
  onAddToCart: () => void;
  patientName?: string;
}

export default function InpatientMedicationOrdersModal({
  isOpen,
  onClose,
  orders,
  selectedOrders,
  onToggleOrder,
  onAddToCart,
  patientName,
}: InpatientMedicationOrdersModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pending Medication Orders
            </h2>
            {patientName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Patient: {patientName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6">
          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No pending medication orders found.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const isSelected = selectedOrders.has(order.name);
                return (
                  <div
                    key={order.name}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected
                        ? "border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => onToggleOrder(order.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? "bg-beveren-500 border-beveren-500"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {isSelected && <Check size={12} className="text-white" />}
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Order: {order.name}
                          </h3>
                          {order.posting_date && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(order.posting_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        
                        {/* Items in this order */}
                        {order.items && order.items.length > 0 && (
                          <div className="ml-7 space-y-2">
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="text-sm text-gray-700 dark:text-gray-300"
                              >
                                <span className="font-medium">
                                  {item.drug_name || item.drug}
                                </span>
                                {item.dosage && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {" "}• Dosage: {item.dosage}
                                  </span>
                                )}
                                {item.quantity && (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {" "}• Qty: {item.quantity}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedOrders.size} of {orders.length} order(s) selected
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={onAddToCart}
              disabled={selectedOrders.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-beveren-600 rounded-lg hover:bg-beveren-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart ({selectedOrders.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
