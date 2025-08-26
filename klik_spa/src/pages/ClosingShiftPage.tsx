import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Users,
  CreditCard,
  RefreshCw,
  Search,
  DollarSign,
  TrendingUp,
  Grid3X3,
  List,
  Eye,
  MonitorX,
  EyeOff,
  X
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices"
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import RetailSidebar from "../components/RetailSidebar";
import { usePOSDetails } from "../hooks/usePOSProfile";
import { usePaymentModes } from "../hooks/usePaymentModes";
import { useCreatePOSClosingEntry } from "../services/closingEntry";

export default function ClosingShiftPage() {
  // const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingAmounts, setClosingAmounts] = useState({});
  const { createClosingEntry, isCreating, error: closingError, success } = useCreatePOSClosingEntry();
const navigate = useNavigate();

  const { invoices, isLoading, error } = useSalesInvoices(); 
  const { modes } = useAllPaymentModes()
  const { posDetails, loading: posLoading } = usePOSDetails();
  // const { modes, isLoading, error } = usePaymentModes("Test POS Profile");

  const hideExpectedAmount = posDetails?.custom_hide_expected_amount || false;


  const tabs = [
    { id: "payments", name: "Payment Methods", icon: CreditCard },
    { id: "invoices", name: "All Invoices", icon: FileText },
    // { id: "cashiers", name: "Cashier Sales", icon: Users },
    
    { id: "returns", name: "Returns & Refunds", icon: RefreshCw },
  ];


const filterInvoiceByDate = (invoiceDateStr: string) => {
  if (dateFilter === "all") return true;

  const invoiceDate = new Date(invoiceDateStr);
  const today = new Date();

  if (dateFilter === "today") {
    return invoiceDate.toDateString() === today.toDateString();
  }

  if (dateFilter === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return invoiceDate.toDateString() === yesterday.toDateString();
  }

  if (dateFilter === "week") {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday as start
    return invoiceDate >= startOfWeek && invoiceDate <= today;
  }

  if (dateFilter === "month") {
    return (
      invoiceDate.getMonth() === today.getMonth() &&
      invoiceDate.getFullYear() === today.getFullYear()
    );
  }

  if (dateFilter === "year") {
    return invoiceDate.getFullYear() === today.getFullYear();
  }

  return true;
};

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "Completed":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "Pending":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "Cancelled":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "Refunded":
        return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      default:
        return baseClasses;
    }
  };

  // Update your filteredInvoices to use the hook data
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
    const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter;
    const matchesDate = filterInvoiceByDate(invoice.date);

    return matchesSearch && matchesPayment && matchesCashier && matchesStatus && matchesDate;
  });
}, [invoices, searchQuery, statusFilter, dateFilter, paymentFilter, cashierFilter, isLoading, error]);

  // Update uniqueCashiers to use real data
  const uniqueCashiers = useMemo(() => {
    return [...new Set(invoices.map(invoice => invoice.cashier).filter(Boolean))];
  }, [invoices]);

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
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId)
    setShowInvoiceModal(false);
  };


  const handleReturnClick = async (invoiceName: string) => {
    try {
      const result = await createSalesReturn(invoiceName);
      toast.success(`Invoice returned: ${result.return_invoice}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || "Failed to return invoice");
    }
};

  const handleCancel = (invoiceId: string) => {
    console.log("Cancelling invoice:", invoiceId);
    setShowInvoiceModal(false);
  };

  const renderFilters = (showCashierFilter = false, showAdvanced = false) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
   
        {showAdvanced && (
          <>
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

          </>
        )}
      </div>
    </div>
  );

  const renderInvoicesTab = () => (
    <div className="space-y-6">
      {renderFilters(true, true)}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredInvoices.length}</p>
            </div>
            <FileText className="w-8 h-8 text-beveren-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gift Card Savings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${filteredInvoices.reduce((sum, inv) => sum + inv.giftCardDiscount, 0).toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                $
                {filteredInvoices.length > 0
                  ? (filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0) / filteredInvoices.length).toFixed(
                      2,
                    )
                  : "0.00"}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                    {invoice.giftCardCode && (
                      <div className="text-xs text-purple-600 dark:text-purple-400">Gift: {invoice.giftCardCode}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.cashier}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">{invoice.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ${invoice.totalAmount.toFixed(2)}
                    </div>
                    {invoice.giftCardDiscount > 0 && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        -${invoice.giftCardDiscount.toFixed(2)} gift card
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                      {invoice.status === "Paid" && (
                        <button 
                        onClick={() => handleRefund(invoice.id)}
                        className="text-orange-600 hover:text-orange-900">Return</button>
                      )}
                      {invoice.status === "Pending" && (
                        <button className="text-red-600 hover:text-red-900">Cancel</button>
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
  );

  const renderCashiersTab = () => {
    const cashierStats = filteredInvoices.reduce((acc, invoice) => {
      if (!acc[invoice.cashier]) {
        acc[invoice.cashier] = {
          name: invoice.cashier,
          id: invoice.cashierId,
          totalSales: 0,
          totalTransactions: 0,
          cashSales: 0,
          cardSales: 0,
          giftCardDiscounts: 0,
          refunds: 0,
        };
      }
      acc[invoice.cashier].totalSales += invoice.totalAmount;
      acc[invoice.cashier].totalTransactions += 1;
      if (invoice.paymentMethod === "Cash") {
        acc[invoice.cashier].cashSales += invoice.totalAmount;
      } else {
        acc[invoice.cashier].cardSales += invoice.totalAmount;
      }
      acc[invoice.cashier].giftCardDiscounts += invoice.giftCardDiscount;
      if (invoice.status === "Refunded") {
        acc[invoice.cashier].refunds += invoice.refundAmount;
      }
      return acc;
    }, {} as any);

    const cashierArray = Object.values(cashierStats);

    return (
      <div className="space-y-6">
        {renderFilters(true, false)}

        {/* View Toggle */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cashier Performance ({cashierArray.length} cashiers)
          </h3>
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "cards"
                  ? "bg-white dark:bg-gray-600 text-beveren-600 dark:text-beveren-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white dark:bg-gray-600 text-beveren-600 dark:text-beveren-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cashierArray.map((cashier: any) => (
              <div
                key={cashier.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-beveren-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {cashier.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cashier.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{cashier.id}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Sales</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${cashier.totalSales.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{cashier.totalTransactions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Cash Sales</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${cashier.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Card Sales</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${cashier.cardSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Gift Card Discounts</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      ${cashier.giftCardDiscounts.toFixed(2)}
                    </span>
                  </div>
                  {cashier.refunds > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Refunds</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        ${cashier.refunds.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cashier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cash Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Card Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Gift Cards
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Refunds
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {cashierArray.map((cashier: any) => (
                    <tr key={cashier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-beveren-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">
                              {cashier.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .join("")}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{cashier.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{cashier.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        ${cashier.totalSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {cashier.totalTransactions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        ${cashier.cashSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        ${cashier.cardSales.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 dark:text-purple-400">
                        ${cashier.giftCardDiscounts.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                        ${cashier.refunds.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

// Add these state variables at the top of your ClosingShiftPage component, with your other useState declarations:
// const [showCloseModal, setShowCloseModal] = useState(false);
// const [closingAmounts, setClosingAmounts] = useState({});

// Add these state variables at the top of your ClosingShiftPage component, with your other useState declarations:
// const [showCloseModal, setShowCloseModal] = useState(false);
// const [closingAmounts, setClosingAmounts] = useState({});
// Add these state variables at the top of your ClosingShiftPage component, with your other useState declarations:
// const [showCloseModal, setShowCloseModal] = useState(false);
// const [closingAmounts, setClosingAmounts] = useState({});
// Add these state variables at the top of your ClosingShiftPage component, with your other useState declarations:
// const [showCloseModal, setShowCloseModal] = useState(false);
// const [closingAmounts, setClosingAmounts] = useState({});

const renderPaymentsTab = () => {
  // USING REAL DATA FROM YOUR BACKEND
  const paymentStats = modes.reduce((acc, mode) => {
    acc[mode.name] = {
      name: mode.name,
      openingAmount: mode.openingAmount || 0,  // From your backend
      amount: mode.amount || 0,                // From your backend
      transactions: mode.transactions || 0     // From your backend
    };
    return acc;
  }, {});

  // DUMMY DATA (COMMENTED OUT) - Used for testing:
  /*
  const paymentStats = {
    "Cash": {
      name: "Cash",
      openingAmount: 500.00,
      amount: 195.75,      // Total cash sales today
      transactions: 3      // Number of cash transactions
    },
    "Credit Card": {
      name: "Credit Card", 
      openingAmount: 0.00,
      amount: 89.99,       // Total credit card sales
      transactions: 1      // Number of credit card transactions
    }
  };
  */

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
      const res = await createClosingEntry(closingAmounts);
       
      // if (res?.message?.name) {
      //   // success
        setShowCloseModal(false);
        navigate(`/`); // redirect to home
      // } else {
      //   console.error("Failed to close shift:", res);
      // }
    } catch (err) {
      console.error("Error closing shift:", err);
    }
  };

  return (
    <div className="space-y-6">
      {renderFilters(true, false)}

      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${hideExpectedAmount ? 'blur-sm' : ''}`}>
        {Object.values(paymentStats).map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
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
                ${stat.amount.toFixed(2)}
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

      {hideExpectedAmount && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <EyeOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-yellow-800 dark:text-yellow-200 font-medium">
              Payment amounts are hidden for security. Click "Close" to view detailed breakdown.
            </p>
          </div>
        </div>
      )}

      {/* Payment Method Breakdown Chart */}
      <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 ${hideExpectedAmount ? 'blur-sm' : ''}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Payment Distribution</h3>
        <div className="space-y-4">
          {Object.values(paymentStats).map((stat, index) => {
            const colors = ['bg-green-500', 'bg-beveren-600', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
            const color = colors[index % colors.length];
            
            return (
              <div key={stat.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 ${color} rounded`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{stat.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${stat.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {total > 0 ? ((stat.amount / total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-4">
            <div className="flex rounded-lg overflow-hidden h-3">
              {Object.values(paymentStats).map((stat, index) => {
                const colors = ['bg-green-500', 'bg-beveren-600', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                const color = colors[index % colors.length];
                const width = total > 0 ? (stat.amount / total) * 100 : 0;
                
                return (
                  <div
                    key={stat.name}
                    className={color}
                    style={{ width: `${width}%` }}
                  ></div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Close Shift Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Close Shift - Payment Methods</h2>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {Object.values(paymentStats).map((stat) => (
                <div key={stat.name} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{stat.name}</h3>
                    {stat.name.toLowerCase().includes('cash') ? (
                      <div className="text-2xl">💵</div>
                    ) : (
                      <CreditCard className="w-6 h-6 text-beveren-600" />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Opening Amount
                      </label>
                      <div className="text-lg font-medium text-gray-900 dark:text-white">
                        ${stat.openingAmount.toFixed(2)}
                      </div>
                    </div>
                    <div className={hideExpectedAmount ? 'blur-sm' : ''}>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Sales Amount
                      </label>
                      <div className="text-lg font-medium text-green-600">
                        ${stat.amount.toFixed(2)}
                      </div>
                    </div>
                    <div className={hideExpectedAmount ? 'blur-sm' : ''}>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Expected Amount
                      </label>
                      <div className="text-lg font-medium text-blue-600">
                        ${(stat.openingAmount + stat.amount).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Closing Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter closing amount"
                      value={closingAmounts[stat.name] || ''}
                      onChange={(e) => handleClosingAmountChange(stat.name, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {closingAmounts[stat.name] && (
                      <div className="mt-2 text-sm">
                        <span className={`font-medium ${
                          closingAmounts[stat.name] === (stat.openingAmount + stat.amount)
                            ? 'text-green-600'
                            : closingAmounts[stat.name] > (stat.openingAmount + stat.amount)
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}>
                          Difference: ${(closingAmounts[stat.name] - (stat.openingAmount + stat.amount)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalClose}
                disabled={isCreating}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isCreating 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isCreating ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  const renderReturnsTab = () => {
    const returnsData = filteredInvoices.filter(
      (invoice) => invoice.status === "Refunded" || invoice.status === "Cancelled",
    );

    return (
      <div className="space-y-6">
        {renderFilters(true, true)}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Total Returns</h3>
              <RefreshCw className="w-8 h-8 text-orange-600" />
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${returnsData.reduce((sum, inv) => sum + inv.refundAmount, 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{returnsData.length} transactions</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Return Rate</h3>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredInvoices.length > 0 ? ((returnsData.length / filteredInvoices.length) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Of total transactions</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                    Return Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {returnsData.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {invoice.date} {invoice.time}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {invoice.customer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {invoice.cashier}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      ${invoice.refundAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {invoice.notes || "No reason provided"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "invoices":
        return renderInvoicesTab();
      case "cashiers":
        return renderCashiersTab();
      case "payments":
        return renderPaymentsTab();
      case "returns":
        return renderReturnsTab();
      default:
        return renderInvoicesTab();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <RetailSidebar/>
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
<div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
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

        <div className="flex-1 px-6 py-8 mt-16 ml-20 flex flex-col items-center">
        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-beveren-500 text-beveren-600 dark:text-beveren-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {renderContent()}
      </div>

      {/* Invoice View Modal */}
      <InvoiceViewModal
        invoice={selectedInvoice}
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onRefund={handleRefund}
        onCancel={handleCancel}
      />
      </div>
    </div>
  );
}
