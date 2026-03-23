import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  Search,
  Eye,
  MonitorX,
  X,
  RotateCcw,
  AlertCircle
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import SingleInvoiceReturn from "../components/SingleInvoiceReturn";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices"
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import { useAllPaymentModes } from "../hooks/usePaymentModes";

import { usePOSDetails } from "../hooks/usePOSProfile";
import { useCreatePOSClosingEntry } from "../services/closingEntry";
import BottomNavigation from "../components/BottomNavigation";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { deleteDraftInvoice } from "../services/salesInvoice";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { formatCurrency } from "../utils/currency";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "../utils/time";
import { clearAllCache } from "../utils/clearCache";
import { useI18n } from "../hooks/useI18n";

export default function ClosingShiftPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const { tl, translateValue } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingAmounts, setClosingAmounts] = useState<Record<string, number>>({});

  // Draft Invoice Edit states
  // const [showEditOptions, setShowEditOptions] = useState(false);
  // const [selectedDraftInvoice, setSelectedDraftInvoice] = useState<SalesInvoice | null>(null);

  // Single Invoice Return states
  const [showSingleReturn, setShowSingleReturn] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SalesInvoice | null>(null);
  const { createClosingEntry, isCreating } = useCreatePOSClosingEntry();

  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null);

  const { invoices, isLoading,  error,  } = useSalesInvoices();
  const { modes, isLoading: modesLoading, error: modesError } = useAllPaymentModes()
  const { posDetails } = usePOSDetails();


  const hideExpectedAmount = posDetails?.custom_hide_expected_amount || false;

  const filterInvoiceByDate = useCallback((invoiceDateStr: string) => {
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
  }, [dateFilter]);

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    const normalized = status?.toLowerCase() || "";

    switch (normalized) {
      // Payment statuses
      case "paid":
        return `${baseClasses} border border-emerald-100 bg-emerald-50 text-emerald-700`;
      case "unpaid":
        return `${baseClasses} border border-amber-100 bg-amber-50 text-amber-700`;
      case "partly paid":
        return `${baseClasses} border border-orange-100 bg-orange-50 text-orange-700`;
      case "overdue":
        return `${baseClasses} border border-rose-100 bg-rose-50 text-rose-700`;
      case "draft":
        return `${baseClasses} border border-slate-200 bg-slate-100 text-slate-700`;
      case "return":
        return `${baseClasses} border border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700`;
      case "cancelled":
        return `${baseClasses} border border-rose-100 bg-rose-50 text-rose-700`;

      // ZATCA submission statuses
      case "pending":
        return `${baseClasses} border border-amber-100 bg-amber-50 text-amber-700`;
      case "reported":
        return `${baseClasses} border border-sky-100 bg-sky-50 text-sky-700`;
      case "not reported":
        return `${baseClasses} border border-slate-200 bg-slate-100 text-slate-700`;
      case "cleared":
        return `${baseClasses} border border-emerald-100 bg-emerald-50 text-emerald-700`;
      case "not cleared":
        return `${baseClasses} border border-rose-100 bg-rose-50 text-rose-700`;

      default:
        return `${baseClasses} border border-slate-200 bg-slate-100 text-slate-700`; // Neutral fallback
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

  }, [invoices, searchQuery, statusFilter, paymentFilter, isLoading, error, posDetails, filterInvoiceByDate]);


  // Payment Stats Calculation - Calculate from filtered invoices
  const paymentStats = useMemo(() => {
    if (!modes || modes.length === 0) {
      return {};
    }

    const stats = modes.reduce((acc, mode) => {
      // @ts-expect-error just ignore for now
      acc[mode.name] = {
        name: mode.name,
        openingAmount: mode.openingAmount || 0,
        amount: 0,
        transactions: 0
      };
      return acc;
    }, {});

    // Calculate amounts and transactions from filtered invoices
    filteredInvoices.forEach(invoice => {
      // Check if invoice has multiple payment methods
      if (invoice.payment_methods && Array.isArray(invoice.payment_methods)) {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        invoice.payment_methods.forEach((payment: any) => {
                // @ts-expect-error just ignore for now
          if (stats[payment.mode_of_payment]) {
            const isReturn = invoice.status === "Return";
            const amount = isReturn ? -Math.abs(payment.amount || 0) : (payment.amount || 0);
      // @ts-expect-error just ignore for now
            stats[payment.mode_of_payment].amount += amount;

      // @ts-expect-error just ignore for now
            if (invoice.payment_methods.indexOf(payment) === 0) {
                    // @ts-expect-error just ignore for now
              stats[payment.mode_of_payment].transactions += 1;
            }
          }
        });
      } else {
      // @ts-expect-error just ignore for now
        if (invoice.paymentMethod && stats[invoice.paymentMethod]) {
          // For return invoices, ensure the amount is subtracted (negative)
          const isReturn = invoice.status === "Return";
          const amount = isReturn ? -Math.abs(invoice.totalAmount || 0) : (invoice.totalAmount || 0);
      // @ts-expect-error just ignore for now
          stats[invoice.paymentMethod].amount += amount;
                // @ts-expect-error just ignore for now
          stats[invoice.paymentMethod].transactions += 1;
        }
      }
    });

    // Add opening amounts to the total amounts for each payment method
    Object.keys(stats).forEach(methodName => {
            // @ts-expect-error just ignore for now
      stats[methodName].amount += stats[methodName].openingAmount;
    });

    return stats;
  }, [modes, filteredInvoices]);
      // @ts-expect-error just ignore for now
  const total = Object.values(paymentStats).reduce((sum, stat) => sum + stat.amount, 0);

  // Loading state
  if (isLoading || modesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{tl("Loading invoices and payment modes...")}</p>
        </div>
      </div>
    );
  }

  // Error state - but allow closing shift even without opening entry
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{tl("Error loading data")}</h3>
                                {/* @ts-expect-error just ignore */}
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{tl("Invoices: {{error}}", { error: error.message })}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            {tl("Retry")}
          </button>
        </div>
      </div>
    );
  }

  // Show warning if no opening entry but allow proceeding
  const hasNoOpeningEntry = modesError && modesError.includes("No open POS Opening Entry found");

  const handleViewInvoice = (invoice: SalesInvoice) => {
    navigate(`/invoice/${invoice.id}`);
  };

  // Delete invoice handlers
  const handleDeleteClick = (invoice: SalesInvoice) => {
    if (invoice.status !== "Draft") {
      toast.error(tl("Only draft invoices can be deleted"));
      return;
    }
    setInvoiceToDelete(invoice);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    try {
      await deleteDraftInvoice(invoiceToDelete.id);
      toast.success(tl("Draft invoice {{id}} deleted successfully", { id: invoiceToDelete.id }));
      setShowDeleteConfirm(false);
      setInvoiceToDelete(null);
      // Refresh the invoices list
      window.location.reload();
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(tl(error.message || "Failed to delete invoice"));
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setInvoiceToDelete(null);
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId)
    setShowInvoiceModal(false);
  };

  const handleReturnClick = async (invoiceName: string) => {
    try {
      const result = await createSalesReturn(invoiceName);
      toast.success(tl("Invoice returned: {{id}}", { id: result.return_invoice }));
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(tl(error.message || "Failed to return invoice"));
    }
  };

  // const handleEditInvoice = (invoice: SalesInvoice) => {
  //   setSelectedDraftInvoice(invoice);
  //   setShowEditOptions(true);
  // };

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
      return canReturn;
    });

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

        // @ts-expect-error just ignore for now
  const handleClosingAmountChange = (modeName, value) => {
    setClosingAmounts(prev => ({
      ...prev,
      [modeName]: parseFloat(value) || 0
    }));
  };

  const handleFinalClose = async () => {

    try {
      // Convert closingAmounts object to array format expected by the service
      const closingBalanceArray = Object.entries(closingAmounts).map(([mode_of_payment, closing_amount]) => ({
        mode_of_payment,
        closing_amount: closing_amount || 0
      }));

            // @ts-expect-error just ignore for now
      await createClosingEntry(closingBalanceArray);
      setShowCloseModal(false);

      // Clear frontend caches
      clearAllCache();

      // Clear backend cache
      try {
        await fetch('/api/method/klik_pos.api.cache.clear_backend_cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include'
        });
      } catch (e) {
        console.warn('Failed to clear backend cache after close:', e);
      }

      // Navigate to POS home for a fresh start without full reload
      navigate('/pos');
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
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{tl("Closing Shift")}</h1>
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors text-sm"
              >
                <MonitorX className="w-4 h-4" />
                <span>{tl("Close")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          {/* Warning if no opening entry */}
          {hasNoOpeningEntry && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="text-yellow-600 dark:text-yellow-400 mr-3">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {tl("No Opening Entry Found")}
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {tl("You can still close the shift, but payment summary will not be available.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Summary - Only show if not hidden */}
          {!hideExpectedAmount && !hasNoOpeningEntry && (
            <div className="grid grid-cols-1 gap-4 mb-6">
              {Object.values(paymentStats).map((stat) => (
                      // @ts-expect-error just ignore for now
                <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                                          {/* @ts-expect-error just ignore */}
                    <h3 className="font-semibold text-gray-900 dark:text-white">{translateValue(stat.name)}</h3>
                                          {/* @ts-expect-error just ignore */}
                    {stat.name.toLowerCase().includes('cash') ? (
                      <div className="text-2xl">💵</div>
                    ) : (
                      <CreditCard className="w-8 h-8 text-beveren-600" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                            {/* @ts-expect-error just ignore */}
                      {formatCurrency(stat.amount, posDetails?.currency || 'USD')}
                    </div>
                    {/* <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stat.transactions} transactions
                    </div> */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {/* @ts-expect-error just ignore */}
                      {tl("{{percent}}% of total", {
                        percent: total > 0 ? ((stat.amount / total) * 100).toFixed(1) : 0,
                      })}
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
                  placeholder={tl("Search...")}
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
                <option value="all">{tl("All Time")}</option>
                <option value="today">{tl("Today")}</option>
                <option value="yesterday">{tl("Yesterday")}</option>
                <option value="week">{tl("This Week")}</option>
                <option value="month">{tl("This Month")}</option>
                <option value="year">{tl("This Year")}</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">{tl("All Status")}</option>
                <option value="Draft">{tl("Draft")}</option>
                <option value="Unpaid">{tl("Unpaid")}</option>
                <option value="Partly Paid">{tl("Partly Paid")}</option>
                <option value="Paid">{tl("Paid")}</option>
                <option value="Overdue">{tl("Overdue")}</option>
                <option value="Return">{tl("Return")}</option>
                <option value="Credit Note Issued">{tl("Credit Note Issued")}</option>
                <option value="Cancelled">{tl("Cancelled")}</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">{tl("All Payments")}</option>
                {modes.map((mode) => (
                  <option key={mode.name} value={mode.name}>
                    {translateValue(mode.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tl("All Invoices")} ({filteredInvoices.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Invoice")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Customer")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Amount")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Status")}
                    </th>
                    {posDetails?.is_zatca_enabled && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {tl("Zatca Status")}
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Actions")}
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
                          <div className="text-xs text-purple-600 dark:text-purple-400">{tl("Gift: {{code}}", { code: invoice.giftCardCode })}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                        {invoice.giftCardDiscount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            -{formatCurrency(invoice.giftCardDiscount, invoice.currency)} {tl("gift card")}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.status)}>{translateValue(invoice.status)}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                                              {/* @ts-expect-error just ignore */}
                        <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{translateValue(invoice.custom_zatca_submit_status)}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>{tl("View")}</span>
                          </button>
                          {/* {invoice.status === "Draft" && (
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                            >
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          )} */}
                          {invoice.status === "Draft" && (
                            <button
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                            >
                              <MonitorX className="w-4 h-4" />
                              <span>{tl("Delete")}</span>
                            </button>
                          )}
                                                {/* @ts-expect-error just ignore */}
                          {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems(invoice) && (
                            <button
                              onClick={() => handleSingleReturnClick(invoice)}
                              className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>{tl("Return")}</span>
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tl("Close Shift")}</h2>
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {Object.values(paymentStats).map((stat) => (
                        // @ts-expect-error just ignore for now
                  <div key={stat.name} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3 flex-shrink-0">
                                            {/* @ts-expect-error just ignore */}
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-xl">💵</div>
                      ) : (
                        <CreditCard className="w-5 h-5 text-orange-600" />
                      )}
                                            {/* @ts-expect-error just ignore */}
                      <span className="font-medium text-gray-900 dark:text-white">{stat.name}</span>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{tl("Opening:")}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                                                {/* @ts-expect-error just ignore */}
                          {formatCurrency(stat.openingAmount, posDetails?.currency || 'USD')}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={tl("Closing amount")}
                                // @ts-expect-error just ignore for now
                          value={closingAmounts[stat.name] || ''}
                          // @ts-expect-error just ignore for now
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
                  {tl("Cancel")}
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
                  {isCreating ? tl('Closing...') : tl('Close Shift')}
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

  const desktopClosingHeaderActions = (
    <button
      onClick={() => setShowCloseModal(true)}
      className="flex items-center space-x-2 rounded-2xl bg-app-primary px-4 py-2 text-white transition-colors hover:opacity-90"
    >
      <MonitorX className="w-4 h-4" />
      <span>{tl("Close")}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-14 text-slate-900 dark:bg-gray-900 dark:text-white">
      <PageHeader
        title={tl("Closing Shift")}
        description={tl("Reconcile session payments and close the current POS opening.")}
        actions={desktopClosingHeaderActions}
      />

      <div className="px-4 py-6 sm:px-6 space-y-6">
          {/* Warning if no opening entry */}
          {hasNoOpeningEntry && (
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-center">
                <div className="mr-3 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {tl("No Opening Entry Found")}
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {tl("You can still close the shift, but payment summary will not be available.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Summary - Only show if not hidden */}
          {!hideExpectedAmount && !hasNoOpeningEntry && (
            <>
              {/* Payment Method Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.values(paymentStats).map((stat) => (
                  <div key={stat.name} className="rounded-[28px] border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between mb-4">
                                            {/* @ts-expect-error just ignore */}
                      <h3 className="font-semibold text-slate-900 dark:text-white">{translateValue(stat.name)}</h3>
                                            {/* @ts-expect-error just ignore */}
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-2xl">💵</div>
                      ) : (
                        <CreditCard className="w-8 h-8 text-orange-600" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                              {/* @ts-expect-error just ignore */}
                        {formatCurrency(stat.amount, posDetails?.currency || 'USD')}
                      </div>
                      {/* <div className="text-sm text-gray-600 dark:text-gray-400">
                        {stat.transactions} transactions
                      </div> */}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                              {/* @ts-expect-error just ignore */}
                        {tl("{{percent}}% of total", {
                          percent: total > 0 ? ((stat.amount / total) * 100).toFixed(1) : 0,
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Filters */}
          <div className="rounded-[28px] border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={tl("Search...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="all">{tl("All Time")}</option>
                    <option value="today">{tl("Today")}</option>
                    <option value="yesterday">{tl("Yesterday")}</option>
                    <option value="week">{tl("This Week")}</option>
                    <option value="month">{tl("This Month")}</option>
                    <option value="year">{tl("This Year")}</option>
                  </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">{tl("All Status")}</option>
                <option value="Draft">{tl("Draft")}</option>
                <option value="Unpaid">{tl("Unpaid")}</option>
                <option value="Partly Paid">{tl("Partly Paid")}</option>
                <option value="Paid">{tl("Paid")}</option>
                <option value="Overdue">{tl("Overdue")}</option>
                <option value="Return">{tl("Return")}</option>
                <option value="Credit Note Issued">{tl("Credit Note Issued")}</option>
                <option value="Cancelled">{tl("Cancelled")}</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">{tl("All Payments")}</option>
                {modes.map((mode) => (
                  <option key={mode.name} value={mode.name}>
                    {translateValue(mode.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {tl("All Invoices")} ({filteredInvoices.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Invoice")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Customer")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Cashier")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Payment")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Amount")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Status")}
                    </th>
                    {posDetails?.is_zatca_enabled && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {tl("Zatca Status")}
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {tl("Actions")}
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
                          <div className="text-xs text-purple-600 dark:text-purple-400">
                            {tl("Gift: {{code}}", { code: invoice.giftCardCode })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {invoice.cashier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">{translateValue(invoice.paymentMethod)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </div>
                        {invoice.giftCardDiscount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            -{formatCurrency(invoice.giftCardDiscount, invoice.currency)} {tl("gift card")}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.status)}>{translateValue(invoice.status)}</span>
                      </td>
                      {posDetails?.is_zatca_enabled && (
                        <td className="px-6 py-4 whitespace-nowrap">
                                                {/* @ts-expect-error just ignore */}
                          <span className={getStatusBadge(invoice.custom_zatca_submit_status)}>{translateValue(invoice.custom_zatca_submit_status)}</span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-beveren-600 hover:text-beveren-900 flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>{tl("View")}</span>
                          </button>

                          {invoice.status === "Draft" && (
                            <button
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                            >
                              <MonitorX className="w-4 h-4" />
                              <span>{tl("Delete")}</span>
                            </button>
                          )}
                                                {/* @ts-expect-error just ignore */}
                          {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems(invoice) && (
                            <button
                              onClick={() => handleSingleReturnClick(invoice)}
                              className="text-orange-600 hover:text-orange-900 flex items-center space-x-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              <span>{tl("Return")}</span>
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tl("Close Shift")}</h2>
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
                      {/* @ts-expect-error just ignore */}
                      {stat.name.toLowerCase().includes('cash') ? (
                        <div className="text-xl">💵</div>
                      ) : (
                        <CreditCard className="w-5 h-5 text-beveren-600" />
                      )}
                                            {/* @ts-expect-error just ignore */}

                      <span className="font-medium text-gray-900 dark:text-white">{translateValue(stat.name)}</span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{tl("Opening:")}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                                                {/* @ts-expect-error just ignore */}

                          {formatCurrency(stat.openingAmount, posDetails?.currency || 'USD')}
                        </span>
                      </div>

                      <div className="flex-shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={tl("Closing amount")}
                                // @ts-expect-error just ignore for now
                          value={closingAmounts[stat.name] || ''}
                          // @ts-expect-error just ignore for now
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
                  {tl("Cancel")}
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
                  {isCreating ? tl('Closing...') : tl('Close Shift')}
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

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title={tl("Delete Draft Invoice")}
          message={tl("Are you sure you want to delete draft invoice {{id}}? This action cannot be undone.", { id: invoiceToDelete?.id || "" })}
          confirmText={tl("Delete")}
          cancelText={tl("Cancel")}
          confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        />
    </div>
  );
}
