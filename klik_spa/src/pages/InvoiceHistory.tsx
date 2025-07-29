import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FilePlus,
  RefreshCw,
  Download,
  Search,
  DollarSign,
  Grid3X3,
  List,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices";
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import RetailSidebar from "../components/RetailSidebar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
// import InvoiceViewPage from "./InvoiceViewPage";

export default function InvoiceHistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const { invoices, isLoading, error } = useSalesInvoices();
  const { modes } = useAllPaymentModes();

  const tabs = [
    { id: "all", name: "All Invoices", icon: FileText, color: "text-gray-600" },
    { id: "Draft", name: "Draft", icon: FilePlus, color: "text-gray-500" },
    { id: "Unpaid", name: "Unpaid", icon: Clock, color: "text-yellow-600" },
    { id: "Partly Paid", name: "Partly Paid", icon: AlertTriangle, color: "text-orange-600" },
    { id: "Paid", name: "Paid", icon: CheckCircle, color: "text-green-600" },
    { id: "Overdue", name: "Overdue", icon: XCircle, color: "text-red-600" },
    { id: "Return", name: "Returns", icon: RefreshCw, color: "text-purple-600" },
    { id: "Cancelled", name: "Cancelled", icon: XCircle, color: "text-red-500" },
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
      startOfWeek.setDate(today.getDate() - today.getDay());
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
      case "Paid":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "Unpaid":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "Partly Paid":
        return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      case "Overdue":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "Draft":
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`;
      case "Return":
        return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400`;
      case "Cancelled":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return baseClasses;
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

      const matchesStatus = activeTab === "all" || invoice.status === activeTab;
      const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter;
      const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter;
      const matchesDate = filterInvoiceByDate(invoice.date);

      return matchesSearch && matchesPayment && matchesCashier && matchesStatus && matchesDate;
    });
  }, [invoices, searchQuery, activeTab, dateFilter, paymentFilter, cashierFilter, isLoading, error]);

  const uniqueCashiers = useMemo(() => {
    return [...new Set(invoices.map(invoice => invoice.cashier).filter(Boolean))];
  }, [invoices]);

  // Get count for each status
  const getStatusCount = (status: string) => {
    if (status === "all") return invoices.length;
    return invoices.filter(invoice => invoice.status === status).length;
  };

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
    // setSelectedInvoice(invoice);
    // setShowInvoiceModal(true);
    navigate(`/invoice/${invoice.id}`);

  };

  const handleEditInvoice = (invoiceId: string) => {
    navigate(`/retail/invoices/edit/${invoiceId}`);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      console.log("Deleting invoice:", invoiceId);
      toast.success("Invoice deleted successfully");
    }
  };

  const handleRefund = (invoiceId: string) => {
    console.log("Processing refund for:", invoiceId);
    handleReturnClick(invoiceId);
    setShowInvoiceModal(false);
  };

  const handleReturnClick = async (invoiceName: string) => {
    try {
      const result = await createSalesReturn(invoiceName);
      navigate(`/invoice/${result.return_invoice}`)
      toast.success(`Invoice returned: ${result.return_invoice}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to return invoice");
    }
  };

  const handleCancel = (invoiceId: string) => {
    console.log("Cancelling invoice:", invoiceId);
    setShowInvoiceModal(false);
  };

  const renderFilters = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search invoices..."
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
  );

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Paid Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${filteredInvoices
                .filter(inv => inv.status === "Paid")
                .reduce((sum, inv) => sum + inv.totalAmount, 0)
                .toFixed(2)}
            </p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${filteredInvoices
                .filter(inv => ["Unpaid", "Partly Paid", "Overdue"].includes(inv.status))
                .reduce((sum, inv) => sum + inv.totalAmount, 0)
                .toFixed(2)}
            </p>
          </div>
          <AlertTriangle className="w-8 h-8 text-orange-600" />
        </div>
      </div>
    </div>
  );

  const renderInvoicesTable = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {activeTab === "all" ? "All Invoices" : tabs.find(t => t.id === activeTab)?.name} ({filteredInvoices.length})
        </h3>
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
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
        </div>
      </div>

      {viewMode === "list" ? (
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
                      {invoice.status === "Draft" && (
                        <button
                          onClick={() => handleEditInvoice(invoice.id)}
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      )}
                      {invoice.status === "Paid" && (
                        <ConfirmDialog
                            title="Process Return?"
                            description="Are you sure you want to process a return for this invoice?"
                            onConfirm={() => handleReturn(invoice.name)}
                            trigger={
                            <button
                                className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                            >
                                <RefreshCw size={20} />
                                <span>Return</span>
                            </button>
                            }
                        />
                      )}
                      {["Draft", "Unpaid"].includes(invoice.status) && (
                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Customer:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.customer}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-medium text-gray-900 dark:text-white">${invoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.date}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Cashier:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.cashier}</span>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => handleViewInvoice(invoice)}
                  className="flex-1 text-xs px-3 py-2 bg-beveren-600 text-white rounded hover:bg-beveren-700 transition-colors"
                >
                  View
                </button>
                {invoice.status === "Draft" && (
                  <button
                    onClick={() => handleEditInvoice(invoice.id)}
                    className="flex-1 text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <RetailSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice History</h1>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 mt-16 ml-20">
          {/* Status Tabs */}
          <div className="mb-8">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-beveren-500 text-beveren-600 dark:text-beveren-400"
                        : `border-transparent ${tab.color} dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300`
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                      {getStatusCount(tab.id)}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Filters */}
          {renderFilters()}

          {/* Summary Cards */}
          {renderSummaryCards()}

          {/* Invoices Table/Grid */}
          {renderInvoicesTable()}
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