import { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  Package,
  Minus,
  Plus,
  FileText,
  Clock,
  MapPin
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getCustomerInvoicesForReturn,
  createMultiInvoiceReturn,
  type InvoiceForReturn,
  type ReturnItem,
  type ReturnData
} from "../services/returnService";

interface MultiInvoiceReturnProps {
  customer?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnInvoices: string[]) => void;
  customers?: Array<{name: string, customer_name: string}>;
}

export default function MultiInvoiceReturn({
  customer,
  isOpen,
  onClose,
  onSuccess,
  customers = []
}: MultiInvoiceReturnProps) {
  const [invoices, setInvoices] = useState<InvoiceForReturn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [daysBack, setDaysBack] = useState<number>(90);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // New workflow states
  const [workflowStep, setWorkflowStep] = useState<'select-customer' | 'select-items' | 'filter-invoices' | 'select-invoices'>('select-customer');
  const [selectedCustomer, setSelectedCustomer] = useState<string>(customer || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<{item_code: string, item_name: string}[]>([]);
  const [availableItems, setAvailableItems] = useState<{item_code: string, item_name: string}[]>([]);
  const [filteredAvailableItems, setFilteredAvailableItems] = useState<{item_code: string, item_name: string}[]>([]);

  // Address filter states
  const [customerAddresses, setCustomerAddresses] = useState<Array<{name: string, address_line1: string, city: string}>>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Reset workflow when opening
      if (customer) {
        setWorkflowStep('select-items');
        setSelectedCustomer(customer);
      } else {
        setWorkflowStep('select-customer');
        setSelectedCustomer('');
      }
      setSelectedItems([]);
      setInvoices([]);
      setSelectedInvoices(new Set());
      setFilteredAvailableItems([]);
      setCustomerSearchQuery('');
      setSelectedAddress('');

      // Automatically load available items and addresses when modal opens if customer is provided
      if (customer) {
        loadAvailableItems();
        loadCustomerAddresses();
      }
    }
  }, [isOpen, customer]);

    const loadCustomerAddresses = async () => {
    try {
      const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_addresses?customer=${selectedCustomer}`);
      const data = await response.json();

      if (data.message && Array.isArray(data.message)) {
        setCustomerAddresses(data.message);
      } else {
        setCustomerAddresses([]);
      }
    } catch (error) {
      console.error('Error loading customer addresses:', error);
      setCustomerAddresses([]);
    }
  };

  const loadAvailableItems = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

      const result = await getCustomerInvoicesForReturn(selectedCustomer, startDate, endDate, selectedAddress);

      if (result.success && result.data) {
        // Extract unique items from all invoices
        const itemMap = new Map<string, string>();
        result.data.forEach(invoice => {
          invoice.items.forEach(item => {
            if (item.available_qty > 0) {
              itemMap.set(item.item_code, item.item_name);
            }
          });
        });

        const items = Array.from(itemMap.entries()).map(([code, name]) => ({
          item_code: code,
          item_name: name
        }));

        setAvailableItems(items);
        setFilteredAvailableItems(items);
      } else {
        setAvailableItems([]);
        setFilteredAvailableItems([]);
      }
    } catch (error) {
      console.error('Error loading available items:', error);
      setAvailableItems([]);
      setFilteredAvailableItems([]);
    }
  };

  const loadCustomerInvoices = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    setWorkflowStep('filter-invoices');
    setLoadingInvoices(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

      // Include address filter if selected
      const result = await getCustomerInvoicesForReturn(selectedCustomer, startDate, endDate, selectedAddress);

      if (result.success && result.data) {
        const filteredInvoices = result.data.filter(invoice =>
          invoice.items.some(item =>
            selectedItems.some(selectedItem =>
              selectedItem.item_code === item.item_code && item.available_qty > 0
            )
          )
        ).map(invoice => ({
          ...invoice,
          items: invoice.items.filter(item =>
            selectedItems.some(selectedItem =>
              selectedItem.item_code === item.item_code && item.available_qty > 0
            )
          ).map(item => ({
            ...item,
            return_qty: item.available_qty
          }))
        }));

        setInvoices(filteredInvoices);
        setWorkflowStep('select-invoices');
      } else {
        toast.error(result.error || 'Failed to load customer invoices');
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error loading customer invoices:', error);
      toast.error('Failed to load customer invoices');
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleItemSelection = (itemCode: string, itemName: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedItems(prev => [...prev, { item_code: itemCode, item_name: itemName }]);
    } else {
      setSelectedItems(prev => prev.filter(item => item.item_code !== itemCode));
    }
  };

  const handleReturnQtyChange = (invoiceName: string, itemCode: string, newQty: number) => {
    setInvoices(prev => prev.map(invoice => {
      if (invoice.name === invoiceName) {
        const updatedItems = invoice.items.map(item => {
          if (item.item_code === itemCode) {
            const validQty = Math.max(0, Math.min(newQty, item.available_qty));
            return { ...item, return_qty: validQty };
          }
          return item;
        });
        return { ...invoice, items: updatedItems };
      }
      return invoice;
    }));
  };

  const toggleInvoiceSelection = (invoiceName: string) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceName)) {
        newSet.delete(invoiceName);
        // Clear return quantities for deselected invoice
        setInvoices(prevInvoices => prevInvoices.map(invoice => {
          if (invoice.name === invoiceName) {
            const clearedItems = invoice.items.map(item => ({ ...item, return_qty: 0 }));
            return { ...invoice, items: clearedItems };
          }
          return invoice;
        }));
      } else {
        newSet.add(invoiceName);
      }
      return newSet;
    });
  };

  const handleReturnAllAvailable = (invoiceName: string) => {
    setInvoices(prev => prev.map(invoice => {
      if (invoice.name === invoiceName) {
        const updatedItems = invoice.items.map(item => ({
          ...item,
          return_qty: item.available_qty
        }));
        return { ...invoice, items: updatedItems };
      }
      return invoice;
    }));
    setSelectedInvoices(prev => new Set(prev).add(invoiceName));
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.items.some(item =>
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const hasItemsToReturn = invoices.some(invoice =>
    invoice.items.some(item => (item.return_qty || 0) > 0)
  );

  const totalReturnAmount = invoices.reduce((total, invoice) =>
    total + invoice.items.reduce((invoiceTotal, item) =>
      invoiceTotal + (item.return_qty || 0) * item.rate, 0
    ), 0
  );

  const handleSubmitReturn = async () => {
    const invoiceReturns = invoices
      .filter(invoice => selectedInvoices.has(invoice.name)) // Only include selected invoices
      .map(invoice => ({
        invoice_name: invoice.name,
        return_items: invoice.items.filter(item => (item.return_qty || 0) > 0)
      }))
      .filter(invoiceReturn => invoiceReturn.return_items.length > 0);

    if (invoiceReturns.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    const returnData: ReturnData = {
      customer,
      invoice_returns: invoiceReturns
    };

    setIsLoading(true);
    console.log("Data", returnData)
    try {
      const result = await createMultiInvoiceReturn(returnData);

      if (result.success) {
        toast.success(result.message || 'Returns created successfully');
        onSuccess(result.createdReturns || []);
        onClose();
      } else {
        toast.error(result.error || 'Failed to create returns');
      }
    } catch (error) {
      console.error('Error creating returns:', error);
      toast.error('Failed to create returns');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-7xl h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-beveren-100 dark:bg-orange-900/20 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Multi-Invoice Return
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Customer: {selectedCustomer || 'Not selected'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Workflow Steps */}
          <div className="mt-3 sm:mt-4 flex items-center justify-center">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {!customer && (
                <>
                                <div className={`flex items-center space-x-1 sm:space-x-2 ${workflowStep === 'select-customer' ? 'text-beveren-600 dark:text-beveren-400' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  workflowStep === 'select-customer' ? 'bg-beveren-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                }`}>
                  1
                </div>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Select Customer</span>
              </div>
              <div className="w-4 sm:w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>
                </>
              )}

              <div className={`flex items-center space-x-1 sm:space-x-2 ${workflowStep === 'select-items' ? 'text-beveren-600 dark:text-beveren-400' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  workflowStep === 'select-items' ? 'bg-beveren-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                }`}>
                  {customer ? '1' : '2'}
                </div>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Select Items</span>
              </div>

              <div className="w-4 sm:w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>

              <div className={`flex items-center space-x-1 sm:space-x-2 ${workflowStep === 'filter-invoices' ? 'text-beveren-600 dark:text-beveren-400' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  workflowStep === 'filter-invoices' ? 'bg-beveren-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                }`}>
                  {customer ? '2' : '3'}
                </div>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Filter Invoices</span>
              </div>

              <div className="w-4 sm:w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>

              <div className={`flex items-center space-x-1 sm:space-x-2 ${workflowStep === 'select-invoices' ? 'text-beveren-600 dark:text-beveren-400' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  workflowStep === 'select-invoices' ? 'bg-beveren-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                }`}>
                  {customer ? '3' : '4'}
                </div>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Select Invoices</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 0: Select Customer (only when no customer provided) */}
        {workflowStep === 'select-customer' && (
          <div className="flex-1 flex flex-col sm:flex-col overflow-y-auto sm:overflow-y-auto px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Step 1: Select Customer
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose a customer to process multi-invoice returns
              </p>
            </div>

            {/* Customer Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search customers by name or ID..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Customer List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 flex-1 flex flex-col">
              <div className="space-y-2 flex-1 sm:flex-1 overflow-y-auto max-h-60 sm:max-h-none">
                {customers && customers.length > 0 ? (
                  customers
                    .filter(customer =>
                      customer.customer_name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                      customer.name?.toLowerCase().includes(customerSearchQuery.toLowerCase())
                    )
                    .map((customer) => (
                      <button
                        key={customer.name || customer.customer_name || Math.random()}
                        onClick={async () => {
                          const customerName = customer.name || customer.customer_name || '';
                          setSelectedCustomer(customerName);
                          setWorkflowStep('select-items');

                          // Load items and addresses with the selected customer
                          try {
                            const endDate = new Date().toISOString().split('T')[0];
                            const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

                            // Load addresses
                            const addressResponse = await fetch(`/api/method/klik_pos.api.customer.get_customer_addresses?customer=${customerName}`);
                            const addressData = await addressResponse.json();

                            if (addressData.message && Array.isArray(addressData.message)) {
                              setCustomerAddresses(addressData.message);
                            } else {
                              setCustomerAddresses([]);
                            }

                            // Load available items
                            const result = await getCustomerInvoicesForReturn(customerName, startDate, endDate, selectedAddress);

                            if (result.success && result.data) {
                              // Extract unique items from all invoices
                              const itemMap = new Map<string, string>();
                              result.data.forEach(invoice => {
                                invoice.items.forEach(item => {
                                  if (item.available_qty > 0) {
                                    itemMap.set(item.item_code, item.item_name);
                                  }
                                });
                              });

                              const items = Array.from(itemMap.entries()).map(([code, name]) => ({
                                item_code: code,
                                item_name: name
                              }));

                              setAvailableItems(items);
                              setFilteredAvailableItems(items);
                            } else {
                              setAvailableItems([]);
                              setFilteredAvailableItems([]);
                            }
                          } catch (error) {
                            console.error('Error loading customer data:', error);
                            setAvailableItems([]);
                            setFilteredAvailableItems([]);
                            setCustomerAddresses([]);
                          }
                        }}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {customer.customer_name || customer.name || 'Unknown Customer'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {customer.name || customer.customer_name || 'No ID'}
                        </div>
                      </button>
                    ))
                ) : customerSearchQuery.trim() ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">No customers found matching "{customerSearchQuery}"</div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">No customers found</div>
                  </div>
                )}
              </div>

              {/* Results Counter */}
              {customers && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {customerSearchQuery.trim()
                      ? `${customers.filter(customer =>
                          customer.customer_name?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          customer.name?.toLowerCase().includes(customerSearchQuery.toLowerCase())
                        ).length} of ${customers.length} customers`
                      : `${customers.length} customers total`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Select Items */}
        {workflowStep === 'select-items' && (
          <div className="flex-1 flex flex-col sm:flex-col overflow-y-auto sm:overflow-y-auto px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Step 1: Select Items to Return
              </h3>
              <p className="hidden sm:block text-sm text-gray-600 dark:text-gray-400">
                Choose which items you want to return from customer invoices
              </p>
            </div>

                        <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Days to Look Back
                  </label>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={daysBack || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setDaysBack(0);
                        } else {
                          const numValue = parseInt(value);
                          if (!isNaN(numValue) && numValue > 0) {
                            setDaysBack(numValue);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (!daysBack || daysBack < 1) {
                          setDaysBack(90);
                        }
                      }}
                      className="w-20 sm:w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
                    <button
                      onClick={loadAvailableItems}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Refresh items with new days setting"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Address Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Shipping Address (Optional)
                  </label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <input
                        list="address-list"
                        value={selectedAddress}
                        onChange={(e) => {
                          setSelectedAddress(e.target.value);
                          setTimeout(() => loadAvailableItems(), 100);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                                  focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800
                                  text-gray-900 dark:text-white"
                      />

                      <datalist id="address-list">
                        {customerAddresses.map((address) => (
                          <option key={address.name} value={address.name}>
                            {address.address_line1}, {address.city}
                          </option>
                        ))}
                      </datalist>

                  </div>
                </div>

                {selectedItems.length > 0 && (
                  <button
                    onClick={loadCustomerInvoices}
                    disabled={loadingInvoices}
                    className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                      loadingInvoices
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-beveren-600 hover:bg-orange-700'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>{loadingInvoices ? 'Loading...' : `Find Invoices (${selectedItems.length} items)`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Available Items */}
            {isLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center flex-1 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-beveren-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading available items...</p>
              </div>
            ) : availableItems.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Available Items (Last {daysBack} days)
                  </h4>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedItems.length} of {availableItems.length} selected
                  </span>
                </div>

                {/* Item Search and Selection */}
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search items by name or code..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase();
                          const filtered = availableItems.filter(item =>
                            item.item_name.toLowerCase().includes(searchTerm) ||
                            item.item_code.toLowerCase().includes(searchTerm)
                          );
                          setFilteredAvailableItems(filtered);
                        }}
                      />
                    </div>
                    {selectedItems.length > 0 && (
                      <button
                        onClick={() => setSelectedItems([])}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700 transition-colors"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto flex-1 min-h-0">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedItems.length === filteredAvailableItems.length && filteredAvailableItems.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems(filteredAvailableItems);
                                } else {
                                  setSelectedItems([]);
                                }
                              }}
                              className="w-4 h-4 text-beveren-600 border-gray-300 rounded focus:ring-beveren-500"
                            />
                            <span className="text-xs text-gray-400">All</span>
                          </div>
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Item Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Item Code
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {filteredAvailableItems.map((item) => (
                        <tr key={item.item_code} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedItems.some(selected => selected.item_code === item.item_code)}
                              onChange={(e) => handleItemSelection(item.item_code, item.item_name, e.target.checked)}
                              className="w-4 h-4 text-beveren-600 border-gray-300 rounded focus:ring-beveren-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.item_name}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {item.item_code}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              selectedItems.some(selected => selected.item_code === item.item_code)
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {selectedItems.some(selected => selected.item_code === item.item_code) ? 'Selected' : 'Available'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedItems.length > 0 && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      <span className="font-medium">{selectedItems.length}</span> items selected for return
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center flex-1 flex flex-col items-center justify-center min-h-0">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Items Found</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No items found in customer invoices from the last {daysBack} days.
                </p>
                <button
                  onClick={loadAvailableItems}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Refresh Items
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Filter Invoices */}
        {workflowStep === 'filter-invoices' && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Step 2: Filtering Invoices
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Finding invoices from the last {daysBack} days containing selected items...
              </p>
            </div>

            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Filtering invoices...</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Invoices */}
        {workflowStep === 'select-invoices' && (
          <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search invoices or items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setWorkflowStep('select-items')}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                >
                  ← Back to Items
                </button>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Return Amount</p>
                  <p className="text-xl font-bold text-beveren-600 dark:text-beveren-400">
                    ${totalReturnAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredInvoices.length} invoice(s) found • {selectedInvoices.size} selected
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Selected Items: {selectedItems.map(item => item.item_name).join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ maxHeight: "calc(95vh - 320px)" }}>
          {workflowStep === 'select-invoices' && (
            <>
              {loadingInvoices ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading invoices...</p>
                  </div>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Invoices Found</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      No invoices found containing the selected items in the last {daysBack} days.
                    </p>
                    <button
                      onClick={() => setWorkflowStep('select-items')}
                      className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      ← Back to Items Selection
                    </button>
                  </div>
                </div>
              ) : (
            <div className="space-y-6">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {/* Invoice Header */}
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.has(invoice.name)}
                          onChange={() => toggleInvoiceSelection(invoice.name)}
                          className="w-4 h-4 text-beveren-600 border-gray-300 rounded focus:ring-beveren-500"
                        />
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            {invoice.name}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>{invoice.posting_date}</span>
                            <span>${invoice.grand_total.toFixed(2)}</span>
                            <span className="capitalize">{invoice.status}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReturnAllAvailable(invoice.name)}
                        className="px-3 py-1 text-sm bg-beveren-100 dark:bg-beveren-900/20 text-beveren-700 dark:text-beveren-300 rounded hover:bg-beveren-200 dark:hover:bg-beveren-900/40 transition-colors"
                      >
                        Return All Available
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 dark:bg-gray-600">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Item
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Sold
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Returned
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Available
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Return Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {invoice.items.map((item) => (
                          <tr key={item.item_code} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <Package className="w-4 h-4 text-blue-500" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {item.item_name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.item_code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white">
                              {item.qty}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-red-600 dark:text-red-400">
                              {item.returned_qty}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm font-medium ${
                                item.available_qty > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {item.available_qty}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => handleReturnQtyChange(
                                    invoice.name,
                                    item.item_code,
                                    (item.return_qty || 0) - 1
                                  )}
                                  disabled={!item.return_qty || item.return_qty <= 0}
                                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.available_qty}
                                  value={item.return_qty || 0}
                                  onChange={(e) => handleReturnQtyChange(
                                    invoice.name,
                                    item.item_code,
                                    parseInt(e.target.value) || 0
                                  )}
                                  className="w-12 px-1 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-beveren-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
                                  disabled={item.available_qty === 0}
                                />
                                <button
                                  onClick={() => handleReturnQtyChange(
                                    invoice.name,
                                    item.item_code,
                                    (item.return_qty || 0) + 1
                                  )}
                                  disabled={item.available_qty === 0 || (item.return_qty || 0) >= item.available_qty}
                                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                              ${((item.return_qty || 0) * item.rate).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                              ))}
              </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {workflowStep === 'select-invoices' && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {hasItemsToReturn && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-orange-500" />
                    <span>Items selected for return from multiple invoices</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={!hasItemsToReturn || isLoading}
                  className={`px-6 sm:px-8 py-3 rounded-lg font-semibold text-base sm:text-lg transition-colors shadow-lg ${
                    hasItemsToReturn && !isLoading
                      ? 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-xl'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? 'Processing...' : 'Create Returns'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
