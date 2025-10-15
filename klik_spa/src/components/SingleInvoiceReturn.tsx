import { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Package,
  Minus,
  Plus
} from "lucide-react";
import { toast } from "react-toastify";
import { formatCurrency, getCurrencySymbol } from "../utils/currency";
import { usePOSDetails } from "../hooks/usePOSProfile";
import { usePaymentModes } from "../hooks/usePaymentModes";
import { createPartialReturn, getReturnedQty, type ReturnItem } from "../services/returnService";
import { getInvoiceDetails } from "../services/salesInvoice";

interface SingleInvoiceReturnProps {
  invoice: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnInvoice: string) => void;
}

export default function SingleInvoiceReturn({
  invoice,
  isOpen,
  onClose,
  onSuccess
}: SingleInvoiceReturnProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReturnData, setLoadingReturnData] = useState(true);
  const [originalInvoiceGrandTotal, setOriginalInvoiceGrandTotal] = useState<number>(0);
  const [originalInvoicePaidAmount, setOriginalInvoicePaidAmount] = useState<number>(0);

  // Currency from invoice or POS profile
  const { posDetails } = usePOSDetails();
  const currency = (invoice && (invoice.currency || invoice.company_currency)) || posDetails?.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  // Payment modes from POS profile
  const { modes: paymentModes, isLoading: paymentModesLoading } = usePaymentModes(posDetails?.name || 'Test POS Profile');

  // Payment method states
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [returnAmount, setReturnAmount] = useState<number>(0);

  useEffect(() => {
    if (isOpen && invoice) {
      initializeReturnItems();
    }
  }, [isOpen, invoice]);

  // Update return amount when items change
  useEffect(() => {
    if (originalInvoicePaidAmount > 0) {
      // Calculate return amount based on percentage of items being returned
      const totalItemsAmount = returnItems.reduce((sum, item) => {
        return sum + (item.qty * item.rate);
      }, 0);

      const returnedItemsAmount = returnItems.reduce((sum, item) => {
        return sum + ((item.return_qty || 0) * item.rate);
      }, 0);

      // Calculate percentage of items being returned
      const returnPercentage = totalItemsAmount > 0 ? returnedItemsAmount / totalItemsAmount : 0;

      // Apply the same percentage to the original paid amount (what customer actually paid)
      const calculatedReturnAmount = originalInvoicePaidAmount * returnPercentage;

      // Round to 2 decimal places to avoid floating point precision issues
      setReturnAmount(Math.round(calculatedReturnAmount * 100) / 100);
    } else {
      // Fallback to item-based calculation if paid amount is not available
      const total = returnItems.reduce((sum, item) => {
        return sum + ((item.return_qty || 0) * item.rate);
      }, 0);
      setReturnAmount(Math.round(total * 100) / 100);
    }
  }, [returnItems, originalInvoicePaidAmount]);

  // Set default payment method when payment modes are loaded

  // Set default payment method when payment modes are loaded
  useEffect(() => {
    if (paymentModes.length > 0 && !selectedPaymentMethod) {
      // Find default payment method or use first one
      const defaultMode = paymentModes.find(mode => mode.default === 1);
      const resolved = defaultMode?.mode_of_payment || paymentModes[0].mode_of_payment || "";
      setSelectedPaymentMethod(resolved);
    }
  }, [paymentModes, selectedPaymentMethod]);

  const initializeReturnItems = async () => {
    setLoadingReturnData(true);
    try {

      // Always fetch complete invoice details from backend to get accurate grand_total
      let invoiceWithItems = invoice;
      const invoiceDetails = await getInvoiceDetails(invoice.name || invoice.id);

      if (invoiceDetails.success && invoiceDetails.data) {
        invoiceWithItems = invoiceDetails.data.data || invoiceDetails.data;
        // Store the original invoice grand total and paid amount for return calculations
        setOriginalInvoiceGrandTotal(invoiceWithItems.grand_total || 0);
        setOriginalInvoicePaidAmount(invoiceWithItems.paid_amount || invoiceWithItems.grand_total || 0);
      } else {
        console.error('Failed to fetch invoice details:', invoiceDetails.error);
        throw new Error(invoiceDetails.error || 'Failed to fetch invoice details from backend');
      }

        const items: ReturnItem[] = [];

        // Handle different possible item structures
        const itemsArray = invoiceWithItems.items || invoiceWithItems.items_list || invoiceWithItems.sales_invoice_items || [];

        if (!Array.isArray(itemsArray)) {
          console.error('Items is not an array:', itemsArray);
          throw new Error('Invoice items not found in expected format');
        }

        for (const item of itemsArray) {
        console.log('Processing item:', item);

        // Get returned quantity for each item
        const returnedData = await getReturnedQty(
          invoiceWithItems.customer,
          invoiceWithItems.name || invoiceWithItems.id,
          item.item_code || item.id
        );

        const returnedQty = returnedData.success ?
          returnedData.data?.total_returned_qty || 0 : 0;

        // Handle different property names from different invoice sources
        const itemCode = item.item_code || item.id;
        const itemName = item.item_name || item.name;
        const qty = Number(item.qty ?? item.quantity ?? 0);
        const rate = Number(item.rate ?? item.unitPrice ?? 0);
        const amount = Number(item.amount ?? item.total ?? (qty * rate));

        console.log('Extracted values:', { itemCode, itemName, qty, rate, amount, returnedQty });

        items.push({
          item_code: itemCode,
          item_name: itemName,
          qty,
          rate,
          amount,
          returned_qty: returnedQty,
          available_qty: qty - returnedQty,
          return_qty: qty - returnedQty
        });
      }

      setReturnItems(items);
    } catch (error) {
      console.error('Error initializing return items:', error);
      toast.error('Failed to load return data');
    } finally {
      setLoadingReturnData(false);
    }
  };

  const handleReturnQtyChange = (itemCode: string, newQty: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.item_code === itemCode) {
        // Ensure return qty doesn't exceed available qty
        const validQty = Math.max(0, Math.min(newQty, item.available_qty));
        return { ...item, return_qty: validQty };
      }
      return item;
    }));
  };

  const handleReturnAllItems = () => {
    setReturnItems(prev => prev.map(item => ({
      ...item,
      return_qty: item.available_qty
    })));
  };

  const handleClearAll = () => {
    setReturnItems(prev => prev.map(item => ({
      ...item,
      return_qty: 0
    })));
  };

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.return_qty && item.return_qty > 0);

    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    setIsLoading(true);
    const invoiceName = invoice.id || invoice.name
    try {
      const returnData = {
        items: itemsToReturn,
        paymentMethod: selectedPaymentMethod,
        returnAmount: returnAmount
      };

      console.log('Creating return with payment method:', selectedPaymentMethod, 'Amount:', returnAmount);

      const result = await createPartialReturn(invoiceName, itemsToReturn, selectedPaymentMethod, returnAmount);

      if (result.success) {
        toast.success(`Return created successfully (${selectedPaymentMethod})`);
        onSuccess(result.returnInvoice!);
        onClose();
      } else {
        toast.error(result.error || 'Failed to create return');
      }
    } catch (error) {
      console.error('Error creating return:', error);
      toast.error('Failed to create return');
    } finally {
      setIsLoading(false);
    }
  };

  const totalReturnAmount = returnItems.reduce(
    (sum, item) => sum + (item.return_qty || 0) * item.rate,
    0
  );

  const hasItemsToReturn = returnItems.some(item => (item.return_qty || 0) > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-beveren-100 dark:bg-orange-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                <RotateCcw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Return Items
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Invoice: {invoice?.name || invoice?.id} • Customer: {invoice?.customer}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingReturnData ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading return data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Action Buttons */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleReturnAllItems}
                    className="px-4 py-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors text-sm font-medium"
                  >
                    Return All Available
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="text-right">
                  {originalInvoicePaidAmount > 0 && totalReturnAmount !== returnAmount ? (
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between items-center">
                        <span>Total Return Amount:</span>
                        <span>{formatCurrency(totalReturnAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Paid Amount:</span>
                        <span>{formatCurrency(returnAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-red-600 dark:text-red-400 font-semibold">Write-off:</span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          {formatCurrency(totalReturnAmount - returnAmount, currency)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-black-600 dark:text-orange-400">
                      {formatCurrency(totalReturnAmount, currency)}
                    </div>
                  )}
                  {originalInvoicePaidAmount > 0 && totalReturnAmount === returnAmount && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Customer Paid: {formatCurrency(originalInvoicePaidAmount, currency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Sold Qty
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Returned
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Available
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Return Qty
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Return Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {returnItems.map((item) => (
                        <tr key={item.item_code} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {item.item_name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Code: {item.item_code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-sm text-gray-900 dark:text-white">
                            {item.qty}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-sm text-red-600 dark:text-red-400">
                              {item.returned_qty}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-sm font-medium ${
                              item.available_qty > 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {item.available_qty}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleReturnQtyChange(
                                  item.item_code,
                                  (item.return_qty || 0) - 1
                                )}
                                disabled={!item.return_qty || item.return_qty <= 0}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={item.available_qty}
                                value={item.return_qty || 0}
                                onChange={(e) => handleReturnQtyChange(
                                  item.item_code,
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                disabled={item.available_qty === 0}
                              />
                              <button
                                onClick={() => handleReturnQtyChange(
                                  item.item_code,
                                  (item.return_qty || 0) + 1
                                )}
                                disabled={item.available_qty === 0 || (item.return_qty || 0) >= item.available_qty}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-sm text-gray-900 dark:text-white">
                            {formatCurrency(item.rate, currency)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency((item.return_qty || 0) * item.rate, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warning for no returnable items */}
              {returnItems.every(item => item.available_qty === 0) && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        No Items Available for Return
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        All items from this invoice have already been returned.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Selection */}
              {hasItemsToReturn && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Payment Method for Return
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Method Selection */}
                    <div>
                      <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-beveren-500 focus:border-beveren-500 transition-colors"
                        disabled={paymentModesLoading}
                      >
                        {paymentModesLoading ? (
                          <option>Loading payment methods...</option>
                        ) : (
                          <>
                            <option value="">{""}</option>
                            {paymentModes.map((mode) => {
                              const val = mode.mode_of_payment || mode.name;
                              return (
                                <option key={val} value={val}>
                                  {val}
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                    </div>

                    {/* Return Amount Input with currency symbol */}
                    <div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400 text-sm">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          value={returnAmount}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            // Round to 2 decimal places to avoid floating point precision issues
                            setReturnAmount(Math.round(value * 100) / 100);
                          }}
                          step="0.01"
                          min="0"
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-beveren-500 focus:border-beveren-500 transition-colors text-right text-lg font-semibold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {hasItemsToReturn && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    {returnItems.filter(item => (item.return_qty || 0) > 0).length} item(s) selected for return
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={!hasItemsToReturn || isLoading || loadingReturnData}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  hasItemsToReturn && !isLoading && !loadingReturnData
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Processing...' : 'Create Return'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
