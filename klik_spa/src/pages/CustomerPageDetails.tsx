import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/currency";
import { usePOSDetails } from "../hooks/usePOSProfile";
import {
  FileText,
  DollarSign,
  TrendingUp,

  Search,

  User,
  Mail,
  Phone,
  MapPin,
  Edit,
  ArrowLeft,
  AlertCircle,

} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import SingleInvoiceReturn from "../components/SingleInvoiceReturn";
import type { SalesInvoice } from "../../types";
import { useCustomerInvoices } from "../hooks/useCustomerInvoices";
import { toast } from "react-toastify";
import { extractErrorFromException } from "../utils/errorExtraction";
import { createSalesReturn, submitDraftInvoice } from "../services/salesInvoice";

import { useCustomerDetails } from "../hooks/useCustomers";
import EditDraftInvoiceDialog from "../components/EditDraftInvoiceDialog";
import { addDraftInvoiceToCart } from "../utils/draftInvoiceToCart";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "../utils/time";
import AddCustomerModal from "../components/AddCustomerModal";
import BottomNavigation from "../components/BottomNavigation";
import MetricCard from "../components/ui/MetricCard";
import PageHeader from "../components/ui/PageHeader";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useI18n } from "../hooks/useI18n";

export default function CustomerDetailsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const { tl, formatDate: formatLocalizedDate } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Single Invoice Return states
  const [showSingleReturn, setShowSingleReturn] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<SalesInvoice | null>(null);

  // Customer edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Edit draft invoice dialog states
  const [showEditDraftDialog, setShowEditDraftDialog] = useState(false);
  const [draftInvoiceToEdit, setDraftInvoiceToEdit] = useState<SalesInvoice | null>(null);

  const { id: customerId } = useParams();
  // @ts-expect-error just ignore
  const { customer, isLoadingC, errorC } = useCustomerDetails(customerId);
  const { invoices, isLoading, error, hasMore, totalLoaded, loadMore } = useCustomerInvoices(customer?.name || "");
  const { posDetails } = usePOSDetails();


  const filterInvoiceByDate = useCallback((invoiceDateStr: string) => {
    if (dateFilter === "all") return true;

    if (dateFilter === "today") {
      return isToday(invoiceDateStr);
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
  // Filter invoices for this customer
  const customerInvoices = useMemo(() => {
    if (isLoading || error || !customer) return [];

    return invoices.filter((invoice) => {
      // Invoices are already filtered by customer in the hook, so we only apply other filters
      const matchesSearch =
        searchQuery === "" ||
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;

      const matchesDate = filterInvoiceByDate(invoice.date);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchQuery, statusFilter, isLoading, error, customer, filterInvoiceByDate]);

  // Debug log for filtered results
  console.log('CustomerPageDetails: Filtered customer invoices:', {
    customerInvoicesCount: customerInvoices.length,
    customerInvoices: customerInvoices
  });



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

  const handleViewInvoice = (invoice: SalesInvoice) => {
    navigate(`/invoice/${invoice.id}`)
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId);

    setShowInvoiceModal(false);
  };

  const handleEditInvoice = (invoice: SalesInvoice) => {
    // @ts-expect-error just ignore
    if (invoice.status !== "Draft") {
      toast.error(tl("Only draft invoices can be edited"));
      return;
    }
    setDraftInvoiceToEdit(invoice);
    setShowEditDraftDialog(true);
  };

  const handleGoToCart = async (invoice: SalesInvoice) => {
    try {
      const success = await addDraftInvoiceToCart(invoice.id);
      if (success) {
        setShowEditDraftDialog(false);
        setDraftInvoiceToEdit(null);
        navigate('/'); // Navigate to home screen
      }
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error going to cart:", error);
      toast.error(tl(error.message || "Failed to add items to cart"));
    }
  };

  // const handleSubmitPayment = (invoice: SalesInvoice) => {
  //   // Navigate to payment page for this invoice
  //   setShowEditDraftDialog(false);
  //   setDraftInvoiceToEdit(null);
  //   navigate(`/payment/${invoice.id}`);
  // };

  const handleSubmitDirect = async (invoice: SalesInvoice) => {
    try {
      await submitDraftInvoice(invoice.id);
      toast.success(tl("Draft invoice {{id}} submitted successfully", { id: invoice.id }));
      setShowEditDraftDialog(false);
      setDraftInvoiceToEdit(null);
      // Refresh the invoices list
      window.location.reload();
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error submitting draft invoice:", error);
      const errorMessage = extractErrorFromException(error, "Failed to submit draft invoice");
      toast.error(tl(errorMessage));
    }
  };

  const handleEditDraftCancel = () => {
    setShowEditDraftDialog(false);
    setDraftInvoiceToEdit(null);
  };

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

 const handleReturnClick = async (invoiceName: string) => {
    try {
      const result = await createSalesReturn(invoiceName);

      navigate(`/invoice/${result.return_invoice}`)
      toast.success(tl("Invoice returned: {{id}}", { id: result.return_invoice }));
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(tl(error.message || "Failed to return invoice"));
    }
  };

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveCustomer = (customer: any) => {
    console.log('Saving customer:', customer);
    setShowAddModal(false);
    setSelectedCustomer(null);
  };

  // Calculate customer metrics
  const customerMetrics = useMemo(() => {
    const totalInvoices = customerInvoices.length;
    const totalRevenue = customerInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const outstandingAmount = customerInvoices
      .filter(inv => inv.status === "Unpaid" || inv.status === "Overdue")
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const avgOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    return {
      totalInvoices,
      totalRevenue,
      outstandingAmount,
      avgOrderValue
    };
  }, [customerInvoices]);

  // Loading state
  if (isLoadingC) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">{tl("Loading customer details...")}</p>
        </div>
      </div>
    );
  }

  // Error state - only show if there's actually an error AND no customer data
  if (errorC && !customer) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">{tl("Error loading customer")}</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {tl(errorC?.message || "Failed to load customer details")}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // If no customer data, show not found
  if (!customer) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">{tl("Customer not found")}</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            {tl("The requested customer could not be found.")}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Mobile layout: full-width content with persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                                          {/* @ts-expect-error just ignore */}
                    {customer.customer_name || customer.name}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tl("Customer ID: {{id}}", { id: customer.name })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  console.log('Customer data being passed to modal:', customer);
                  setSelectedCustomer(customer);
                  setShowAddModal(true);
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors text-sm"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          {/* Customer Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-beveren-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                          {/* @ts-expect-error just ignore */}
                    {customer.customer_name || customer.name}
                  </h2>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>{customer.email || "No email provided"}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Phone className="w-3 h-3" />
                      <span>{customer.phone || "No phone provided"}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{customer.territory || "No territory specified"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Invoices</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {customerMetrics.totalInvoices}
                  </p>
                </div>
                <FileText className="w-6 h-6 text-beveren-600" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(customerMetrics.totalRevenue, posDetails?.currency || 'USD')}
                  </p>
                </div>
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Outstanding</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(customerMetrics.outstandingAmount, posDetails?.currency || 'USD')}
                  </p>
                </div>
                <AlertCircle className={`w-6 h-6 ${customerMetrics.outstandingAmount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Avg Order</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(customerMetrics.avgOrderValue, posDetails?.currency || 'USD')}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-4">
            <div className="space-y-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer Invoices Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tl("Customer Invoices ({{count}})", { count: customerInvoices.length })}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {customerInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        {tl("No invoices found for this customer")}
                      </td>
                    </tr>
                  ) : (
                    customerInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.id}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {invoice.date} {invoice.time}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(invoice.totalAmount, invoice.currency)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewInvoice(invoice)}
                              className="text-beveren-600 hover:text-beveren-900 dark:text-beveren-400 dark:hover:text-beveren-300"
                            >
                              View
                            </button>
                                                  {/* @ts-expect-error just ignore */}
                            {invoice.status === "Draft" && (
                              <button
                                onClick={() => handleEditInvoice(invoice)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Edit
                              </button>
                            )}
                                                  {/* @ts-expect-error just ignore */}
                            {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems(invoice) && (
                              <button
                                onClick={() => handleSingleReturnClick(invoice)}
                                className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                              >
                                Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load More Button for Customer Invoices */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  isLoading
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-beveren-600 text-white hover:bg-beveren-700'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  `Load More (${totalLoaded} loaded)`
                )}
              </button>
            </div>
          )}

          {/* Show message when all customer invoices are loaded */}
          {!hasMore && totalLoaded > 0 && (
            <div className="text-center mt-4 py-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All {totalLoaded} customer invoices loaded
              </p>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation />

        {/* Modals */}
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onRefund={handleRefund}
          onCancel={(invoiceId) => {
            console.log("Invoice cancelled:", invoiceId);
            setShowInvoiceModal(false);
          }}
        />

        <SingleInvoiceReturn
          invoice={selectedInvoiceForReturn}
          isOpen={showSingleReturn}
          onClose={() => setShowSingleReturn(false)}
          onSuccess={handleSingleReturnSuccess}
        />

        {showAddModal && (
          <AddCustomerModal
            customer={selectedCustomer}
            onClose={() => {
              setShowAddModal(false);
              setSelectedCustomer(null);
            }}
            onSave={handleSaveCustomer}
          />
        )}

        <EditDraftInvoiceDialog
          isOpen={showEditDraftDialog}
          onClose={handleEditDraftCancel}
          invoice={draftInvoiceToEdit}
          onGoToCart={handleGoToCart}
          onSubmitDirect={handleSubmitDirect}
        />
      </div>
    );
  }

  const desktopCustomerHeaderLeading = (
    <button
      onClick={() => navigate(-1)}
      className="rounded-2xl p-2 text-app-muted transition-colors hover:bg-app-elevated hover:text-foreground"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );

  const desktopCustomerHeaderActions = (
    <button
      onClick={() => {
        console.log('Customer data being passed to modal:', customer);
        setSelectedCustomer(customer);
        setShowAddModal(true);
      }}
      className="app-button-primary flex items-center space-x-2"
    >
      <Edit className="w-4 h-4" />
      <span>{tl("Update Customer")}</span>
    </button>
  );

  // Desktop layout
  return (
    <div className="min-h-screen bg-app-bg pb-14">
      <PageHeader
        title={customer.customer_name || customer.name}
        description={tl("Customer ID: {{id}}", { id: customer.name })}
        leading={desktopCustomerHeaderLeading}
        actions={desktopCustomerHeaderActions}
      />

      <div className="px-4 py-6 sm:px-6 max-w-none">
        <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="app-panel rounded-[30px] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-app-primary/15 text-app-primary">
                  <User className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-foreground">{customer.customer_name || customer.name}</h2>
                  <div className="mt-3 space-y-2 text-sm text-app-muted">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{customer.email || "No email provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone || "No phone provided"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{customer.territory || "No territory specified"}</span>
                    </div>
                    <div>{tl("Customer Group: {{group}}", { group: customer.customer_group || tl("Not set") })}</div>
                    <div>{tl("Type: {{type}}", { type: customer.type || tl("Not set") })}</div>
                    {customer.creation ? <div>{tl("Created: {{date}}", { date: formatLocalizedDate(customer.creation) })}</div> : null}
                    {customer.modified ? <div>{tl("Updated: {{date}}", { date: formatLocalizedDate(customer.modified) })}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                title="Total Invoices"
                value={customerMetrics.totalInvoices}
                icon={<FileText className="h-5 w-5" />}
              />
              <MetricCard
                title="Total Revenue"
                value={formatCurrency(customerMetrics.totalRevenue, posDetails?.currency || 'USD')}
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="Outstanding"
                value={formatCurrency(customerMetrics.outstandingAmount, posDetails?.currency || 'USD')}
                icon={<AlertCircle className="h-5 w-5" />}
              />
              <MetricCard
                title="Avg Order Value"
                value={formatCurrency(customerMetrics.avgOrderValue, posDetails?.currency || 'USD')}
                icon={<TrendingUp className="h-5 w-5" />}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="app-panel rounded-[30px] p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
                  <input
                    type="text"
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="app-input w-full pl-10 pr-3 py-2"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="app-select px-3 py-2"
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
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="app-select px-3 py-2"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
              </div>
            </div>

            <div className="app-panel overflow-hidden rounded-[30px]">
              <div className="border-b border-app-border px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {tl("Customer Invoices ({{count}})", { count: customerInvoices.length })}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="app-table min-w-full">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-app-muted">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-app-muted">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-app-muted">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-app-muted">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-app-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-app-muted">
                          {tl("No invoices found for this customer")}
                        </td>
                      </tr>
                    ) : (
                      customerInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t border-app-border/60">
                          <td className="px-6 py-4">
                            <div className="font-medium text-foreground">{invoice.id}</div>
                            <div className="text-xs text-app-muted">{invoice.customer}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-app-muted">
                            {invoice.date} {invoice.time}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-foreground">
                              {formatCurrency(invoice.totalAmount, invoice.currency)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={getStatusBadge(invoice.status)}>{invoice.status}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                              <button
                                onClick={() => handleViewInvoice(invoice)}
                                className="text-app-primary hover:opacity-90"
                              >
                                View
                              </button>
                              {invoice.status === "Draft" ? (
                                <button
                                  onClick={() => handleEditInvoice(invoice)}
                                  className="text-sky-700 hover:opacity-90 dark:text-sky-300"
                                >
                                  Edit
                                </button>
                              ) : null}
                              {["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems(invoice) ? (
                                <button
                                  onClick={() => handleSingleReturnClick(invoice)}
                                  className="text-amber-700 hover:opacity-90 dark:text-amber-300"
                                >
                                  Return
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {hasMore ? (
              <div className="flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className={`rounded-2xl px-6 py-3 font-medium transition-colors ${
                    isLoading
                      ? 'bg-slate-500 text-slate-200 cursor-not-allowed'
                      : 'bg-app-primary text-white hover:opacity-90'
                  }`}
                >
                  {isLoading
                    ? tl("Loading...")
                    : tl("Load More Customer Invoices ({{count}} loaded)", { count: totalLoaded })}
                </button>
              </div>
            ) : totalLoaded > 0 ? (
              <div className="py-4 text-center text-app-muted">
                All {totalLoaded} customer invoices loaded
              </div>
            ) : null}
          </div>
        </div>
        </div>

        {/* Invoice View Modal */}
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onRefund={handleRefund}
          onCancel={(invoiceId) => {
            console.log("Invoice cancelled:", invoiceId);
            setShowInvoiceModal(false);
          }}
        />

        {/* Single Invoice Return Modal */}
        <SingleInvoiceReturn
          invoice={selectedInvoiceForReturn}
          isOpen={showSingleReturn}
          onClose={() => setShowSingleReturn(false)}
          onSuccess={handleSingleReturnSuccess}
        />

        {/* Customer Edit Modal */}
        {showAddModal && (
          <AddCustomerModal
            customer={selectedCustomer}
            onClose={() => {
              setShowAddModal(false);
              setSelectedCustomer(null);
            }}
            onSave={handleSaveCustomer}
          />
        )}

        {/* Edit Draft Invoice Dialog */}
        <EditDraftInvoiceDialog
          isOpen={showEditDraftDialog}
          onClose={handleEditDraftCancel}
          invoice={draftInvoiceToEdit}
          onGoToCart={handleGoToCart}
          onSubmitDirect={handleSubmitDirect}
        />
    </div>
  );
}
