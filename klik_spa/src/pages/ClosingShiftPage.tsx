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
  MonitorX
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices"
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import RetailSidebar from "../components/RetailSidebar";

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

  const { invoices, isLoading, error } = useSalesInvoices(); 
  const { modes } = useAllPaymentModes()


  const tabs = [
    { id: "invoices", name: "All Invoices", icon: FileText },
    { id: "cashiers", name: "Cashier Sales", icon: Users },
    { id: "payments", name: "Payment Methods", icon: CreditCard },
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
        {showCashierFilter && (
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Cashiers</option>
            {uniqueCashiers.map((cashier) => (
              <option key={cashier} value={cashier}>
                {cashier}
              </option>
            ))}
          </select>
        )}
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

  const renderPaymentsTab = () => {
    const paymentStats = filteredInvoices.reduce(
      (acc, invoice) => {
        if (invoice.paymentMethod === "Cash") {
          acc.cash.amount += invoice.totalAmount;
          acc.cash.transactions += 1;
        } else {
          acc.card.amount += invoice.totalAmount;
          acc.card.transactions += 1;
        }
        acc.giftCards.amount += invoice.giftCardDiscount;
        if (invoice.giftCardDiscount > 0) {
          acc.giftCards.transactions += 1;
        }
        return acc;
      },
      {
        cash: { amount: 0, transactions: 0 },
        card: { amount: 0, transactions: 0 },
        giftCards: { amount: 0, transactions: 0 },
      },
    );

    const total = paymentStats.cash.amount + paymentStats.card.amount;

    return (
      <div className="space-y-6">
        {renderFilters(true, false)}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Cash Payments</h3>
              <div className="text-2xl">💵</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${paymentStats.cash.amount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {paymentStats.cash.transactions} transactions
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {total > 0 ? ((paymentStats.cash.amount / total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Card Payments</h3>
              <CreditCard className="w-8 h-8 text-beveren-600" />
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ${paymentStats.card.amount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {paymentStats.card.transactions} transactions
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {total > 0 ? ((paymentStats.card.amount / total) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Gift Cards Used</h3>
              <div className="text-2xl">🎁</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ${paymentStats.giftCards.amount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {paymentStats.giftCards.transactions} transactions
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Customer savings</div>
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Payment Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Cash</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-white">
                  ${paymentStats.cash.amount.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {total > 0 ? ((paymentStats.cash.amount / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-beveren-600 rounded"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Debit Card</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-white">
                  ${paymentStats.card.amount.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {total > 0 ? ((paymentStats.card.amount / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex rounded-lg overflow-hidden h-3">
                <div
                  className="bg-green-500"
                  style={{ width: `${total > 0 ? (paymentStats.cash.amount / total) * 100 : 0}%` }}
                ></div>
                <div
                  className="bg-beveren-600"
                  style={{ width: `${total > 0 ? (paymentStats.card.amount / total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
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
            <button className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
              <MonitorX className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 mt-15 ml-20">
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
