import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { formatCurrency, getCurrencySymbol } from "../utils/currency"
import {

  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  CreditCard,
  Gift,
  Calendar,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Filter,
  Download,

} from "lucide-react"
import { mockDashboardStats, mockSalesInvoices } from "../data/mockSalesData"
import type { SalesInvoice, DashboardStats } from "../../types"

import BottomNavigation from "../components/BottomNavigation"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { usePOSDetails } from "../hooks/usePOSProfile"
import { useAllPaymentModes } from "../hooks/usePaymentModes"
import { useSalesInvoices } from "../hooks/useSalesInvoices"
import { useUserInfo } from "../hooks/useUserInfo"

export default function DashboardPage() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery("(max-width: 1024px)")
  const { posDetails } = usePOSDetails()
  const { invoices, isLoading: invoicesLoading, error: invoicesError } = useSalesInvoices()
  const { userInfo, isLoading: userInfoLoading } = useUserInfo()
  // Blank => current POS opening session
  const [timeRange, setTimeRange] = useState("")
  // Current session payment summary from backend (includes zero-amount methods)
  const { modes: sessionPaymentSummary, isLoading: sessionSummaryLoading } = useAllPaymentModes()


  // Get currency symbol from POS details
  const currencySymbol = getCurrencySymbol(posDetails?.currency || 'USD')

  // Role-based access control
  const isAdminUser = userInfo?.is_admin_user || false
  const currentUserCashier = userInfo?.full_name || "Unknown"
  const [cashierFilter, setCashierFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [salesByHourGraphType, setSalesByHourGraphType] = useState<"bar" | "line">("bar")
  const stats = mockDashboardStats

  const uniqueCashiers = [...new Set(invoices.map((invoice: SalesInvoice) => invoice.cashier))]

  // Set default cashier filter based on user role
  useEffect(() => {
    if (userInfo && !isAdminUser) {
      // For non-admin users, set cashier filter to current user
      setCashierFilter(currentUserCashier)
    }
  }, [userInfo, isAdminUser, currentUserCashier])

  // Loading state - must be after all hooks
  if (userInfoLoading || invoicesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter data based on selected filters and user role
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter
    const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter

    // Apply time range filter (blank = current session → do not restrict by date)
    const today = new Date().toISOString().split("T")[0]
    const matchesTime =
      (timeRange === "" && true) ||
      (timeRange === "today" && invoice.date === today) ||
      (timeRange === "week" && new Date(invoice.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (timeRange === "month" && new Date(invoice.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

    // For current session: restrict to current POS opening entry
    const matchesOpening =
      timeRange !== "" || !posDetails?.current_opening_entry
        ? true
        : invoice.custom_pos_opening_entry === posDetails.current_opening_entry

    // Role-based filtering: Non-admin users only see invoices for their POS profile
    const matchesPOSProfile = isAdminUser || !posDetails?.name || invoice.posProfile === posDetails.name

    return matchesCashier && matchesPayment && matchesTime && matchesOpening && matchesPOSProfile
  })

  // Inline debug logs (no hooks added)
  try {
    // eslint-disable-next-line no-console
    console.log('[Dashboard] timeRange:', timeRange, 'current_opening_entry:', posDetails?.current_opening_entry)
    const summary = filteredInvoices.map((inv: SalesInvoice) => ({
      id: inv.id,
      date: inv.date,
      time: inv.time,
      posOpening: (inv as any).custom_pos_opening_entry,
      total: inv.totalAmount,
      paymentMethod: inv.paymentMethod,
    }))
    // eslint-disable-next-line no-console
    console.log('[Dashboard] invoices used for metrics:', summary)
  } catch {}

  const filteredStats = (() => {
    // Always derive core stats from the filtered invoices (respects current opening entry when blank)
    const totalRevenue = filteredInvoices.reduce((sum: number, inv: SalesInvoice) => sum + inv.totalAmount, 0)
    const totalTransactions = filteredInvoices.length
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const totalItems = filteredInvoices.reduce((sum: number, inv: SalesInvoice) => sum + inv.items.length, 0)
    console.log("here",totalRevenue)
    return { totalRevenue, totalTransactions, averageOrderValue, totalItems }
  })()

  // Calculate sales by hour for today only using posting_time
  const calculateSalesByHour = () => {
    if (timeRange !== "today") return []

    const today = new Date().toISOString().split("T")[0]
    const todayInvoices = filteredInvoices.filter(inv => inv.date === today)
    const hourlySales: { [key: string]: number } = {}

    // Initialize all hours with 0 (9 AM to 8 PM)
    for (let i = 9; i <= 20; i++) {
      const hour = `${i.toString().padStart(2, '0')}:00`
      hourlySales[hour] = 0
    }
    // Aggregate total revenue by hour using posting_time
    todayInvoices.forEach(invoice => {
      // Extract hour from posting_time (format: HH:MM:SS)
      const timeParts = invoice.time.split(':')
      if (timeParts.length >= 2) {
        const hour = `${timeParts[0].padStart(2, '0')}:00`
        if (hourlySales.hasOwnProperty(hour)) {
          hourlySales[hour] += invoice.totalAmount
        }
      }
    })

    return Object.entries(hourlySales).map(([hour, sales]) => ({ hour, sales }))
  }

  const salesByHourData = calculateSalesByHour()

  // Calculate payment methods - show all POS profile methods, even with zero amounts
  const calculatePaymentMethods = () => {
    const methodMap: { [key: string]: { amount: number; transactions: number } } = {}

    // Initialize with all POS profile payment methods (from session summary)
    const allMethods = (sessionPaymentSummary || []) as any[]
    allMethods.forEach((m: any) => {
      const key = m.name || m.mode_of_payment
      methodMap[key] = { amount: 0, transactions: 0 }
    })

    // Aggregate from filtered invoices (respects current opening entry)
    filteredInvoices.forEach(invoice => {
      const method = invoice.paymentMethod || 'Cash'
      if (!methodMap[method]) {
        methodMap[method] = { amount: 0, transactions: 0 }
      }
      methodMap[method].amount += invoice.totalAmount
      methodMap[method].transactions += 1
    })

    const totalAmount = Object.values(methodMap).reduce((sum, m) => sum + m.amount, 0)
    return Object.entries(methodMap).map(([method, data]) => ({
      method,
      amount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      transactions: data.transactions,
    }))
  }

  const paymentMethodsData = calculatePaymentMethods()

  // Inline debug: log the exact invoices used for metrics (respects current opening entry when timeRange is blank)
  try {
    // Summarize to keep console readable
    // eslint-disable-next-line no-console
    console.log('[Dashboard] timeRange:', timeRange, 'current_opening_entry:', posDetails?.current_opening_entry)
    const summary = filteredInvoices.map((inv: SalesInvoice) => ({
      id: inv.id,
      date: inv.date,
      time: inv.time,
      posOpening: (inv as any).custom_pos_opening_entry || inv.custom_pos_opening_entry,
      total: inv.totalAmount,
      paymentMethod: inv.paymentMethod,
    }))
    // eslint-disable-next-line no-console
    console.log('[Dashboard] invoices used for metrics:', summary)
  } catch (_) {}


  // ZATCA status distribution from invoices
  const calculateZatcaStatus = () => {
    const statusCounts: { [key: string]: number } = {}
    filteredInvoices.forEach(inv => {
      const status = (inv.custom_zatca_submit_status || 'Draft') as string
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)

    // Match colors used in Invoice History badges
    const colorMapByNormalized: { [key: string]: string } = {
      'pending': '#f59e0b',       // yellow-500
      'reported': '#3b82f6',      // blue-500
      'not reported': '#9ca3af',  // gray-400/500
      'cleared': '#16a34a',       // green-600
      'not cleared': '#ef4444',   // red-500
      'draft': '#6b7280',         // gray-500
    }

    const segments = Object.entries(statusCounts).map(([status, count]) => {
      const normalized = status.toLowerCase()
      const color = colorMapByNormalized[normalized] || '#9ca3af'
      return {
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color,
      }
    })

    return {
      total,
      segments: segments.sort((a, b) => b.count - a.count),
    }
  }

  const zatcaData = calculateZatcaStatus()

  // Calculate top performer based on doc owner (cashier)
  const calculateTopPerformer = () => {
    const cashierStats: { [key: string]: { name: string; sales: number; transactions: number } } = {}

    filteredInvoices.forEach(invoice => {
      const cashier = invoice.cashier || 'Unknown'
      if (!cashierStats[cashier]) {
        cashierStats[cashier] = { name: cashier, sales: 0, transactions: 0 }
      }
      cashierStats[cashier].sales += invoice.totalAmount
      cashierStats[cashier].transactions += 1
    })

    const sortedCashiers = Object.values(cashierStats).sort((a, b) => b.sales - a.sales)
    return sortedCashiers[0] || null
  }

  const topPerformer = calculateTopPerformer()

  // Calculate top selling products from invoices
  const calculateTopProducts = () => {
    const productStats: { [key: string]: { name: string; sales: number; revenue: number } } = {}

    filteredInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const productKey = item.item_code || item.item_name || 'Unknown'
        if (!productStats[productKey]) {
          productStats[productKey] = { name: item.item_name || item.item_code || 'Unknown', sales: 0, revenue: 0 }
        }
        productStats[productKey].sales += item.qty || 0
        productStats[productKey].revenue += (item.rate || 0) * (item.qty || 0)
      })
    })

    return Object.entries(productStats)
      .map(([key, data]) => ({ id: key, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }

  const topProducts = calculateTopProducts()

  // Get recent transactions (last 5 invoices)
  const recentTransactions = filteredInvoices
    .sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime())
    .slice(0, 5)

  // Mobile layout: full-width content and persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sales Dashboard</h1>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">Filters</span>
                </button>
                {/* <button className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Refresh</span>
                </button> */}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          {/* Enhanced Filters */}
          {showFilters && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dashboard Filters</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Current POS Session</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cashier</label>
                  <select
                    value={cashierFilter}
                    onChange={(e) => setCashierFilter(e.target.value)}
                    disabled={!isAdminUser}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      !isAdminUser ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="all">All Cashiers</option>
                    {uniqueCashiers.map((cashier: string) => (
                      <option key={cashier} value={cashier}>
                        {cashier}
                      </option>
                    ))}
                  </select>
                  {!isAdminUser && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Showing only your transactions
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Debit Card">Debit Card</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setTimeRange("today")
                      setCashierFilter("all")
                      setPaymentFilter("all")
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Key Metrics */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(filteredStats.totalRevenue, posDetails?.currency || 'USD')}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600 dark:text-orange-400">+12.5%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {filteredStats.totalTransactions}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-blue-500 mr-1" />
                    <span className="text-sm text-blue-600 dark:text-blue-400">+8.2%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(filteredStats.averageOrderValue, posDetails?.currency || 'USD')}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                    <span className="text-sm text-orange-600 dark:text-orange-400">+3.8%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Items Sold</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {filteredStats.totalItems}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                    <span className="text-sm text-red-600 dark:text-red-400">-2.1%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* Sales by Hour Chart - Only show for today */}
            {timeRange === "today" && salesByHourData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales by Hour (Today)</h3>
                  <div className="flex items-center space-x-3">
                    {/* Graph Type Toggle */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setSalesByHourGraphType("bar")}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          salesByHourGraphType === "bar"
                            ? "bg-beveren-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        Bar
                      </button>
                      <button
                        onClick={() => setSalesByHourGraphType("line")}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          salesByHourGraphType === "line"
                            ? "bg-beveren-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        Line
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Peak: {salesByHourData.reduce((max, item) => item.sales > max.sales ? item : max, salesByHourData[0])?.hour || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-48 flex items-end justify-between space-x-1">
                  {salesByHourData.map((item: { hour: string; sales: number }, index: number) => {
                    const maxSales = Math.max(...salesByHourData.map(s => s.sales))
                    const height = maxSales > 0 ? (item.sales / maxSales) * 180 : 4

                    return (
                      <div key={index} className="flex flex-col items-center flex-1 group">
                        <div className="relative w-full">
                          {salesByHourGraphType === "bar" ? (
                            <div
                              className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                              style={{
                                height: `${height}px`,
                                minHeight: "4px",
                              }}
                              title={`${item.hour}: ${formatCurrency(item.sales, posDetails?.currency || 'USD')}`}
                            ></div>
                          ) : (
                            <div className="relative w-full h-full">
                              {/* Line graph implementation */}
                              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                {index > 0 && (
                                  <line
                                    x1="0"
                                    y1={`${100 - (salesByHourData[index - 1].sales / maxSales) * 100}`}
                                    x2="100"
                                    y2={`${100 - (item.sales / maxSales) * 100}`}
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-beveren-600 dark:text-beveren-400"
                                  />
                                )}
                                <circle
                                  cx="100"
                                  cy={`${100 - (item.sales / maxSales) * 100}`}
                                  r="2"
                                  fill="currentColor"
                                  className="text-beveren-600 dark:text-beveren-400"
                                />
                              </svg>
                            </div>
                          )}
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {formatCurrency(item.sales, posDetails?.currency || 'USD')}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left">
                          {item.hour}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Revenue: <span className="font-semibold text-beveren-600 dark:text-beveren-400">
                      {formatCurrency(salesByHourData.reduce((sum, item) => sum + item.sales, 0), posDetails?.currency || 'USD')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Methods Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
                <PieChart className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {paymentMethodsData.map((method, index) => {
                  const colors = ['bg-orange-500', 'bg-beveren-600', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
                  const color = colors[index % colors.length]
                  return (
                    <div key={method.method} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 ${color} rounded`}></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{method.method}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(method.amount, posDetails?.currency || 'USD')}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {method.percentage.toFixed(1)}% • {method.transactions} txns
                        </div>
                      </div>
                    </div>
                  )
                })}
                {paymentMethodsData.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No payment data available for selected period
                  </div>
                )}
              </div>
              <div className="mt-4">
                <div className="flex rounded-lg overflow-hidden h-4">
                  {paymentMethodsData.map((method, index) => {
                    const colors = ['bg-orange-500', 'bg-beveren-600', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
                    const color = colors[index % colors.length]
                    return (
                      <div
                        key={method.method}
                        className={color}
                        style={{ width: `${method.percentage}%` }}
                      ></div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* ZATCA Status Bar Chart (mobile) */}
            {posDetails?.is_zatca_enabled && zatcaData.total > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ZATCA Status</h3>
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                </div>
                <div className="h-48 flex items-end justify-between space-x-2 mb-4">
                  {zatcaData.segments.map((segment, index) => {
                    const maxCount = Math.max(...zatcaData.segments.map(s => s.count))
                    const height = maxCount > 0 ? (segment.count / maxCount) * 180 : 4

                    return (
                      <div key={segment.status} className="flex flex-col items-center flex-1 group">
                        <div className="relative w-full">
                          <div
                            className="w-full rounded-t hover:opacity-80 transition-opacity cursor-pointer"
                            style={{
                              height: `${height}px`,
                              minHeight: "4px",
                              backgroundColor: segment.color
                            }}
                            title={`${segment.status}: ${segment.count} (${Math.round(segment.percentage)}%)`}
                          ></div>
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {segment.count}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center leading-tight">
                          {segment.status}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="space-y-2">
                  {zatcaData.segments.map(segment => (
                    <div key={segment.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: segment.color }}></span>
                        <span className="text-gray-700 dark:text-gray-300">{segment.status}</span>
                      </div>
                      <span className="text-gray-600 dark:text-gray-400">
                        {segment.count} ({Math.round(segment.percentage)}%)
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Total Invoices: <span className="font-semibold text-beveren-600 dark:text-beveren-400">{zatcaData.total}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Gift Card Usage */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gift Card Usage</h3>
                <Gift className="w-5 h-5 text-orange-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Redeemed</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(stats.giftCardUsage.totalRedeemed, posDetails?.currency || 'USD')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {stats.giftCardUsage.totalTransactions}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Discount</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {formatCurrency(stats.giftCardUsage.averageDiscount, posDetails?.currency || 'USD')}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {((stats.giftCardUsage.totalTransactions / (filteredStats.totalTransactions || 1)) * 100).toFixed(1)}% of all
                    transactions
                  </div>
                </div>
              </div>
            </div>

            {/* Top Cashier */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performer</h3>
                <Users className="w-5 h-5 text-beveren-600" />
              </div>
              {topPerformer ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-beveren-600 rounded-full flex items-center justify-center mx-auto mb-3 relative">
                    <span className="text-white font-bold text-xl">
                      {topPerformer.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </span>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                      <span className="text-xs">👑</span>
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{topPerformer.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {topPerformer.transactions} transactions
                  </p>
                  <p className="text-lg font-bold text-beveren-600 dark:text-beveren-400">
                    {formatCurrency(topPerformer.sales, posDetails?.currency || 'USD')}
                  </p>
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {filteredStats.totalRevenue > 0 ? ((topPerformer.sales / filteredStats.totalRevenue) * 100).toFixed(1) : 0}% of total sales
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No sales data available for selected period
                </div>
              )}
            </div>

            {/* Weekly Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Trend</h3>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div className="h-24 flex items-end justify-between space-x-1 mb-4">
                {stats.salesByDay.map((item: { day: string; sales: number }, index: number) => (
                  <div key={index} className="flex flex-col items-center flex-1 group">
                    <div className="relative">
                      <div
                        className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                        style={{
                          height: `${(item.sales / Math.max(...stats.salesByDay.map((s: { day: string; sales: number }) => s.sales))) * 60}px`,
                          minHeight: "4px",
                        }}
                        title={`${item.day}: ${formatCurrency(item.sales, posDetails?.currency || 'USD')}`}
                      ></div>
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {formatCurrency(item.sales, posDetails?.currency || 'USD')}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.day}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Best day: <span className="font-semibold text-beveren-600 dark:text-beveren-400">Friday</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 gap-4">
            {/* Top Products */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Selling Products</h3>
                <button className="text-sm text-beveren-600 dark:text-beveren-400 hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-beveren-100 dark:bg-beveren-900/20 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-beveren-600 dark:text-beveren-400">{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {product.sales} sold
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(product.revenue, posDetails?.currency || 'USD')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(product.sales > 0 ? (product.revenue / product.sales) : 0, posDetails?.currency || 'USD')} avg
                      </div>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No product data available for selected period
                  </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
                <button
                  onClick={() => navigate("/closing_shift")}
                  className="text-sm text-beveren-600 dark:text-beveren-400 hover:underline"
                >
                  View All Reports
                </button>
              </div>
              <div className="space-y-3">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        {transaction.paymentMethod === "Cash" ? (
                          <span className="text-lg">💵</span>
                        ) : (
                          <CreditCard className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{transaction.id}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaction.customer} • {transaction.time}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(transaction.totalAmount, transaction.currency || posDetails?.currency || 'USD')}
                      </div>
                      <div
                        className={`text-xs ${
                          transaction.status === "Completed"
                            ? "text-green-600 dark:text-green-400"
                            : transaction.status === "Refunded"
                              ? "text-red-600 dark:text-red-400"
                              : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {transaction.status}
                      </div>
                    </div>
                  </div>
                ))}
                {recentTransactions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No transactions available for selected period
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex pb-12">

      <div className="flex-1 flex flex-col overflow-hidden ml-20">
      {/* Header */}
      <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">

              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Sales Dashboard</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              {/* <button className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button> */}
              {/* <button className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button> */}
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 px-6 py-8 mt-16">
        {/* Enhanced Filters */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 mb-6 sm:mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dashboard Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Current POS Session</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cashier</label>
                <select
                  value={cashierFilter}
                  onChange={(e) => setCashierFilter(e.target.value)}
                  disabled={!isAdminUser}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    !isAdminUser ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="all">All Cashiers</option>
                  {uniqueCashiers.map((cashier: string) => (
                    <option key={cashier} value={cashier}>
                      {cashier}
                    </option>
                  ))}
                </select>
                {!isAdminUser && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Showing only your transactions
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Debit Card">Debit Card</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setTimeRange("today")
                    setCashierFilter("all")
                    setPaymentFilter("all")
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(filteredStats.totalRevenue, posDetails?.currency || 'USD')}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                  <span className="text-sm text-orange-600 dark:text-orange-400">+12.5%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {filteredStats.totalTransactions}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                  <span className="text-sm text-orange-600 dark:text-blue-400">+8.2%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(filteredStats.averageOrderValue, posDetails?.currency || 'USD')}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-orange-500 mr-1" />
                  <span className="text-sm text-orange-600 dark:text-orange-400">+3.8%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items Sold</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {filteredStats.totalItems}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600 dark:text-red-400">-2.1%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Sales by Hour Chart - Only show for today */}
          {timeRange === "today" && salesByHourData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales by Hour (Today)</h3>
                <div className="flex items-center space-x-4">
                  {/* Graph Type Toggle */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSalesByHourGraphType("bar")}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        salesByHourGraphType === "bar"
                          ? "bg-beveren-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      Bar
                    </button>
                    <button
                      onClick={() => setSalesByHourGraphType("line")}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        salesByHourGraphType === "line"
                          ? "bg-beveren-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      Line
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                      Peak: {salesByHourData.reduce((max, item) => item.sales > max.sales ? item : max, salesByHourData[0])?.hour || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-48 sm:h-64 flex items-end justify-between space-x-1">
                {salesByHourData.map((item: { hour: string; sales: number }, index: number) => {
                  const maxSales = Math.max(...salesByHourData.map(s => s.sales))
                  const height = maxSales > 0 ? (item.sales / maxSales) * 180 : 4

                  return (
                    <div key={index} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full">
                        {salesByHourGraphType === "bar" ? (
                          <div
                            className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                            style={{
                              height: `${height}px`,
                              minHeight: "4px",
                            }}
                            title={`${item.hour}: ${formatCurrency(item.sales, posDetails?.currency || 'USD')}`}
                          ></div>
                        ) : (
                          <div className="relative w-full h-full">
                            {/* Line graph implementation */}
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              {index > 0 && (
                                <line
                                  x1="0"
                                  y1={`${100 - (salesByHourData[index - 1].sales / maxSales) * 100}`}
                                  x2="100"
                                  y2={`${100 - (item.sales / maxSales) * 100}`}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="text-beveren-600 dark:text-beveren-400"
                                />
                              )}
                              <circle
                                cx="100"
                                cy={`${100 - (item.sales / maxSales) * 100}`}
                                r="3"
                                fill="currentColor"
                                className="text-beveren-600 dark:text-beveren-400"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {formatCurrency(item.sales, posDetails?.currency || 'USD')}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left">
                        {item.hour}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Revenue: <span className="font-semibold text-beveren-600 dark:text-beveren-400">
                    {formatCurrency(salesByHourData.reduce((sum, item) => sum + item.sales, 0), posDetails?.currency || 'USD')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Payment Methods Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {paymentMethodsData.map((method, index) => {
                const colors = ['bg-orange-500', 'bg-beveren-600', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
                const color = colors[index % colors.length]
                return (
                  <div key={method.method} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 ${color} rounded`}></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{method.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(method.amount, posDetails?.currency || 'USD')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {method.percentage.toFixed(1)}% • {method.transactions} txns
                      </div>
                    </div>
                  </div>
                )
              })}
              {paymentMethodsData.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No payment data available for selected period
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="flex rounded-lg overflow-hidden h-4">
                {paymentMethodsData.map((method, index) => {
                  const colors = ['bg-orange-500', 'bg-beveren-600', 'bg-green-500', 'bg-purple-500', 'bg-pink-500']
                  const color = colors[index % colors.length]
                  return (
                    <div
                      key={method.method}
                      className={color}
                      style={{ width: `${method.percentage}%` }}
                    ></div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* ZATCA Status Bar Chart (desktop) */}
          {posDetails?.is_zatca_enabled && zatcaData.total > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ZATCA Status</h3>
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <div className="h-64 flex items-end justify-between space-x-3 mb-6">
                {zatcaData.segments.map((segment, index) => {
                  const maxCount = Math.max(...zatcaData.segments.map(s => s.count))
                  const height = maxCount > 0 ? (segment.count / maxCount) * 200 : 4

                  return (
                    <div key={segment.status} className="flex flex-col items-center flex-1 group">
                      <div className="relative w-full">
                        <div
                          className="w-full rounded-t hover:opacity-80 transition-opacity cursor-pointer"
                          style={{
                            height: `${height}px`,
                            minHeight: "4px",
                            backgroundColor: segment.color
                          }}
                          title={`${segment.status}: ${segment.count} (${Math.round(segment.percentage)}%)`}
                        ></div>
                        <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {segment.count}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center leading-tight">
                        {segment.status}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="space-y-3">
                {zatcaData.segments.map(segment => (
                  <div key={segment.status} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: segment.color }}></span>
                      <span className="text-gray-700 dark:text-gray-300">{segment.status}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {segment.count} ({Math.round(segment.percentage)}%)
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Total Invoices: <span className="font-semibold text-beveren-600 dark:text-beveren-400">{zatcaData.total}</span>
                </div>
              </div>
            </div>
          )}
          {/* Enhanced Gift Card Usage - HIDDEN (not currently used) */}
          {/* <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gift Card Usage</h3>
              <Gift className="w-5 h-5 text-orange-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Redeemed</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${stats.giftCardUsage.totalRedeemed.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.giftCardUsage.totalTransactions}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Avg Discount</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  ${stats.giftCardUsage.averageDiscount.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {((stats.giftCardUsage.totalTransactions / (filteredStats.totalTransactions || 1)) * 100).toFixed(1)}% of all
                  transactions
                </div>
              </div>
            </div>
          </div> */}

          {/* Enhanced Top Cashier */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performer</h3>
              <Users className="w-5 h-5 text-beveren-600" />
            </div>
            {topPerformer ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-beveren-600 rounded-full flex items-center justify-center mx-auto mb-3 relative">
                  <span className="text-white font-bold text-xl">
                    {topPerformer.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </span>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-xs">👑</span>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{topPerformer.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {topPerformer.transactions} transactions
                </p>
                <p className="text-lg font-bold text-beveren-600 dark:text-beveren-400">
                  {formatCurrency(topPerformer.sales, posDetails?.currency || 'USD')}
                </p>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {filteredStats.totalRevenue > 0 ? ((topPerformer.sales / filteredStats.totalRevenue) * 100).toFixed(1) : 0}% of total sales
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No sales data available for selected period
              </div>
            )}
          </div>

          {/* Fixed Weekly Trend - HIDDEN (will implement real data later) */}
          {/* <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Trend</h3>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <div className="h-20 sm:h-24 flex items-end justify-between space-x-1 mb-4">
              {stats.salesByDay.map((item: { day: string; sales: number }, index: number) => (
                <div key={index} className="flex flex-col items-center flex-1 group">
                  <div className="relative">
                    <div
                      className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                      style={{
                        height: `${(item.sales / Math.max(...stats.salesByDay.map((s: { day: string; sales: number }) => s.sales))) * 60}px`,
                        minHeight: "4px",
                      }}
                      title={`${item.day}: ${formatCurrency(item.sales, posDetails?.currency || 'USD')}`}
                    ></div>
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {formatCurrency(item.sales, posDetails?.currency || 'USD')}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.day}</span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Best day: <span className="font-semibold text-beveren-600 dark:text-beveren-400">Friday</span>
              </div>
            </div>
          </div> */}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Enhanced Top Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Selling Products</h3>
              <button className="text-sm text-beveren-600 dark:text-beveren-400 hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-beveren-100 dark:bg-beveren-900/20 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-beveren-600 dark:text-beveren-400">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {product.sales} sold
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(product.revenue, posDetails?.currency || 'USD')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatCurrency(product.sales > 0 ? (product.revenue / product.sales) : 0, posDetails?.currency || 'USD')} avg
                    </div>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No product data available for selected period
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
              <button
                onClick={() => navigate("/closing_shift")}
                className="text-sm text-beveren-600 dark:text-beveren-400 hover:underline"
              >
                View All Reports
              </button>
            </div>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                      {transaction.paymentMethod === "Cash" ? (
                        <span className="text-lg">💵</span>
                      ) : (
                        <CreditCard className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{transaction.id}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {transaction.customer} • {transaction.time}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(transaction.totalAmount, transaction.currency || posDetails?.currency || 'USD')}
                    </div>
                    <div
                      className={`text-xs ${
                        transaction.status === "Completed"
                          ? "text-green-600 dark:text-green-400"
                          : transaction.status === "Refunded"
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                      }`}
                    >
                      {transaction.status}
                    </div>
                  </div>
                </div>
              ))}
              {recentTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No transactions available for selected period
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
