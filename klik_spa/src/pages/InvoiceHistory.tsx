import { useState, useMemo, useEffect } from "react";
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
  Users,
  RotateCcw,
  ShoppingCart,
  CreditCard,
  Send,
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import BottomNavigation from "../components/BottomNavigation";
import MultiInvoiceReturn from "../components/MultiInvoiceReturn";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices";
import { useCustomers } from "../hooks/useCustomers";
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import RetailSidebar from "../components/RetailSidebar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
// import InvoiceViewPage from "./InvoiceViewPage";

export default function InvoiceHistoryPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Multi-Invoice Return states
  const [showCustomerSelection, setShowCustomerSelection] = useState(false);
  const [showMultiReturn, setShowMultiReturn] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Draft Invoice Edit states
  const [showEditOptions, setShowEditOptions] = useState(false);
  const [selectedDraftInvoice, setSelectedDraftInvoice] = useState<SalesInvoice | null>(null);

  const { invoices, isLoading, error } = useSalesInvoices();
  const { modes } = useAllPaymentModes();
  const { customers } = useCustomers();

  // Keyboard event handler for Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showEditOptions) {
          handleCloseEditOptions();
        }
        if (showCustomerSelection) {
          setShowCustomerSelection(false);
        }
        if (showMultiReturn) {
          setShowMultiReturn(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showEditOptions, showCustomerSelection, showMultiReturn]);

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

    // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];

    // First, filter out customers with invalid data
    const validCustomers = customers.filter(customer =>
      customer && (customer.customer_name || customer.name)
    );

    if (!customerSearchQuery.trim()) return validCustomers;

    const query = customerSearchQuery.toLowerCase();
    return validCustomers.filter(customer => {
      // Safely handle potentially undefined values
      const customerName = customer.customer_name?.toLowerCase() || '';
      const customerCode = customer.name?.toLowerCase() || '';

      return customerName.includes(query) || customerCode.includes(query);
    });
  }, [customers, customerSearchQuery]);

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

  // Define render functions before they are used
  const renderFilters = () => (
    <div className="w-full max-w-none bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
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
    <div className="w-full max-w-none grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
    <div className="w-full max-w-none bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                  Zatca Status
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{invoice.custom_zatca_submit_status}</span>
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
                          onClick={() => handleEditInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      )}
                      {/* {invoice.status === "Paid" && (
                        <ConfirmDialog
                            title="Process Return?"
                            description="Are you sure you want to process a return for this invoice?"
                            onConfirm={() => handleRefund(invoice.id)}
                            trigger={
                            <button
                                className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                            >
                                <RefreshCw size={20} />
                                <span>Return</span>
                            </button>
                            }
                        />
                      )} */}

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
                    onClick={() => handleEditInvoice(invoice)}
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

  // Define handler functions before they are used
  const handleViewInvoice = (invoice: SalesInvoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

  const handleEditInvoice = (invoice: SalesInvoice) => {
    setSelectedDraftInvoice(invoice);
    setShowEditOptions(true);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      toast.success("Invoice deleted successfully");
    }
  };

  const handleRefund = (invoiceId: string) => {
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

  // Multi-Invoice Return handlers
  const handleMultiReturnClick = () => {
    setCustomerSearchQuery(""); // Reset search when opening
    setShowCustomerSelection(true);
  };

    // Draft Invoice Edit Option handlers
  const handleGoToCart = () => {
    // Go back to the main POS cart page to edit/modify items
    navigate('/pos');
    setShowEditOptions(false);
    setSelectedDraftInvoice(null);
  };

  const handleGoToPayment = () => {
    // Go back to the main POS cart page where they can use the normal payment flow
    navigate('/pos');
    setShowEditOptions(false);
    setSelectedDraftInvoice(null);
    // Show a helpful message
    toast.info('Navigate to the cart and use the Checkout button to process payment');
  };

  const handleSubmitInvoice = async () => {
    if (selectedDraftInvoice) {
      try {
        // Here you would call the API to submit the draft invoice
        // For now, we'll just show a success message and refresh
        toast.success(`Invoice ${selectedDraftInvoice.id} submitted successfully`);
        // You might want to refresh the invoices list here
      } catch (error: any) {
        toast.error(error.message || "Failed to submit invoice");
      }
    }
    setShowEditOptions(false);
    setSelectedDraftInvoice(null);
  };

  const handleCloseEditOptions = () => {
    setShowEditOptions(false);
    setSelectedDraftInvoice(null);
  };

  const handleCustomerSelect = (customer: string) => {
    if (!customer) {
      toast.error("Invalid customer selection");
      return;
    }
    setSelectedCustomer(customer);
    setShowCustomerSelection(false);
    setCustomerSearchQuery(""); // Reset search
    setShowMultiReturn(true);
  };

  const handleMultiReturnSuccess = (returnInvoices: string[]) => {
    toast.success(`Created ${returnInvoices.length} return invoices successfully`);
    setShowMultiReturn(false);
    setSelectedCustomer("");
  };

  const handleCloseCustomerSelection = () => {
    setShowCustomerSelection(false);
    setCustomerSearchQuery(""); // Reset search when closing
  };

  // Mobile layout: full-width content and persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Invoice History</h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleMultiReturnClick}
                  className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                >
                  <Users className="w-4 h-4" />
                  <span>Multi Return</span>
                </button>
                <button className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors text-sm">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          {/* Status Tabs */}
          <div className="mb-6 w-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-xs whitespace-nowrap ${
                        activeTab === tab.id
                          ? "border-beveren-500 text-beveren-600 dark:text-beveren-400"
                          : `border-transparent ${tab.color} dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300`
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.name}</span>
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                        {getStatusCount(tab.id)}
                      </span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {renderFilters()}
          {renderSummaryCards()}
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

        {/* Customer Selection Modal */}
        {showCustomerSelection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Customer</h2>
                  <button
                    onClick={handleCloseCustomerSelection}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose a customer to process multi-invoice returns
                </p>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search customers by name or ID..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Customer List */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  {filteredCustomers && filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.name || customer.customer_name || Math.random()}
                        onClick={() => handleCustomerSelect(customer.name || customer.customer_name)}
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
                {filteredCustomers && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {customerSearchQuery.trim()
                        ? `${filteredCustomers.length} of ${customers?.length || 0} customers`
                        : `${customers?.length || 0} customers total`
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Multi-Invoice Return Modal */}
        <MultiInvoiceReturn
          customer={selectedCustomer}
          isOpen={showMultiReturn}
          onClose={() => setShowMultiReturn(false)}
          onSuccess={handleMultiReturnSuccess}
        />

        {/* Draft Invoice Edit Options Modal */}
        {showEditOptions && selectedDraftInvoice && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md relative">
              {/* Click outside to close */}
              <div
                className="absolute inset-0 -z-10"
                onClick={handleCloseEditOptions}
              />
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Draft Invoice</h2>
                  <button
                    onClick={handleCloseEditOptions}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Invoice: {selectedDraftInvoice.id}
                </p>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  What would you like to do with this draft invoice?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleGoToCart}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">Go to Cart</span>
                  </button>
                  <button
                    onClick={handleGoToPayment}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-900 dark:text-green-100">Payment</span>
                  </button>
                  <button
                    onClick={handleSubmitInvoice}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  >
                    <Send className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-purple-900 dark:text-purple-100">Submit Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    );
  }



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
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleMultiReturnClick}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>Multi-Invoice Return</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 mt-16 ml-0 max-w-none">
          {/* Status Tabs - Now full width like the table */}
          <div className="mb-8 w-full max-w-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
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

        {/* Customer Selection Modal */}
        {showCustomerSelection && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select Customer</h2>
                  <button
                    onClick={handleCloseCustomerSelection}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-hidden flex flex-col">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose a customer to process multi-invoice returns
                </p>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search customers by name or ID..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Customer List */}
                <div className="flex-1 overflow-y-auto space-y-2">
                  {filteredCustomers && filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.name || customer.customer_name || Math.random()}
                        onClick={() => handleCustomerSelect(customer.name || customer.customer_name)}
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
                {filteredCustomers && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {customerSearchQuery.trim()
                        ? `${filteredCustomers.length} of ${customers?.length || 0} customers`
                        : `${customers?.length || 0} customers total`
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Multi-Invoice Return Modal */}
        <MultiInvoiceReturn
          customer={selectedCustomer}
          isOpen={showMultiReturn}
          onClose={() => setShowMultiReturn(false)}
          onSuccess={handleMultiReturnSuccess}
        />

        {/* Draft Invoice Edit Options Modal */}
        {showEditOptions && selectedDraftInvoice && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md relative">
              {/* Click outside to close */}
              <div
                className="absolute inset-0 -z-10"
                onClick={handleCloseEditOptions}
              />
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Draft Invoice</h2>
                  <button
                    onClick={handleCloseEditOptions}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Invoice: {selectedDraftInvoice.id}
                </p>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  What would you like to do with this draft invoice?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleGoToCart}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">Go to Cart</span>
                  </button>
                  <button
                    onClick={handleGoToPayment}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-900 dark:text-green-100">Payment</span>
                  </button>
                  <button
                    onClick={handleSubmitInvoice}
                    className="w-full flex items-center justify-center space-x-3 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  >
                    <Send className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-purple-900 dark:text-purple-100">Submit Invoice</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
