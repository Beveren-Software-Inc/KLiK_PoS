import { useState, useMemo, useEffect, useRef } from "react";
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
  Grid3X3,
  List,
  Eye,
  Edit,
  Users,
  RotateCcw,
  Check,
  FileMinus,
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import BottomNavigation from "../components/BottomNavigation";
import MultiInvoiceReturn from "../components/MultiInvoiceReturn";
import SingleInvoiceReturn from "../components/SingleInvoiceReturn";
import SalespersonAuthModal from "../components/dialog/SalespersonAuthModal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { formatCurrencyWithSymbol } from "../utils/currency";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices";
import { useCustomers } from "../hooks/useCustomers";
import { useUserInfo } from "../hooks/useUserInfo";
import { usePOSProfileStore } from "../stores/posProfileStore";
import { useSalespersonStore } from "../stores/salespersonStore";
import { toast } from "react-toastify";
import { extractErrorFromException } from "../utils/errorExtraction";
import { createSalesReturn, retryQueuedInvoice } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";
import PaymentDialog from "../components/dialog/PaymentDialog";
import { addDraftInvoiceToCart } from "../utils/draftInvoiceToCart";
import { loadCachedItemsToCart } from "../utils/draftInvoiceCache";
import { useCartStore } from "../stores/cartStore";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "../utils/time";
import { exportInvoicesToCSV, getExportFilename, type ExportableInvoice } from "../utils/exportUtils";
// import InvoiceViewPage from "./InvoiceViewPage";

const INVOICE_HISTORY_VIEW_MODE_KEY = "invoice-history-view-mode";
const INVOICE_HISTORY_FILTERS_KEY = "invoice-history-filters";

interface InvoiceHistoryFiltersState {
  activeTab: string;
  searchTerm: string;
  dateFilter: string;
  customerFilter: string;
  paymentFilter: string;
  cashierFilter: string;
}

const DEFAULT_INVOICE_HISTORY_FILTERS: InvoiceHistoryFiltersState = {
  activeTab: "all",
  searchTerm: "",
  dateFilter: "all",
  customerFilter: "",
  paymentFilter: "all",
  cashierFilter: "all",
};

const getInitialInvoiceHistoryFilters = (): InvoiceHistoryFiltersState => {
  if (typeof window === "undefined") {
    return DEFAULT_INVOICE_HISTORY_FILTERS;
  }

  try {
    const raw = window.localStorage.getItem(INVOICE_HISTORY_FILTERS_KEY);
    if (!raw) {
      return DEFAULT_INVOICE_HISTORY_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<InvoiceHistoryFiltersState>;
    return {
      ...DEFAULT_INVOICE_HISTORY_FILTERS,
      ...parsed,
      customerFilter: parsed.customerFilter === "all" ? "" : (parsed.customerFilter || ""),
    };
  } catch {
    return DEFAULT_INVOICE_HISTORY_FILTERS;
  }
};

const getInitialViewMode = (): "cards" | "list" => {
  if (typeof window === "undefined") {
    return "list";
  }

  return window.localStorage.getItem(INVOICE_HISTORY_VIEW_MODE_KEY) === "cards"
    ? "cards"
    : "list";
};

export default function InvoiceHistoryPage() {
  const initialFilters = getInitialInvoiceHistoryFilters();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [activeTab, setActiveTab] = useState(initialFilters.activeTab);
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm);
  const [dateFilter, setDateFilter] = useState(initialFilters.dateFilter);
  const [customerFilter, setCustomerFilter] = useState(initialFilters.customerFilter);
  const [paymentFilter, setPaymentFilter] = useState(initialFilters.paymentFilter);
  const [cashierFilter, setCashierFilter] = useState(initialFilters.cashierFilter);
  const [viewMode, setViewMode] = useState<"cards" | "list">(getInitialViewMode);
  const [selectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Multi-Invoice Return states
  const [showCustomerSelection, setShowCustomerSelection] = useState(false);
  const [showMultiReturn, setShowMultiReturn] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");


  // Single Invoice Return states
  const [showSingleReturn, setShowSingleReturn] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SalesInvoice | null>(null);
  const [showDraftPaymentDialog, setShowDraftPaymentDialog] = useState(false);
  const [showSalespersonAuthModal, setShowSalespersonAuthModal] = useState(false);
  const pendingSalespersonActionRef = useRef<null | (() => void)>(null);

  // Skip opening entry filter for Invoice History - show all invoices for cashier regardless of opening entry
  // Pass cashier filter to API so it filters on server side (more efficient)
  const { invoices, isLoading, isLoadingMore, error, hasMore, totalLoaded, totalCount, loadMore, refetch } = useSalesInvoices(searchTerm, true, cashierFilter);
  const { modes } = useAllPaymentModes();
  const { cartItems, selectedCustomer: cartCustomer } = useCartStore();
  const { customers } = useCustomers();
  const { posDetails } = usePOSProfileStore();
  const { activeSalesperson, ensureInitialized } = useSalespersonStore();
  const { userInfo, isLoading: userInfoLoading } = useUserInfo();
  const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required;

  useEffect(() => {
    if (requiresSalespersonPin) {
      void ensureInitialized();
    }
  }, [requiresSalespersonPin, ensureInitialized]);

  const runWithSalespersonGate = (action: () => void | Promise<void>) => {
    if (!requiresSalespersonPin || activeSalesperson) {
      void action();
      return;
    }

    pendingSalespersonActionRef.current = () => {
      void action();
    };
    setShowSalespersonAuthModal(true);
  };

  const handleSalespersonAuthenticated = () => {
    const pendingAction = pendingSalespersonActionRef.current;
    pendingSalespersonActionRef.current = null;
    setShowSalespersonAuthModal(false);
    if (pendingAction) {
      pendingAction();
    }
  };
  
  const canProcessReturns = ![0, "0", false].includes(posDetails?.custom_allow_return as 0 | "0" | false);

  // Role-based filtering
  const isAdminUser = userInfo?.is_admin_user || false;
  const currentUserCashier = userInfo?.full_name || "";

  // Set default cashier filter for non-admin users
  useEffect(() => {
    if (!isAdminUser && currentUserCashier && cashierFilter === "all") {
      setCashierFilter(currentUserCashier);
    }
  }, [isAdminUser, currentUserCashier, cashierFilter]);

  useEffect(() => {
    window.localStorage.setItem(INVOICE_HISTORY_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(
      INVOICE_HISTORY_FILTERS_KEY,
      JSON.stringify({
        activeTab,
        searchTerm,
        dateFilter,
        customerFilter,
        paymentFilter,
        cashierFilter,
      })
    );
  }, [activeTab, searchTerm, dateFilter, customerFilter, paymentFilter, cashierFilter]);

  // Keyboard event handler for Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [showCustomerSelection, showMultiReturn]);

  const tabs = [
    { id: "all", name: "All Invoices", icon: FileText, color: "text-gray-600" },
    { id: "queue_failed", name: "Failed Queue", icon: AlertTriangle, color: "text-rose-600" },
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

    const filtered = invoices.filter((invoice) => {
      // Server-side search is handled by the API, so we only apply client-side filters
      // Normalize status comparison to handle case and whitespace differences
      const invoiceStatus = (invoice.status || "").trim();
      const queueStatus = ((invoice as SalesInvoice & { queueStatus?: string }).queueStatus || "").trim();
      const tabStatus = (activeTab || "").trim();
      const matchesStatus =
        activeTab === "all"
          ? true
          : activeTab === "queue_failed"
            ? queueStatus.toLowerCase() === "failed"
            : invoiceStatus === tabStatus;
      const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter;
      const matchesCustomer = !customerFilter.trim()
        || invoice.customer?.toLowerCase().includes(customerFilter.toLowerCase());
      const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter;
      const matchesDate = filterInvoiceByDate(invoice.date);

      return matchesPayment && matchesCustomer && matchesCashier && matchesStatus && matchesDate;
    });

    // Debug: Log filtering results
    if (activeTab !== "all") {
      console.log(`[InvoiceHistory] Filtering by status "${activeTab}":`, {
        totalInvoices: invoices.length,
        filteredCount: filtered.length,
        activeTab,
        sampleStatuses: invoices.slice(0, 5).map(inv => inv.status)
      });
    }

    return filtered;
  }, [invoices, activeTab, dateFilter, customerFilter, paymentFilter, cashierFilter, isLoading, error, filterInvoiceByDate]);

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

  // Get count for each status - filtered by cashier, date, and payment (but not status)
  // This ensures tab counts reflect the current filter selections
  const getStatusCount = (status: string) => {
    // First apply all filters except status
    const invoicesFilteredByOtherFilters = invoices.filter((invoice) => {
      const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter;
      const matchesCustomer = !customerFilter.trim()
        || invoice.customer?.toLowerCase().includes(customerFilter.toLowerCase());
      const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter;
      const matchesDate = filterInvoiceByDate(invoice.date);
      return matchesPayment && matchesCustomer && matchesCashier && matchesDate;
    });

    // Then count by status - normalize comparison
    if (status === "all") {
      return invoicesFilteredByOtherFilters.length;
    }
    if (status === "queue_failed") {
      return invoicesFilteredByOtherFilters.filter(invoice => {
        const queueStatus = ((invoice as SalesInvoice & { queueStatus?: string }).queueStatus || "").trim();
        return queueStatus.toLowerCase() === "failed";
      }).length;
    }
    const normalizedStatus = (status || "").trim();
    return invoicesFilteredByOtherFilters.filter(invoice => {
      const invoiceStatus = (invoice.status || "").trim();
      return invoiceStatus === normalizedStatus;
    }).length;
  };

  // Loading state - only block if nothing loaded yet
  if ((isLoading && invoices.length === 0) || userInfoLoading) {
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
           {/* @ts-expect-error just ignore */}
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
    <div className="w-full max-w-none bg-white/95 dark:bg-gray-800/95 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-4 backdrop-blur">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
          />
          {isLoading && invoices.length > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-b-transparent border-beveren-500 rounded-full"></div>
            </div>
          )}
        </div>
        <input
          type="text"
          placeholder="Filter customer..."
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
        />
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
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
          disabled={!isAdminUser}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white ${
            !isAdminUser ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <option value="all">All Cashiers</option>
          {uniqueCashiers.map((cashier) => (
            <option key={cashier} value={cashier}>
              {cashier}
            </option>
          ))}
        </select>
        {!isAdminUser && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Showing only your transactions</p>
        )}
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
        >
          <option value="all">All Payments</option>
          {modes.map((mode) => (
            <option key={mode.name} value={mode.name}>
              {mode.name}
            </option>
          ))}
        </select>
      </div>
        {hasMore && (
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Search works on all invoices in the database. Load more invoices to see additional results.
            </p>
          </div>
        )}
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
          <table className="w-full table-auto">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th className="px-6 py-3 w-48 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cashier
                </th>
                <th className="px-6 py-3 w-40 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                <th className="px-6 py-3 sticky right-0 z-10 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredInvoices.map((invoice) => (
                <tr key={`${activeTab}-${invoice.id}`} className="group hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{invoice.date}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{invoice.time}</div>
                  </td>
                  <td className="px-6 py-4 max-w-[12rem]">
                    <div title={invoice.customer} className="block truncate text-sm text-gray-900 dark:text-white">{invoice.customer}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {invoice.cashier}
                  </td>
                  <td className="px-6 py-4 max-w-[10rem]">
                    <span title={invoice.paymentMethod} className="block truncate text-sm text-gray-900 dark:text-white">{invoice.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrencyWithSymbol(invoice.totalAmount, invoice.currency)}
                    </div>
                    {invoice.giftCardDiscount > 0 && (
                      <div className="text-xs text-orange-600 dark:text-green-400">
                        -{formatCurrencyWithSymbol(invoice.giftCardDiscount, invoice.currency)} gift card
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                  </td>
                  {posDetails?.is_zatca_enabled && (
                    <td className="px-6 py-4 whitespace-nowrap">
                                  {/* @ts-expect-error just ignore */}
                      <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{invoice.custom_zatca_submit_status}</span>
                    </td>
                  )}
                  <td className="px-6 py-4 sticky right-0 z-10 whitespace-nowrap bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700 text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                      {invoice.status === "Draft" && (
                        <>
                          <button
                            onClick={() => void handleGoToCart(invoice)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => void handleSubmitDirect(invoice)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 flex items-center space-x-1"
                          >
                            <Check className="w-4 h-4" />
                            <span>Submit</span>
                          </button>
                        </>
                      )}
                      {/* @ts-expect-error just ignore */}
                      {canProcessReturns && ["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems(invoice) && (

                        <button
                          onClick={() => handleSingleReturnClick(invoice)}
                          className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Return</span>
                        </button>
                      )}

                      {((invoice as SalesInvoice & { queueStatus?: string }).queueStatus || "").toLowerCase() === "failed" && (
                        <button
                          onClick={() => handleRetryQueue(invoice)}
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Retry</span>
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
              key={`${activeTab}-${invoice.id}`}
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
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyWithSymbol(invoice.totalAmount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Date:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.date}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Cashier:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.cashier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">POS Profile:</span>
                  <span className="text-gray-900 dark:text-white">{invoice.posProfile}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleViewInvoice(invoice)}
                  className="flex-1 text-xs px-3 py-2 bg-beveren-600 text-white rounded hover:bg-beveren-700 transition-colors"
                >
                  View
                </button>
                {invoice.status === "Draft" && (
                  <>
                    <button
                      onClick={() => void handleGoToCart(invoice)}
                      className="flex-1 text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => void handleSubmitDirect(invoice)}
                      className="flex-1 text-xs px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Submit</span>
                    </button>
                  </>
                )}
                  {canProcessReturns && ["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && hasReturnableItems(invoice) && (
                  <button
                    onClick={() => handleSingleReturnClick(invoice)}
                    className="flex-1 text-xs px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                  >
                    Return
                  </button>
                )}
                {((invoice as SalesInvoice & { queueStatus?: string }).queueStatus || "").toLowerCase() === "failed" && (
                  <button
                    onClick={() => handleRetryQueue(invoice)}
                    className="flex-1 text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isLoadingMore
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-beveren-600 text-white hover:bg-beveren-700'
            }`}
          >
            {isLoadingMore ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </div>
            ) : (
              `Load More (${totalLoaded}/${totalCount})`
            )}
          </button>
        </div>
      )}

      {/* Show message when all invoices are loaded */}
      {!hasMore && totalLoaded > 0 && (
        <div className="text-center mt-8 py-4">
          <p className="text-gray-600 dark:text-gray-400">
            {filteredInvoices.length > 0
              ? `Showing ${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? 's' : ''} (${totalLoaded} total loaded)`
              : `All ${totalCount} invoices loaded`
            }
          </p>
        </div>
      )}
    </div>
  );

  const handleViewInvoice = (invoice: SalesInvoice) => {
    navigate(`/invoice/${invoice.id}`);
  };


    // Helper function to check if invoice has items that can still be returned
  const hasReturnableItems = (invoice: SalesInvoice) => {
    if (!invoice || !invoice.items) {
      console.log("No invoice or items found for:", invoice?.id);
      return false;
    }

    // Use the canReturn property set by background return data loading
    // @ts-expect-error just ignore
    if (invoice.canReturn !== undefined) {
      //@ts-expect-error just ignore
      return invoice.canReturn;
    }

    // Fallback to old logic if canReturn is not set yet
    const hasReturnable = invoice.items.some(item => {
      const soldQty = item.qty || item.quantity || 0;
      const returnedQty = item.returned_qty || 0;
      const canReturn = returnedQty < soldQty;
      return canReturn;
    });

    return hasReturnable;
  };

  const handleGoToCart = async (invoice: SalesInvoice) => {
    const draftInvoiceId = invoice.id || invoice.name;
    if (!draftInvoiceId) {
      toast.error("Unable to edit draft invoice: missing invoice identifier");
      return;
    }

    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(() => handleGoToCart(invoice));
      return;
    }

    try {
      const success = await addDraftInvoiceToCart(draftInvoiceId);
      if (success) {
        setTimeout(() => {
          navigate('/pos'); // Navigate directly to POS page
        }, 500);
      }
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error going to cart:", error);
      toast.error(error.message || "Failed to add items to cart");
    }
  };

  const handleSubmitDirect = async (invoice: SalesInvoice) => {
    const draftInvoiceId = invoice.id || invoice.name;
    if (!draftInvoiceId) {
      toast.error("Unable to submit draft invoice: missing invoice identifier");
      return;
    }

    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(() => handleSubmitDirect(invoice));
      return;
    }

    try {
      const success = await addDraftInvoiceToCart(draftInvoiceId);
      if (success) {
        await loadCachedItemsToCart();
        setShowDraftPaymentDialog(true);
      }
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error opening payment dialog for draft invoice:", error);
      const errorMessage = extractErrorFromException(error, "Failed to load invoice for payment");
      toast.error(errorMessage);
    }
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId);
    setShowInvoiceModal(false);
  };

  const handleReturnClick = async (invoiceName: string) => {
    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(() => handleReturnClick(invoiceName));
    }

    if (!canProcessReturns) {
      toast.error("Returns are disabled for this POS Profile");
      return;
    }

    try {
      const result = await createSalesReturn(invoiceName);

      navigate(`/invoice/${result.return_invoice}`)
      toast.success(`Invoice returned: ${result.return_invoice}`);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || "Failed to return invoice");
    }
  };

  const handleRetryQueue = async (invoice: SalesInvoice) => {
    try {
      await retryQueuedInvoice(invoice.id);
      toast.success(`Queued invoice ${invoice.id} sent back to the background worker`);
      window.location.reload();
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.message || "Failed to retry queued invoice");
    }
  };

  const handleCancel = (invoiceId: string) => {
    console.log("Cancelling invoice:", invoiceId);
    setShowInvoiceModal(false);
  };

      // Multi-Invoice Return handlers
    const handleMultiReturnClick = () => {
      if (requiresSalespersonPin && !activeSalesperson) {
        runWithSalespersonGate(handleMultiReturnClick);
      }
        
      if (!canProcessReturns) {
        toast.error("Returns are disabled for this POS Profile");
        return;
      }

      setSelectedCustomer("");
      setShowMultiReturn(true);
    };

    // Single Invoice Return handlers
    const handleSingleReturnClick = (invoice: SalesInvoice) => {
      if (requiresSalespersonPin && !activeSalesperson) {
        runWithSalespersonGate(() => handleSingleReturnClick(invoice));
      }
      if (!canProcessReturns) {
        toast.error("Returns are disabled for this POS Profile");
        return;
      }

      setSelectedInvoiceForReturn(invoice);
      setShowSingleReturn(true);
    };

    const handleSingleReturnSuccess = () => {
      setShowSingleReturn(false);
      setSelectedInvoiceForReturn(null);
      refetch();
    };


  const handleCustomerSelect = (customer: string) => {
    if (!customer) {
      toast.error("Invalid customer selection");
      return;
    }
    setSelectedCustomer(customer);
    setShowCustomerSelection(false);
    setCustomerSearchQuery("");
    setShowMultiReturn(true);
  };

  const handleMultiReturnSuccess = () => {
    // toast.success(`Created ${returnInvoices.length} return invoices successfully`);
    setShowMultiReturn(false);
    setSelectedCustomer("");
  };

  const handleCloseCustomerSelection = () => {
    setShowCustomerSelection(false);
    setCustomerSearchQuery("");
  };

  // Export functionality
  const handleExportInvoices = () => {
    try {
      if (!filteredInvoices || filteredInvoices.length === 0) {
        toast.error("No invoices to export");
        return;
      }

      // Convert invoices to exportable format
      const exportableInvoices: ExportableInvoice[] = filteredInvoices.map(invoice => {
        // Calculate outstanding amount: grand total - amount paid
        const grandTotal = invoice.totalAmount || 0;
        const amountPaid = invoice.amountPaid || 0;
        const outstandingAmount = Math.max(0, grandTotal - amountPaid);

        return {
          name: invoice.id || invoice.name || '',
          customer: invoice.customer || '',
          posting_date: invoice.date || invoice.posting_date || '',
          due_date: '', // Due date is not available in the current data structure
          grand_total: grandTotal,
          outstanding_amount: outstandingAmount,
          status: invoice.status || '',
          mode_of_payment: invoice.paymentMethod || '',
          currency: invoice.currency || 'SAR',
          company: invoice.company || ''
        };
      });

      // Generate filename based on current filters
      const tabName = activeTab === "all" ? "all" : activeTab.toLowerCase();
      const filename = getExportFilename(`invoices_${tabName}`, 'csv');

      // Export to CSV
      exportInvoicesToCSV(exportableInvoices, filename);

      toast.success(`Exported ${exportableInvoices.length} invoices successfully`);
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Failed to export invoices: ${error.message}`);
    }
  };

  // Mobile layout: full-width content and persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 font-inconsolata">
        {/* Mobile Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Invoice History</h1>
              <div className="flex items-center space-x-2">
                {canProcessReturns && <button
                    onClick={handleMultiReturnClick}
                    className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  >
                  <Users className="w-4 h-4" />
                  <span>Multi Return</span>
                </button>}
                <button
                  onClick={handleExportInvoices}
                  className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur pb-2">
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
          </div>
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
          // @ts-expect-error just ignore
          customers={customers}
        />


        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    );
  }



  return (

    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex pb-12">
      <div className="flex-1 flex flex-col overflow-visible ml-20">
        {/* Header */}
        <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice History</h1>
              </div>
              <div className="flex items-center space-x-3">
                {canProcessReturns && <button
                  onClick={handleMultiReturnClick}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <FileMinus className="w-4 h-4" />
                  <span>Multi-Invoice Return</span>
                </button>}
                <button
                  onClick={handleExportInvoices}
                  className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-8 mt-16 max-w-none">
          <div className="sticky top-20 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur pb-2">
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
          </div>

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
          // @ts-expect-error just ignore
          customers={customers}
        />


        {/* Single Invoice Return Modal */}
        <SingleInvoiceReturn
          invoice={selectedInvoiceForReturn}
          isOpen={showSingleReturn}
          onClose={() => setShowSingleReturn(false)}
          onSuccess={handleSingleReturnSuccess}
        />
        <SalespersonAuthModal
          isOpen={showSalespersonAuthModal}
          onClose={() => {
            setShowSalespersonAuthModal(false);
            pendingSalespersonActionRef.current = null;
          }}
          onAuthenticated={handleSalespersonAuthenticated}
          allowDismiss
          title="Verify salesperson"
          description="Verify the salesperson before continuing this invoice action."
        />

        {showDraftPaymentDialog && (
          <PaymentDialog
            isOpen={showDraftPaymentDialog}
            onClose={(paymentCompleted) => {
              setShowDraftPaymentDialog(false);
              if (paymentCompleted) refetch();
            }}
            cartItems={cartItems}
            appliedCoupons={[]}
            selectedCustomer={cartCustomer}
            onCompletePayment={() => {
              setShowDraftPaymentDialog(false);
              refetch();
            }}
            onHoldOrder={() => setShowDraftPaymentDialog(false)}
            isMobile={false}
            isFullPage={false}
          />
        )}
      </div>
    </div>
  );
}
