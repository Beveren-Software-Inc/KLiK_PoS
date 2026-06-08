import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Printer,
  MailPlus,
  MessageCirclePlus,
  MessageSquarePlus,
  Edit,
  Check,
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Package,
  FileText,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  FileMinus,
  TrendingUp,
  Clock,
  CreditCard,
  Percent,
  Banknote
} from "lucide-react";



import PaymentDialog from "../components/dialog/PaymentDialog";
import SalespersonAuthModal from "../components/dialog/SalespersonAuthModal";
import { useInvoiceDetails } from "../hooks/useInvoiceDetails";
import { useCustomerStatistics } from "../hooks/useCustomerStatistics";
import { usePOSProfileStore } from "../stores/posProfileStore";
import { useSalespersonStore } from "../stores/salespersonStore";
import { deleteDraftInvoice } from "../services/salesInvoice";
import { addDraftInvoiceToCart } from "../utils/draftInvoiceToCart";
import { loadCachedItemsToCart } from "../utils/draftInvoiceCache";
import { extractErrorFromException } from "../utils/errorExtraction";
import { toast } from "react-toastify";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import DisplayPrintPreview from "../utils/invoicePrint";
import { handlePrintInvoice } from "../utils/printHandler";
import SingleInvoiceReturn from "../components/SingleInvoiceReturn";
import MultiInvoiceReturn from "../components/MultiInvoiceReturn";
import { formatCurrencyWithSymbol } from "../utils/currency";
import AddCustomerModal from "../components/customer/AddCustomerModal";
import { useCartStore } from "../stores/cartStore";
import CustomerPaymentEntryModal from "../components/customer/CustomerPaymentEntryModal";

export default function InvoiceViewPage() {

  const { id } = useParams()
  const invoiceId = id ?? ""

  const { invoice, isLoading, error, refetch } = useInvoiceDetails(invoiceId);
  const { statistics: customerStats, isLoading: statsLoading } = useCustomerStatistics(invoice?.customer || null);
  const { posDetails } = usePOSProfileStore();
  const canProcessReturns = ![0, "0", false].includes(posDetails?.custom_allow_return as 0 | "0" | false);
  const navigate = useNavigate()

  // PaymentDialog state for sharing
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [sharingMode, setSharingMode] = useState<string | null>(null)

  // Return modals state
  const [showSingleReturn, setShowSingleReturn] = useState(false)
  const [showMultiReturn, setShowMultiReturn] = useState(false)
  const [showDraftPaymentDialog, setShowDraftPaymentDialog] = useState(false)
  const [showInvoicePaymentModal, setShowInvoicePaymentModal] = useState(false)

  // Customer edit modal state
  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customerData, setCustomerData] = useState<any>(null)
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false)

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSalespersonAuthModal, setShowSalespersonAuthModal] = useState(false)
  const pendingSalespersonActionRef = useRef<null | (() => void)>(null)

  const { activeSalesperson, ensureInitialized } = useSalespersonStore()
  const { cartItems, selectedCustomer: cartCustomer } = useCartStore()
  const requiresSalespersonPin = !!posDetails?.custom_sales_person_pin_required

  useEffect(() => {
    if (requiresSalespersonPin) {
      void ensureInitialized()
    }
  }, [requiresSalespersonPin, ensureInitialized])

  const runWithSalespersonGate = (action: () => void | Promise<void>) => {
    if (!requiresSalespersonPin || activeSalesperson) {
      void action()
      return
    }

    pendingSalespersonActionRef.current = () => {
      void action()
    }
    setShowSalespersonAuthModal(true)
  }

  const handleSalespersonAuthenticated = () => {
    const pendingAction = pendingSalespersonActionRef.current
    pendingSalespersonActionRef.current = null
    setShowSalespersonAuthModal(false)
    if (pendingAction) pendingAction()
  }


  const handleBackClick = () => {
    navigate(`/invoice`)
  };

  const isDraftInvoiceStatus = (status?: string) => status === "Draft" || status === "Pending"

  // Delete invoice handlers
  const handleDeleteClick = () => {
    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleDeleteClick)
      return
    }

    if (!invoice) return;
    if (!isDraftInvoiceStatus(invoice.status)) {
      toast.error("Only draft invoices can be deleted");
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleDeleteConfirm)
      return
    }

    if (!invoice) return;

    try {
      await deleteDraftInvoice(invoice.name || invoice.id);
      toast.success(`Draft invoice ${invoice.name || invoice.id} deleted successfully`);
      setShowDeleteConfirm(false);
      navigate('/invoice');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete invoice");
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };


// @ts-expect-error just ignore
  const getStatusBadge = (status) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1";
    switch (status) {
      case "Completed":
      case "Paid":
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "Pending":
      case "Unpaid":
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`;
      case "Cancelled":
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "Refunded":
        return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400`;
      default:
        return baseClasses;
    }
  };



  // const handleReturn = async(invoiceName: string) => {
  //     try {
  //         const result = await createSalesReturn(invoiceName);
  //         navigate(`/invoice/${result.return_invoice}`)
  //         toast.success(`Invoice returned: ${result.return_invoice}`);
  //       } catch (error: any) {
  //         toast.error(error.message || "Failed to return invoice");

  //   }
  // };

  const handleEditCustomer = async () => {
    if (!invoice?.customer) {
      toast.error("Customer information not available");
      return;
    }

    setIsLoadingCustomer(true);
    try {
      const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_info?customer_name=${encodeURIComponent(invoice.customer)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result?.message?.success !== false) {
        // Transform the API response to match the Customer interface expected by AddCustomerModal
        const customerInfo = result.message;
        const transformedCustomer = {
          id: customerInfo.name,
          name: customerInfo.customer_name,
          type: customerInfo.customer_type?.toLowerCase() === 'company' ? 'company' : 'individual',
          email: customerInfo.contact_data?.email_id || customerInfo.email_id || '',
          phone: customerInfo.contact_data?.mobile_no || customerInfo.contact_data?.phone || customerInfo.mobile_no || '',
          address: {
            addressType: 'Billing',
            street: customerInfo.address_data?.address_line1 || '',
            buildingNumber: customerInfo.address_data?.address_line2 || '',
            city: customerInfo.address_data?.city || '',
            state: customerInfo.address_data?.state || '',
            zipCode: customerInfo.address_data?.pincode || '',
            country: posDetails?.company?.country || '',
          },
          status: 'active' as const,
          preferredPaymentMethod: customerInfo.payment_method || 'Cash' as const,
          customer_group: customerInfo.customer_group || 'All Customer Groups',
          territory: customerInfo.territory || 'All Territories',
          contactPerson: customerInfo.contact_data ?
            `${customerInfo.contact_data.first_name || ''} ${customerInfo.contact_data.last_name || ''}`.trim() || customerInfo.customer_name :
            customerInfo.customer_name || "",
          companyName: customerInfo.customer_type === "Company" ? customerInfo.customer_name : undefined,
          taxId: customerInfo.vat_number || customerInfo.tax_id || "",
          industry: customerInfo.industry || "",
          employeeCount: customerInfo.employee_count || "",
          registrationScheme: customerInfo.registration_scheme || "",
          registrationNumber: customerInfo.registration_number || ""
        };

        setCustomerData(transformedCustomer);
        setShowCustomerEditModal(true);
      } else {
        throw new Error(result?.message?.error || 'Failed to fetch customer details');
      }
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error fetching customer details:', error);
      toast.error(error.message || 'Failed to fetch customer details');
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const handleSingleReturnSuccess = (returnInvoice: string) => {
    navigate(`/invoice/${returnInvoice}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSaveCustomer = (updatedCustomer: any) => {
    setShowCustomerEditModal(false);
    setCustomerData(null);
    toast.success('Customer updated successfully!');
    // Optionally refresh the invoice data to show updated customer info
  };

  const handleMultiReturnSuccess = (returnInvoices: string[]) => {
    toast.success(`${returnInvoices.length} return invoices created successfully`);
    navigate('/invoice');
  };

  const handleOpenSingleReturn = () => {
    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleOpenSingleReturn)
      return
    }
    setShowSingleReturn(true)
  }

  const handleOpenMultiReturn = () => {
    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleOpenMultiReturn)
      return
    }
    setShowMultiReturn(true)
  }

  // Helper function to check if invoice has items that can still be returned
  const hasReturnableItems = () => {
    if (!invoice || !invoice.items) return false;

    return invoice.items.some(item => {
      const soldQty = item.qty || item.quantity || 0;
      const returnedQty = item.returned_qty || 0;
      return returnedQty < soldQty;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <div className="flex-1 flex items-center justify-center ml-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <div className="flex-1 flex items-center justify-center ml-20">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">Error loading invoice: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No invoice found
  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <div className="flex-1 flex items-center justify-center ml-20">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Invoice not found</p>
          </div>
        </div>
      </div>
    );
  }

  const queueInvoice = invoice as typeof invoice & {
    queue_status?: string;
    queue_error?: string;
  };
  const isDraftInvoice = isDraftInvoiceStatus(invoice.status);

  const handleGoToCart = async () => {
    if (!invoice) return
    const draftInvoiceId = invoice.name || invoice.id
    if (!draftInvoiceId) {
      toast.error("Unable to edit draft invoice: missing invoice identifier")
      return
    }

    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleGoToCart)
      return
    }

    try {
      const success = await addDraftInvoiceToCart(draftInvoiceId)
      if (success) {
        navigate("/pos")
      }
    } catch (error: unknown) {
      console.error("Error going to cart:", error)
      toast.error(extractErrorFromException(error, "Failed to add items to cart"))
    }
  }

  const handleSubmitDirect = async () => {
    if (!invoice) return
    const draftInvoiceId = invoice.name || invoice.id
    if (!draftInvoiceId) {
      toast.error("Unable to submit draft invoice: missing invoice identifier")
      return
    }

    if (requiresSalespersonPin && !activeSalesperson) {
      runWithSalespersonGate(handleSubmitDirect)
      return
    }

    try {
      const success = await addDraftInvoiceToCart(draftInvoiceId)
      if (success) {
        await loadCachedItemsToCart()
        setShowDraftPaymentDialog(true)
      }
    } catch (error: unknown) {
      console.error("Error opening payment dialog for draft invoice:", error)
      toast.error(extractErrorFromException(error, "Failed to load invoice for payment"))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex pb-12">
      <div className="flex-1 flex flex-col overflow-hidden ml-20">
        {/* Header */}
        <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackClick}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-beveren-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Invoice {invoice.name || invoice.id}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {invoice.posting_date} at {invoice.posting_time}
                  </p>
                </div>
                <div className={getStatusBadge(invoice.status)}>
                  <CheckCircle size={16} />
                  <span>{invoice.status}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <div className="sr-only">
                             {/* @ts-expect-error just ignore */}

                  <DisplayPrintPreview invoice={invoice} />
                </div>

                <button
                  className="group relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                  // @ts-expect-error just ignore
                  onClick={() => handlePrintInvoice(invoice, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting), onAfterMark: refetch, posDetails })}
                >
                  <Printer size={20} />
                  <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    Print Invoice
                  </span>
                </button>

                <button
                  className="group relative p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-all duration-200"
                  onClick={() => {
                    setSharingMode('email')
                    setShowPaymentDialog(true)
                  }}
                >
                  <MailPlus size={20} />
                  <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                    Send via Email
                  </span>
                </button>

                {(posDetails?.custom_enable_whatsapp === 1 || posDetails?.custom_enable_whatsapp === '1' || posDetails?.custom_enable_whatsapp === true) ? (
                  <button
                    className="group relative p-2 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900 rounded-lg transition-all duration-200"
                    onClick={() => {
                      setSharingMode('whatsapp')
                      setShowPaymentDialog(true)
                    }}
                  >
                    <MessageCirclePlus size={20} />
                    <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                      Send via WhatsApp
                    </span>
                  </button>
                ) : ""}

                {(posDetails?.custom_enable_sms === 1 || posDetails?.custom_enable_sms === '1' || posDetails?.custom_enable_sms === true) ? (
                  <button
                    className="group relative p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-all duration-200"
                    onClick={() => {
                      setSharingMode('sms')
                      setShowPaymentDialog(true)
                    }}
                  >
                    <MessageSquarePlus size={20} />
                    <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                      Send via SMS
                    </span>
                  </button>
                ) : ""}

                {/* Return Buttons */}
                           {/* @ts-expect-error just ignore */}
                {canProcessReturns && ["Paid", "Unpaid", "Overdue", "Partly Paid", "Credit Note Issued"].includes(invoice.status) && !invoice.is_return && hasReturnableItems() && (
                  <>
                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>

                    <button
                      className="group relative p-2 text-orange-600 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-900 rounded-lg transition-all duration-200"
                      onClick={() => {
                        if (!canProcessReturns) {
                          toast.error("Returns are disabled for this POS Profile");
                          return;
                        }
                        setShowSingleReturn(true);
                      }}
                    >
                      <RotateCcw size={20} />
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                        Return Items (Single Invoice)
                      </span>
                    </button>

                    <button
                      className="group relative p-2 text-orange-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900 rounded-lg transition-all duration-200"
                      onClick={() => {
                        if (!canProcessReturns) {
                          toast.error("Returns are disabled for this POS Profile");
                          return;
                        }
                        setShowMultiReturn(true);
                      }}
                    >
                      <FileMinus size={20} />
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                        Multi-Invoice Return
                      </span>
                    </button>
                  </>
                )}

                {/* Delete Button for Draft Invoices */}
                {isDraftInvoice && (
                  <>
                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                    <button
                      className="group relative p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900 rounded-lg transition-all duration-200"
                      onClick={() => {
                        void handleGoToCart()
                      }}
                    >
                      <Edit size={20} />
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                        Edit Draft Invoice
                      </span>
                    </button>
                    <button
                      className="group relative p-2 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900 rounded-lg transition-all duration-200"
                      onClick={() => {
                        void handleSubmitDirect()
                      }}
                    >
                      <Check size={20} />
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                        Submit Draft Invoice
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 pt-20 pb-20 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Details - 70% */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Invoice Header */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">INVOICE</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">#{invoice.name || invoice.id}</p>
                      </div>
                      <div className="text-right">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{invoice.company}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.company_address_doc?.address_line1}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.company_address_doc?.county}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.company_address_doc?.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Info */}
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Bill To:</h4>
                        <p className="text-sm text-gray-900 dark:text-white font-medium">{invoice.customer}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.customer_address_doc?.address_line1}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.customer_address_doc?.email_id}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.customer_address_doc?.phone}</p>
                        {invoice.tax_id && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Tax ID:</h4>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">{invoice.tax_id}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Date:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{invoice.posting_date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Time:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{invoice.posting_time}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Cashier:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{invoice.cashier_name || invoice.owner}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Payment:</span>
                            <span className="text-sm text-gray-900 dark:text-white">{invoice.paymentMethod}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {invoice.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Code: {item.item_code}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">{item.category}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">
                              {item.qty}
                            </td>
                            <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                              {formatCurrencyWithSymbol(item.rate, invoice.currency)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrencyWithSymbol(item.amount, invoice.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tax Details Section */}
                  {invoice.taxes && invoice.taxes.length > 0 && (
                    <div className="px-6 py-4 bg-beveren-50 dark:bg-beveren-900/20 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center space-x-2 mb-3">
                        <Percent className="w-5 h-5 text-beveren-600 dark:text-beveren-400" />
                        <h4 className="text-sm font-semibold text-beveren-900 dark:text-beveren-100">Tax Details</h4>
                      </div>
                      <div className="space-y-2">
                        {invoice.taxes.map((tax, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <div className="flex items-center space-x-2">
                                          {/* @ts-expect-error just ignore */}

                              <span className="text-beveren-700 dark:text-beveren-300 font-medium">{tax.account_head}</span>
                                         {/* @ts-expect-error just ignore */}

                              <span className="text-beveren-600 dark:text-beveren-400">({tax.rate}%)</span>
                                         {/* @ts-expect-error just ignore */}

                              {tax.included_in_print_rate === 1 && (
                                <span className="px-2 py-1 bg-beveren-100 dark:bg-beveren-800 text-beveren-800 dark:text-beveren-200 text-xs rounded-full">
                                  Inclusive
                                </span>
                              )}
                            </div>
                            <span className="text-beveren-900 dark:text-beveren-100 font-semibold">
                                         {/* @ts-expect-error just ignore */}
                              {formatCurrencyWithSymbol(tax.tax_amount, invoice.currency)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-beveren-200 dark:border-beveren-700">
                          <span className="text-beveren-700 dark:text-beveren-300 font-semibold">Total Tax:</span>
                          <span className="text-beveren-900 dark:text-beveren-100 font-bold">
                            {formatCurrencyWithSymbol(invoice.total_taxes_and_charges, invoice.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
                    <div className="flex justify-end">
                      <div className="w-80 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="text-gray-900 dark:text-white">{formatCurrencyWithSymbol(invoice.total, invoice.currency)}</span>
                        </div>

                        {invoice.total_taxes_and_charges > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrencyWithSymbol(invoice.total_taxes_and_charges, invoice.currency)}</span>
                          </div>
                        )}

                        {invoice.rounding_adjustment !== 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Rounding:</span>
                            <span className="text-gray-900 dark:text-white">{formatCurrencyWithSymbol(invoice.rounding_adjustment, invoice.currency)}</span>
                          </div>
                        )}

                        {invoice.giftCardDiscount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Gift Card Discount:</span>
                            <span className="text-green-600 dark:text-green-400">-{formatCurrencyWithSymbol(invoice.giftCardDiscount, invoice.currency)}</span>
                          </div>
                        )}

                        <hr className="border-gray-300 dark:border-gray-600" />

                        <div className="flex justify-between text-lg font-bold">
                          <span className="text-gray-900 dark:text-white">Grand Total:</span>
                          <span className="text-gray-900 dark:text-white">{formatCurrencyWithSymbol(invoice.grand_total, invoice.currency)}</span>
                        </div>

                        {invoice.paid_amount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Paid Amount:</span>
                            <span className="text-beveren-600 dark:text-beveren-400">{formatCurrencyWithSymbol(invoice.paid_amount, invoice.currency)}</span>
                          </div>
                        )}

                        {invoice.outstanding_amount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Outstanding:</span>
                            <span className="text-orange-600 dark:text-orange-400">{formatCurrencyWithSymbol(invoice.outstanding_amount, invoice.currency)}</span>
                          </div>
                        )}

                        {invoice.outstanding_amount > 0 && invoice.status !== "Draft" && (
                          <button
                            type="button"
                            onClick={() => setShowInvoicePaymentModal(true)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-beveren-600 px-4 py-2 text-sm font-medium text-white hover:bg-beveren-700"
                          >
                            <Banknote size={16} />
                            <span>Receive Payment</span>
                          </button>
                        )}

                        {invoice.status === "Refunded" && invoice.refundAmount && (
                          <div className="flex justify-between text-sm border-t border-gray-300 dark:border-gray-600 pt-2">
                            <span className="text-red-600 dark:text-red-400">Refunded Amount:</span>
                            <span className="text-red-600 dark:text-red-400">{formatCurrencyWithSymbol(invoice.refundAmount, invoice.currency)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gift Card Section */}
                  {invoice.giftCardCode && (
                    <div className="px-6 py-4 bg-purple-50 dark:bg-purple-900/20 border-t border-gray-200 dark:border-gray-600">
                      <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Gift Card Applied:</h4>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-purple-700 dark:text-purple-300">Code: {invoice.giftCardCode}</span>
                        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">-{formatCurrencyWithSymbol(invoice.giftCardDiscount, invoice.currency)}</span>
                      </div>
                    </div>
                  )}

                  {/* Payment Details */}
                  <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/20 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-2 mb-3">
                      <CreditCard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100">Payment Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-orange-700 dark:text-orange-300">Payment Method:</span>
                          <span className="text-orange-900 dark:text-orange-100 font-medium">{invoice.paymentMethod || 'Cash'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orange-700 dark:text-orange-300">Status:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-orange-700 dark:text-orange-300">Paid Amount:</span>
                          <span className="text-orange-900 dark:text-orange-100 font-semibold">{formatCurrencyWithSymbol(invoice.paid_amount || 0, invoice.currency)}</span>
                        </div>
                        {invoice.outstanding_amount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-700 dark:text-red-300">Outstanding:</span>
                            <span className="text-red-900 dark:text-red-100 font-semibold">{formatCurrencyWithSymbol(invoice.outstanding_amount, invoice.currency)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {invoice.notes && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Notes:</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Details - 30% */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                        <User size={20} />
                        <span>Customer Details</span>
                      </h3>
                      {posDetails && posDetails?.custom_allow_to_create_and_edit_customers === 1 && (
                        <button
                          onClick={handleEditCustomer}
                          disabled={isLoadingCustomer}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit Customer"
                        >
                          {isLoadingCustomer ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Edit size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">{invoice.customer}</h4>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 text-sm">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">{invoice.customer_email}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-sm">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">{invoice.customer_mobile_no}</span>
                      </div>
                      <div className="flex items-start space-x-3 text-sm">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <span className="text-gray-600 dark:text-gray-400">{invoice.customer_address_doc?.address_line1}</span>
                      </div>
                    </div>

                    <hr className="border-gray-200 dark:border-gray-600" />

                    {/* Customer Statistics */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-beveren-600" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Customer Statistics</h4>
                      </div>

                      {statsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                          <span className="ml-2 text-sm text-gray-500">Loading statistics...</span>
                        </div>
                      ) : customerStats ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-r from-beveren-50 to-beveren-100 dark:from-beveren-900/20 dark:to-beveren-800/20 rounded-lg p-4 border border-beveren-200 dark:border-beveren-700">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-beveren-600 rounded-lg">
                                  <Package className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <p className="text-xs text-beveren-700 dark:text-beveren-300 font-medium">Total Orders</p>
                                  <p className="text-xs font-bold text-beveren-900 dark:text-beveren-100">
                                    {customerStats.total_orders}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-orange-600 rounded-lg">
                                  <DollarSign className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">Total Spent</p>
                                  <p className="text-xs font-small text-orange-900 dark:text-orange-100">
                                    {formatCurrencyWithSymbol(customerStats.total_spent, invoice.currency)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {customerStats.last_visit && (
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Last Visit:</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(customerStats.last_visit).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Unable to load customer statistics</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {invoice.sales_team && invoice.sales_team.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Sales Team</h4>
                      </div>
                      <div className="px-6 py-4 space-y-4">
                        {invoice.sales_team.map((member: any, idx: number) => {
                          const displayName = member.sales_person ||  "Unknown";
                          const contact_no = member.contact_no || '';
                          const percent = member.allocated_percentage || null;
                          return (
                            <div key={idx} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-beveren-500 to-beveren-700 text-white flex items-center justify-center font-semibold text-xs">
                                  {String(displayName).slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</div>
                                  {contact_no && <div className="text-xs text-gray-500 dark:text-gray-400">{contact_no}</div>}
                                </div>
                              </div>
                              {percent ? (
                                <div className="text-sm text-gray-600 dark:text-gray-400">{percent}%</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No sales team assigned.</p>
                )}

                {queueInvoice.queue_status === "Failed" && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Invoice submission failed</div>
                      <div className="mt-1 whitespace-pre-wrap break-words">
                        {queueInvoice.queue_error || "No failure reason was recorded for this invoice."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>


      {/* PaymentDialog for Sharing */}
      {showPaymentDialog && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => {
            setShowPaymentDialog(false)
            setSharingMode(null)
          }}
          cartItems={[]}
          appliedCoupons={[]}
          selectedCustomer={{
            id: invoice.customer,
            name: invoice.customer,
            email: invoice.customer_address_doc?.email_id || '',
            phone: invoice.customer_address_doc?.phone || '',
            type: 'individual',
            status: 'active',
            loyaltyPoints: 0,
            totalOrders: 0,
            totalSpent: 0,

            address: {
              addressType: 'Billing',
              // @ts-expect-error just ignore
              streetName: invoice.customer_address_doc?.address_line1 || '',
              buildingNumber: '',
              subdivisionName: '',
              cityName: '',
              postalCode: '',
              country: posDetails?.company?.country || '',
              isPrimary: true
            },
            vatNumber: '',
            registrationScheme: '',
            registrationNumber: '',
            preferredPaymentMethod: 'Cash',
            tags: []
          }}
          onCompletePayment={() => {
            setShowPaymentDialog(false)
            setSharingMode(null)
          }}
          onHoldOrder={() => {
            setShowPaymentDialog(false)
            setSharingMode(null)
          }}
          isMobile={false}
          isFullPage={false}
          initialSharingMode={sharingMode}
          externalInvoiceData={invoice}
        />
      )}

      {showDraftPaymentDialog && (
        <PaymentDialog
          isOpen={showDraftPaymentDialog}
          onClose={(paymentCompleted) => {
            setShowDraftPaymentDialog(false)
            if (paymentCompleted) {
              void refetch()
            }
          }}
          cartItems={cartItems}
          appliedCoupons={[]}
          selectedCustomer={cartCustomer}
          onCompletePayment={() => {
            setShowDraftPaymentDialog(false)
            void refetch()
          }}
          onHoldOrder={() => setShowDraftPaymentDialog(false)}
          isMobile={false}
          isFullPage={false}
        />
      )}

      {showInvoicePaymentModal && invoice && (
        <CustomerPaymentEntryModal
          customer={{
            id: invoice.customer,
            name: (invoice as any).customer_name || invoice.customer,
            email: invoice.customer_email || "",
            phone: invoice.customer_mobile_no || "",
            type: "individual",
            status: "active",
            loyaltyPoints: 0,
            totalOrders: 0,
            totalSpent: 0,
            address: {
              street: invoice.customer_address_doc?.address_line1 || "",
              city: invoice.customer_address_doc?.city || "",
              state: invoice.customer_address_doc?.state || "",
              zipCode: (invoice.customer_address_doc as any)?.pincode || "",
              country: invoice.customer_address_doc?.country || "",
            },
            preferredPaymentMethod: "Cash",
            tags: [],
            createdAt: new Date().toISOString(),
          }}
          salesInvoiceName={invoice.name || invoice.id}
          outstandingAmount={invoice.outstanding_amount}
          defaultAmount={invoice.outstanding_amount}
          invoiceCurrency={invoice.currency}
          onClose={() => setShowInvoicePaymentModal(false)}
          onCreated={() => void refetch()}
        />
      )}

      {/* Single Invoice Return Modal */}
      <SingleInvoiceReturn
        invoice={invoice}
        isOpen={showSingleReturn}
        onClose={() => setShowSingleReturn(false)}
        onSuccess={handleSingleReturnSuccess}
      />

      {/* Multi-Invoice Return Modal */}
      <MultiInvoiceReturn
        customer={invoice?.customer || ''}
        isOpen={showMultiReturn}
        onClose={() => setShowMultiReturn(false)}
        onSuccess={handleMultiReturnSuccess}
      />

      {/* Customer Edit Modal */}
      {showCustomerEditModal && customerData && (
        <AddCustomerModal
          customer={customerData}
          onClose={() => {
            setShowCustomerEditModal(false);
            setCustomerData(null);
          }}
          onSave={handleSaveCustomer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft Invoice"
        message={`Are you sure you want to delete draft invoice ${invoice?.name || invoice?.id}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />

      <SalespersonAuthModal
        isOpen={showSalespersonAuthModal}
        onClose={() => {
          setShowSalespersonAuthModal(false)
          pendingSalespersonActionRef.current = null
        }}
        onAuthenticated={handleSalespersonAuthenticated}
        allowDismiss
        title="Verify salesperson"
        description="Verify the salesperson before continuing this invoice action."
      />

      </div>
    </div>
  );
}
