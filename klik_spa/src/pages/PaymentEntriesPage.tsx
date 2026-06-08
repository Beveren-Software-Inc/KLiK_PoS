import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Banknote, CreditCard, FileText, Loader2, Search, User } from "lucide-react";
import { toast } from "react-toastify";
import BottomNavigation from "../components/BottomNavigation";
import CustomerPaymentEntryModal from "../components/customer/CustomerPaymentEntryModal";
import { useCustomers } from "../hooks/useCustomers";
import type { Customer } from "../types/customer";
import {
  getOutstandingSalesInvoices,
  getUnallocatedCustomerPaymentEntries,
  reconcilePaymentEntryWithInvoice,
  type OutstandingSalesInvoice,
  type UnallocatedCustomerPaymentEntry,
} from "../services/paymentEntry";
import { formatCurrencyWithSymbol } from "../utils/currency";

type PaymentTab = "invoice" | "customer" | "reconciliation";
const PAYMENT_ENTRIES_TAB_CACHE_KEY = "klik_pos_payment_entries_active_tab";

const getCachedPaymentTab = (): PaymentTab => {
  if (typeof window === "undefined") return "invoice";
  const cached = window.localStorage.getItem(PAYMENT_ENTRIES_TAB_CACHE_KEY);
  return cached === "customer" || cached === "reconciliation" || cached === "invoice" ? cached : "invoice";
};

export default function PaymentEntriesPage() {
  const [activeTab, setActiveTab] = useState<PaymentTab>(getCachedPaymentTab);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoices, setInvoices] = useState<OutstandingSalesInvoice[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingSalesInvoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { customers, isLoading: isLoadingCustomers, error: customerError } = useCustomers(customerSearch);
  const [reconcileSearch, setReconcileSearch] = useState("");
  const [reconcileInvoices, setReconcileInvoices] = useState<OutstandingSalesInvoice[]>([]);
  const [credits, setCredits] = useState<UnallocatedCustomerPaymentEntry[]>([]);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(true);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<UnallocatedCustomerPaymentEntry | null>(null);
  const [selectedReconcileInvoice, setSelectedReconcileInvoice] = useState<OutstandingSalesInvoice | null>(null);
  const [reconcileAmount, setReconcileAmount] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);

  const handleTabChange = (tab: PaymentTab) => {
    setActiveTab(tab);
    window.localStorage.setItem(PAYMENT_ENTRIES_TAB_CACHE_KEY, tab);
  };

  useEffect(() => {
    let isCurrent = true;
    const timer = window.setTimeout(async () => {
      setIsLoadingInvoices(true);
      setInvoiceError(null);
      try {
        const response = await getOutstandingSalesInvoices(invoiceSearch);
        if (!isCurrent) return;
        setInvoices(response.data || []);
        setInvoiceTotal(response.total_count || 0);
      } catch (err) {
        if (!isCurrent) return;
        setInvoiceError(err instanceof Error ? err.message : "Failed to fetch outstanding invoices");
        setInvoices([]);
        setInvoiceTotal(0);
      } finally {
        if (isCurrent) setIsLoadingInvoices(false);
      }
    }, invoiceSearch ? 300 : 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [invoiceSearch]);

  useEffect(() => {
    let isCurrent = true;
    const timer = window.setTimeout(async () => {
      setIsLoadingReconciliation(true);
      setReconciliationError(null);
      try {
        const [invoiceResponse, creditResponse] = await Promise.all([
          getOutstandingSalesInvoices(reconcileSearch),
          getUnallocatedCustomerPaymentEntries(reconcileSearch),
        ]);
        if (!isCurrent) return;
        setReconcileInvoices(invoiceResponse.data || []);
        setCredits(creditResponse.data || []);
      } catch (err) {
        if (!isCurrent) return;
        setReconciliationError(err instanceof Error ? err.message : "Failed to fetch reconciliation data");
        setReconcileInvoices([]);
        setCredits([]);
      } finally {
        if (isCurrent) setIsLoadingReconciliation(false);
      }
    }, reconcileSearch ? 300 : 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [reconcileSearch]);

  const invoiceCustomer = useMemo(() => {
    if (!selectedInvoice) return null;
    return {
      id: selectedInvoice.customer,
      name: selectedInvoice.customer_name || selectedInvoice.customer,
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      loyaltyPoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      preferredPaymentMethod: "Cash",
      tags: [],
      status: "active",
      type: "individual",
      createdAt: new Date().toISOString(),
    } as Customer;
  }, [selectedInvoice]);

  const closePaymentModal = () => {
    setSelectedInvoice(null);
    setSelectedCustomer(null);
  };

  const handlePaymentCreated = () => {
    getOutstandingSalesInvoices(invoiceSearch)
      .then((response) => {
        setInvoices(response.data || []);
        setInvoiceTotal(response.total_count || 0);
      })
      .catch(() => {
        // The toast from the modal already confirms creation; avoid noisy reload errors.
      });
  };

  useEffect(() => {
    if (!selectedCredit || !selectedReconcileInvoice) {
      setReconcileAmount("");
      return;
    }
    const amount = Math.min(
      Number(selectedCredit.unallocated_amount || 0),
      Number(selectedReconcileInvoice.outstanding_amount || 0)
    );
    setReconcileAmount(amount > 0 ? String(amount) : "");
  }, [selectedCredit, selectedReconcileInvoice]);

  const refreshReconciliation = async () => {
    const [invoiceResponse, creditResponse] = await Promise.all([
      getOutstandingSalesInvoices(reconcileSearch),
      getUnallocatedCustomerPaymentEntries(reconcileSearch),
    ]);
    setReconcileInvoices(invoiceResponse.data || []);
    setCredits(creditResponse.data || []);
  };

  const handleReconcile = async () => {
    if (!selectedCredit || !selectedReconcileInvoice) return;
    const amount = Number(reconcileAmount);
    if (amount <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if (selectedCredit.customer !== selectedReconcileInvoice.customer) {
      toast.error("Select a payment entry and invoice for the same customer.");
      return;
    }

    setIsReconciling(true);
    try {
      await reconcilePaymentEntryWithInvoice(selectedCredit.name, selectedReconcileInvoice.name, amount);
      toast.success("Payment reconciled successfully.");
      setSelectedCredit(null);
      setSelectedReconcileInvoice(null);
      setReconcileAmount("");
      await refreshReconciliation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reconcile payment");
    } finally {
      setIsReconciling(false);
    }
  };

  const canReconcile = Boolean(
    selectedCredit &&
      selectedReconcileInvoice &&
      selectedCredit.customer === selectedReconcileInvoice.customer &&
      Number(reconcileAmount) > 0 &&
      Number(reconcileAmount) <= Number(selectedCredit?.unallocated_amount || 0) &&
      Number(reconcileAmount) <= Number(selectedReconcileInvoice?.outstanding_amount || 0) &&
      !isReconciling
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 dark:bg-gray-900 lg:ml-20 lg:pb-12">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Entries</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {invoiceTotal} outstanding invoice{invoiceTotal === 1 ? "" : "s"}
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => handleTabChange("invoice")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  activeTab === "invoice"
                    ? "bg-white text-beveren-700 shadow-sm dark:bg-gray-900 dark:text-beveren-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <FileText size={16} />
                <span>By Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("customer")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  activeTab === "customer"
                    ? "bg-white text-beveren-700 shadow-sm dark:bg-gray-900 dark:text-beveren-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <User size={16} />
                <span>By Customer</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("reconciliation")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  activeTab === "reconciliation"
                    ? "bg-white text-beveren-700 shadow-sm dark:bg-gray-900 dark:text-beveren-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <ArrowRightLeft size={16} />
                <span>Reconcile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 py-6 sm:px-6">
        {activeTab === "invoice" ? (
          <section className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(event) => setInvoiceSearch(event.target.value)}
                placeholder="Search invoice or customer"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Invoice
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Outstanding
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {isLoadingInvoices ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            Loading invoices...
                          </span>
                        </td>
                      </tr>
                    ) : invoiceError ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-red-600 dark:text-red-400">
                          {invoiceError}
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">
                          No outstanding invoices found.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr key={invoice.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{invoice.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{invoice.status}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {invoice.customer_name || invoice.customer}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {invoice.posting_date}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                            {formatCurrencyWithSymbol(invoice.outstanding_amount, invoice.currency)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(invoice)}
                              className="inline-flex items-center gap-2 rounded-lg bg-beveren-600 px-3 py-2 text-sm font-medium text-white hover:bg-beveren-700"
                            >
                              <Banknote size={16} />
                              <span>Receive</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeTab === "customer" ? (
          <section className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search customer"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {isLoadingCustomers ? (
                <div className="rounded-lg border border-gray-200 bg-white p-5 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Loading customers...
                  </span>
                </div>
              ) : customerError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {customerError.message}
                </div>
              ) : customers.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-5 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  No customers found.
                </div>
              ) : (
                customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-white">{customer.name}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{customer.id}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {customer.phone || customer.email || "No contact"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-beveren-600 px-3 py-2 text-sm font-medium text-white hover:bg-beveren-700"
                      >
                        <Banknote size={16} />
                        <span>Receive</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={reconcileSearch}
                onChange={(event) => setReconcileSearch(event.target.value)}
                placeholder="Search customer, invoice, or payment entry"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {reconciliationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {reconciliationError}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <CreditCard size={18} />
                    <span>Credit / Payment Entries</span>
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{credits.length}</span>
                </div>
                <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoadingReconciliation ? (
                    <div className="p-5 text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Loading credits...
                      </span>
                    </div>
                  ) : credits.length === 0 ? (
                    <div className="p-5 text-gray-500 dark:text-gray-400">No unallocated payment entries found.</div>
                  ) : (
                    credits.map((credit) => {
                      const isSelected = selectedCredit?.name === credit.name;
                      return (
                        <button
                          key={credit.name}
                          type="button"
                          onClick={() => setSelectedCredit(credit)}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? "bg-beveren-50 dark:bg-beveren-950/30"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900 dark:text-white">{credit.name}</div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {credit.customer_name || credit.customer} • {credit.mode_of_payment || "Payment Entry"}
                              </div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{credit.posting_date}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-700 dark:text-green-300">
                                {formatCurrencyWithSymbol(credit.unallocated_amount, credit.currency)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">unallocated</div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    <FileText size={18} />
                    <span>Outstanding Invoices</span>
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{reconcileInvoices.length}</span>
                </div>
                <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoadingReconciliation ? (
                    <div className="p-5 text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        Loading invoices...
                      </span>
                    </div>
                  ) : reconcileInvoices.length === 0 ? (
                    <div className="p-5 text-gray-500 dark:text-gray-400">No outstanding invoices found.</div>
                  ) : (
                    reconcileInvoices.map((invoice) => {
                      const isSelected = selectedReconcileInvoice?.name === invoice.name;
                      const incompatible = selectedCredit && selectedCredit.customer !== invoice.customer;
                      return (
                        <button
                          key={invoice.name}
                          type="button"
                          onClick={() => setSelectedReconcileInvoice(invoice)}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            isSelected
                              ? "bg-beveren-50 dark:bg-beveren-950/30"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          } ${incompatible ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900 dark:text-white">{invoice.name}</div>
                              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {invoice.customer_name || invoice.customer}
                              </div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{invoice.posting_date}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-red-700 dark:text-red-300">
                                {formatCurrencyWithSymbol(invoice.outstanding_amount, invoice.currency)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">outstanding</div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-20 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 lg:bottom-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div>
                  <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Selected Credit</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {selectedCredit
                      ? `${selectedCredit.name} • ${formatCurrencyWithSymbol(selectedCredit.unallocated_amount, selectedCredit.currency)}`
                      : "No payment entry selected"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Selected Invoice</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {selectedReconcileInvoice
                      ? `${selectedReconcileInvoice.name} • ${formatCurrencyWithSymbol(
                          selectedReconcileInvoice.outstanding_amount,
                          selectedReconcileInvoice.currency
                        )}`
                      : "No invoice selected"}
                  </div>
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Allocate
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={reconcileAmount}
                      onChange={(event) => setReconcileAmount(event.target.value)}
                      className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleReconcile}
                    disabled={!canReconcile}
                    className="inline-flex items-center gap-2 rounded-lg bg-beveren-600 px-4 py-2 text-sm font-medium text-white hover:bg-beveren-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isReconciling ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                    <span>Reconcile</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {selectedInvoice && invoiceCustomer && (
        <CustomerPaymentEntryModal
          customer={invoiceCustomer}
          salesInvoiceName={selectedInvoice.name}
          outstandingAmount={selectedInvoice.outstanding_amount}
          defaultAmount={selectedInvoice.outstanding_amount}
          invoiceCurrency={selectedInvoice.currency}
          onClose={closePaymentModal}
          onCreated={handlePaymentCreated}
        />
      )}

      {selectedCustomer && (
        <CustomerPaymentEntryModal
          customer={selectedCustomer}
          onClose={closePaymentModal}
          onCreated={handlePaymentCreated}
        />
      )}

      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}
