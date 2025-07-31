import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText,
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  Eye,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  ArrowLeft,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react";

import InvoiceViewModal from "../components/InvoiceViewModal";
import type { SalesInvoice } from "../../types";
import { useSalesInvoices } from "../hooks/useSalesInvoices";
import { toast } from "react-toastify";
import { createSalesReturn } from "../services/salesInvoice";
import RetailSidebar from "../components/RetailSidebar";
import { useCustomerDetails } from "../hooks/useCustomers";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export default function CustomerDetailsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const { id: customerId } = useParams();
  const { customer, isLoadingC, errorC } = useCustomerDetails(customerId);
  const { invoices, isLoading, error } = useSalesInvoices();

  console.log("Invoices", invoices)
  console.log("📊 Total invoices available:", invoices.length);
  console.log("🔄 Loading state:", isLoading);
  console.log("❌ Error state:", error);
  
  const filterInvoiceByDate = (invoiceDateStr: string) => {
    if (dateFilter === "all") return true;

    const invoiceDate = new Date(invoiceDateStr);
    const today = new Date();

    if (dateFilter === "today") {
      return invoiceDate.toDateString() === today.toDateString();
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
  // Filter invoices for this customer
  const customerInvoices = useMemo(() => {
    if (isLoading || error || !customer) return [];
    
    return invoices.filter((invoice) => {
      // Filter by customer name using the actual API field
      const isCustomerInvoice = invoice.customer === customer.customer_name;
      
      if (!isCustomerInvoice) return false;

      const matchesSearch =
        searchQuery === "" ||
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      
      const matchesDate = filterInvoiceByDate(invoice.date);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchQuery, statusFilter, dateFilter, isLoading, error, customer]);



  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "Completed":
      case "Paid":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "Pending":
      case "Unpaid":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "Cancelled":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "Overdue":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "Refunded":
      case "Return":
        return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      default:
        return baseClasses;
    }
  };

  const handleViewInvoice = (invoice: SalesInvoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleRefund = (invoiceId: string) => {
    handleReturnClick(invoiceId);

    setShowInvoiceModal(false);
  };

 const handleReturnClick = async (invoiceName: string) => {
    try {
       console.log("Name", invoiceName)
      const result = await createSalesReturn(invoiceName);
     
      navigate(`/invoice/${result.return_invoice}`)
      toast.success(`Invoice returned: ${result.return_invoice}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to return invoice");
    }
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading customer details...</p>
        </div>
      </div>
    );
  }

  // Error state - only show if there's actually an error AND no customer data
  if (errorC && !customer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error loading customer</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {errorC?.message || "Failed to load customer details"}
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">Customer not found</h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            The requested customer could not be found.
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <RetailSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="fixed top-0 left-20 right-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {customer.customer_name || customer.name}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Customer ID: {customer.name}
                  </p>
                </div>
              </div>
              <button className="flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                <Edit className="w-4 h-4" />
                <span>Update Customer</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto pt-20 ml-20">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Customer Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-beveren-600 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {customer.customer_name || customer.name}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Mail className="w-4 h-4" />
                        <span>{customer.email_id || "No email provided"}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="w-4 h-4" />
                        <span>{customer.mobile_no || "No phone provided"}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                      <span>{customer.territory || "No territory specified"}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span>Customer Group: {customer.customer_group}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span>Type: {customer.customer_type}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      Active
                    </span>
                  </div>
                  {customer.creation && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created: {new Date(customer.creation).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                  {customer.modified && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Updated: {new Date(customer.modified).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {customerMetrics.totalInvoices}
                    </p>
                  </div>
                  <FileText className="w-8 h-8 text-beveren-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${customerMetrics.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${customerMetrics.outstandingAmount.toFixed(2)}
                    </p>
                  </div>
                  <AlertCircle className={`w-8 h-8 ${customerMetrics.outstandingAmount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${customerMetrics.avgOrderValue.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Customer Invoices Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Customer Invoices ({customerInvoices.length})
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
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Payment Method
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
                    {customerInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No invoices found for this customer
                        </td>
                      </tr>
                    ) : (
                      customerInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {invoice.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {invoice.date}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {invoice.time}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <CreditCard className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {invoice.paymentMethod}
                              </span>
                            </div>
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
                            <span className={getStatusBadge(invoice.status)}>
                              {invoice.status}
                            </span>
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
          </div>
        </div>

        {/* Invoice View Modal */}
        <InvoiceViewModal
          invoice={selectedInvoice}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onRefund={handleRefund}
          onCancel={(invoiceId) => {
            console.log("Cancelling invoice:", invoiceId);
            setShowInvoiceModal(false);
          }}
        />
      </div>
    </div>
  );
}