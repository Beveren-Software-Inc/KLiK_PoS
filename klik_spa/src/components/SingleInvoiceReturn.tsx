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

  useEffect(() => {
    if (isOpen && invoice) {
      initializeReturnItems();
    }
  }, [isOpen, invoice]);

  const initializeReturnItems = async () => {
    setLoadingReturnData(true);
    try {

      // If invoice.items is empty, fetch complete invoice details from backend
      let invoiceWithItems = invoice;
              if (!invoice.items || invoice.items.length === 0) {
          const invoiceDetails = await getInvoiceDetails(invoice.name || invoice.id);

          if (invoiceDetails.success && invoiceDetails.data) {
            invoiceWithItems = invoiceDetails.data.data || invoiceDetails.data;

          } else {
            console.error('Failed to fetch invoice details:', invoiceDetails.error);
            throw new Error(invoiceDetails.error || 'Failed to fetch invoice details from backend');
          }
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
          invoiceWithItems.name || invoiceWithItems.id, // Use id as fallback if name is not available
          item.item_code || item.id
        );

        const returnedQty = returnedData.success ?
          returnedData.data?.total_returned_qty || 0 : 0;

        // Handle different property names from different invoice sources
        const itemCode = item.item_code || item.id;
        const itemName = item.item_name || item.name;
        const qty = item.qty || item.quantity;
        const rate = item.rate || item.unitPrice;
        const amount = item.amount || item.total;

        console.log('Extracted values:', { itemCode, itemName, qty, rate, amount, returnedQty });

        items.push({
          item_code: itemCode,
          item_name: itemName,
          qty: qty,
          rate: rate,
          amount: amount,
          returned_qty: returnedQty,
          available_qty: qty - returnedQty,
          return_qty: qty - returnedQty // Set default return quantity to available quantity
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
      return_qty: item.available_qty // Set return quantity to available quantity
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
      const result = await createPartialReturn(invoiceName, itemsToReturn);

      if (result.success) {
        toast.success(result.message || 'Return created successfully');
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Return Amount</p>
                  <p className="text-xl font-bold text-black-600 dark:text-orange-400">
                    ${totalReturnAmount.toFixed(2)}
                  </p>
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
                            ${item.rate.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                            ${((item.return_qty || 0) * item.rate).toFixed(2)}
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
