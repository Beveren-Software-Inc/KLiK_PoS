import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  Search,
  Eye,
  MonitorX,
  X,
  Edit,
  RotateCcw
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import SingleInvoiceReturn from "../components/SingleInvoiceReturn";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices"
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import RetailSidebar from "../components/RetailSidebar";
import { usePOSDetails } from "../hooks/usePOSProfile";
import { useCreatePOSClosingEntry } from "../services/closingEntry";
import BottomNavigation from "../components/BottomNavigation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { formatCurrency } from "../utils/currency";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "../utils/time";

export default function ClosingShiftPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingAmounts, setClosingAmounts] = useState({});

  // Draft Invoice Edit states
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [selectedDraftInvoice, setSelectedDraftInvoice] = useState<SalesInvoice | null>(null);

  // Single Invoice Return states
  const [showSingleReturn, setShowSingleReturn] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SalesInvoice | null>(null);
  const { createClosingEntry, isCreating } = useCreatePOSClosingEntry();

  const { invoices, isLoading, error } = useSalesInvoices();
  const { modes } = useAllPaymentModes()
  const { posDetails } = usePOSDetails();

  const hideExpectedAmount = posDetails?.custom_hide_expected_amount || false;

  const filterInvoiceByDate = (invoiceDateStr: string) => {
    if (dateFilter === "all") return true;

    if (dateFilter === "today") {
      return isToday(invoiceDateStr);
    }

    if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const invoiceDate = new Date(invoiceDateStr);
      return (
        invoiceDate.getUTCFullYear() === yesterday.getUTCFullYear() &&
        invoiceDate.getUTCMonth() === yesterday.getUTCMonth() &&
        invoiceDate.getUTCDate() === yesterday.getUTCDate()
      );
    }

    if (dateFilter === "week") {
      return isThisWeek(invoiceDateStr);
    }

    if (dateFilter === "month") {
      return isThisMonth(invoiceDateStr);
    }

    if (dateFilter === "year") {
      return isThisYear(invoiceDateStr);
    }

    return true;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    const normalized = status?.toLowerCase() || "";

    switch (normalized) {
      // Payment statuses
      case "paid":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "unpaid":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "partly paid":
        return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      case "overdue":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "draft":
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      case "return":
        return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400`;
      case "cancelled":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;

      // ZATCA submission statuses
      case "pending":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "reported":
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
      case "not reported":
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      case "cleared":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "not cleared":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;

      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`; // Neutral fallback
    }
  };

  const filteredInvoices = useMemo(() => {
    if (isLoading) return [];
    if (error) return [];

    return invoices.filter((invoice) => {
      const matchesSearch =
        searchQuery === "" ||
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invoice.cashier && invoice.cashier.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter;
      const matchesDate = filterInvoiceByDate(invoice.date);

      // Filter by POS profile - only show invoices for the current POS profile
      const matchesPOSProfile = !posDetails?.name || invoice.posProfile === posDetails.name;

      // Filter by POS opening entry - only show invoices for the current opening entry
      const matchesOpeningEntry = !posDetails?.current_opening_entry ||
        (invoice.custom_pos_opening_entry && invoice.custom_pos_opening_entry === posDetails.current_opening_entry);

      return matchesSearch && matchesPayment && matchesStatus && matchesDate && matchesPOSProfile && matchesOpeningEntry;
    });
  }, [invoices, searchQuery, statusFilter, dateFilter, paymentFilter, isLoading, error, posDetails]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading invoices...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error loading invoices</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleViewInvoice = (invoice: SalesInvoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId)
    setShowInvoiceModal(false);
  };

  const handleReturnClick = async (invoiceName: string) => {
    try {
      const result = await createSalesReturn(invoiceName);
      toast.success(`Invoice returned: ${result.return_invoice}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to return invoice");
    }
  };

  const handleEditInvoice = (invoice: SalesInvoice) => {
    setSelectedDraftInvoice(invoice);
    setShowEditOptions(true);
  };

  // Helper function to check if invoice has items that can still be returned
  const hasReturnableItems = (invoice: SalesInvoice) => {
    if (!invoice || !invoice.items) {
      console.log("No invoice or items found for:", invoice?.id);
      return false;
    }

    const hasReturnable = invoice.items.some(item => {
      const soldQty = item.qty || item.quantity || 0;
      const returnedQty = item.returned_qty || 0;
      const canReturn = returnedQty < soldQty;
      console.log(`Item ${item.item_code}: sold=${soldQty}, returned=${returnedQty}, canReturn=${canReturn}`);
      return canReturn;
    });

    console.log(`Invoice ${invoice.id} has returnable items: ${hasReturnable}`);
    return hasReturnable;
  };

  // Single Invoice Return handlers
  const handleSingleReturnClick = (invoice: SalesInvoice) => {
    setSelectedInvoiceForReturn(invoice);
    setShowSingleReturn(true);
  };

  const handleSingleReturnSuccess = () => {
    setShowSingleReturn(false);
    setSelectedInvoiceForReturn(null);
    // Refresh the invoices list
    window.location.reload();
  };

  const handleCancel = (invoiceId: string) => {
    console.log("Cancelling invoice:", invoiceId);
    setShowInvoiceModal(false);
  };

  // Payment Stats Calculation
  const paymentStats = modes.reduce((acc, mode) => {
    acc[mode.name] = {
      name: mode.name,
      openingAmount: mode.openingAmount || 0,
      amount: mode.amount || 0,
      transactions: mode.transactions || 0
    };
    return acc;
  }, {});

  const total = Object.values(paymentStats).reduce((sum, stat) => sum + stat.amount, 0);

  const handleClosingAmountChange = (modeName, value) => {
    setClosingAmounts(prev => ({
      ...prev,
      [modeName]: parseFloat(value) || 0
    }));
  };

  const handleFinalClose = async () => {
    console.log("Closing shift with amounts:", closingAmounts);

    try {
      await createClosingEntry(closingAmounts);
      setShowCloseModal(false);
      navigate(`/`);
    } catch (err) {
      console.error("Error closing shift:", err);
    }
  };

  // Mobile layout: full-width content and persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Closing Shift</h1>
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors text-sm"
              >
                <MonitorX className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          {/* Payment Summary - Only show if not hidden */}
          {!hideExpectedAmount && (
            <div className="grid grid-cols-1 gap-4 mb-6">
              {Object.values(paymentStats).map((stat) => (
                <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{stat.name}</h3>
                    {stat.name.toLowerCase().includes('cash') ? (
                      <div className="text-2xl">💵</div>
                    ) : (
                      <CreditCard className="w-8 h-8 text-beveren-600" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(stat.amount, posDetails?.currency || 'USD')}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.transactions} transactions
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {total > 0 ? ((stat.amount / total) * 100).toFixed(1) : 0}% of total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}

                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-beveren-500
                          bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400
                          cursor-not-allowed"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partly Paid">Partly Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Return">Return</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Payments</option>
                {modes.map((mode) => (
                  <option key={mode.name} value={mode.name}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Invoices ({filteredInvoices.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    {posDetails?.is_zatca_enabled && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Zatca Status
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {invoice.date} {invoice.time}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{invoice.customer}</div>
                        {invoice.giftCardCode && (
                          <div className="text-xs text-purple-600 dark:text-purple-400">Gift: {invoice.giftCardCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                        {invoice.giftCardDiscount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            -{formatCurrency(invoice.giftCardDiscount, invoice.currency)} gift
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{invoice.custom_zatca_submit_status}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View</span>
                          </button>
                          {invoice.status === "Draft" && (
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          )}
                          {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && hasReturnableItems(invoice) && (
                            <button
                              onClick={() => handleSingleReturnClick(invoice)}
                              className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>Return</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Close Shift Modal */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Close Shift</h2>
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {Object.values(paymentStats).map((stat) => (
                  <div key={stat.name} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-xl">💵</div>
                      ) : (
                        <CreditCard className="w-5 h-5 text-orange-600" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{stat.name}</span>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Opening: </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(stat.openingAmount, posDetails?.currency || 'USD')}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Closing amount"
                          value={closingAmounts[stat.name] || ''}
                          onChange={(e) => handleClosingAmountChange(stat.name, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-red-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-500 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalClose}
                  disabled={isCreating}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isCreating
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-beveren-600 text-white hover:bg-beveren-700'
                  }`}
                >
                  {isCreating ? 'Closing...' : 'Close Shift'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice View Modal */}
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onRefund={handleRefund}
          onCancel={handleCancel}
        />

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex pb-12">
      <RetailSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Closing Shift</h1>
              </div>
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
              >
                <MonitorX className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 mt-16 ml-20 space-y-6">
          {/* Payment Summary - Only show if not hidden */}
          {!hideExpectedAmount && (
            <>
              {/* Payment Method Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.values(paymentStats).map((stat) => (
                  <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{stat.name}</h3>
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-2xl">💵</div>
                      ) : (
                        <CreditCard className="w-8 h-8 text-orange-600" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(stat.amount, posDetails?.currency || 'USD')}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {stat.transactions} transactions
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {total > 0 ? ((stat.amount / total) * 100).toFixed(1) : 0}% of total
                      </div>
                    </div>
                  </div>
                ))}
              </div>


            </>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                              focus:outline-none focus:ring-2 focus:ring-beveren-500
                              bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400
                              cursor-not-allowed"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>


              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partly Paid">Partly Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Return">Return</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Payments</option>
                {modes.map((mode) => (
                  <option key={mode.name} value={mode.name}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Invoices ({filteredInvoices.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cashier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    {posDetails?.is_zatca_enabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Zatca Status
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {invoice.date} {invoice.time}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{invoice.customer}</div>

                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {invoice.cashier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">{invoice.paymentMethod}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                        {invoice.giftCardDiscount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            -{formatCurrency(invoice.giftCardDiscount, invoice.currency)} gift card
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                      </td>
                      {posDetails?.is_zatca_enabled && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{invoice.custom_zatca_submit_status}</span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View</span>
                          </button>
                          {invoice.status === "Draft" && (
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          )}
                          {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && hasReturnableItems(invoice) && (
                            <button
                              onClick={() => handleSingleReturnClick(invoice)}
                              className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>Return</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Close Shift Modal */}
        {showCloseModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Close Shift</h2>
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {Object.values(paymentStats).map((stat) => (
                  <div key={stat.name} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-xl">💵</div>
                      ) : (
                        <CreditCard className="w-5 h-5 text-beveren-600" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{stat.name}</span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Opening: </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(stat.openingAmount, posDetails?.currency || 'USD')}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Closing amount"
                          value={closingAmounts[stat.name] || ''}
                          onChange={(e) => handleClosingAmountChange(stat.name, e.target.value)}
                          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 text-red-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-500 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalClose}
                  disabled={isCreating}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isCreating
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-beveren-600 text-white hover:bg-beveren-700'
                  }`}
                >
                  {isCreating ? 'Closing...' : 'Close Shift'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice View Modal */}
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onRefund={handleRefund}
          onCancel={handleCancel}
        />

        {/* Single Invoice Return Modal */}
        <SingleInvoiceReturn
          invoice={selectedInvoiceForReturn}
          isOpen={showSingleReturn}
          onClose={() => setShowSingleReturn(false)}
          onSuccess={handleSingleReturnSuccess}
        />
      </div>
    </div>
  );
}
