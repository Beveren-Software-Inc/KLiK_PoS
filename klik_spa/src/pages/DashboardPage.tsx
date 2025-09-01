import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
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
  RefreshCw,
} from "lucide-react"
import { mockDashboardStats, mockSalesInvoices } from "../data/mockSalesData"
import type { SalesInvoice, DashboardStats } from "../../types"
import RetailSidebar from "../components/RetailSidebar"
import BottomNavigation from "../components/BottomNavigation"
import { useMediaQuery } from "../hooks/useMediaQuery"

export default function DashboardPage() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery("(max-width: 1024px)")
  const [timeRange, setTimeRange] = useState("today")
  const [cashierFilter, setCashierFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const stats = mockDashboardStats

  const uniqueCashiers = [...new Set(mockSalesInvoices.map((invoice: SalesInvoice) => invoice.cashier))]

  const getStatsForRange = () => {
    switch (timeRange) {
      case "today":
        return stats.todaySales
      case "week":
        return stats.weekSales
      case "month":
        return stats.monthSales
      default:
        return stats.todaySales
    }
  }

  const currentStats = getStatsForRange()

  // Filter data based on selected filters
  const filteredInvoices = mockSalesInvoices.filter((invoice) => {
    const matchesCashier = cashierFilter === "all" || invoice.cashier === cashierFilter
    const matchesPayment = paymentFilter === "all" || invoice.paymentMethod === paymentFilter

    // Apply time range filter
    const today = new Date().toISOString().split("T")[0]
    const matchesTime =
      (timeRange === "today" && invoice.date === today) ||
      (timeRange === "week" && new Date(invoice.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (timeRange === "month" && new Date(invoice.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

    return matchesCashier && matchesPayment && matchesTime
  })

  const filteredStats = {
    totalRevenue: filteredInvoices.reduce((sum: number, inv: SalesInvoice) => sum + inv.totalAmount, 0),
    totalTransactions: filteredInvoices.length,
    averageOrderValue:
      filteredInvoices.length > 0
        ? filteredInvoices.reduce((sum: number, inv: SalesInvoice) => sum + inv.totalAmount, 0) / filteredInvoices.length
        : 0,
    totalItems: filteredInvoices.reduce((sum: number, inv: SalesInvoice) => sum + inv.items.length, 0),
  }

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
                <button className="flex items-center space-x-2 px-3 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Refresh</span>
                </button>
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Cashiers</option>
                    {uniqueCashiers.map((cashier: string) => (
                      <option key={cashier} value={cashier}>
                        {cashier}
                      </option>
                    ))}
                  </select>
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
                    $
                    {(cashierFilter !== "all" || paymentFilter !== "all"
                      ? filteredStats.totalRevenue
                      : currentStats.totalRevenue
                    ).toFixed(2)}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600 dark:text-green-400">+12.5%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {cashierFilter !== "all" || paymentFilter !== "all"
                      ? filteredStats.totalTransactions
                      : currentStats.totalTransactions}
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
                    $
                    {(cashierFilter !== "all" || paymentFilter !== "all"
                      ? filteredStats.averageOrderValue
                      : currentStats.averageOrderValue
                    ).toFixed(2)}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="w-4 h-4 text-purple-500 mr-1" />
                    <span className="text-sm text-purple-600 dark:text-purple-400">+3.8%</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">vs last period</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Items Sold</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {cashierFilter !== "all" || paymentFilter !== "all"
                      ? filteredStats.totalItems
                      : currentStats.totalItems}
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
            {/* Sales by Hour Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales by Hour</h3>
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Peak: 13:00</span>
                </div>
              </div>
              <div className="h-48 flex items-end justify-between space-x-1">
                {stats.salesByHour.map((item: { hour: string; sales: number }, index: number) => (
                  <div key={index} className="flex flex-col items-center flex-1 group">
                    <div className="relative">
                      <div
                        className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                        style={{
                          height: `${(item.sales / Math.max(...stats.salesByHour.map((s: { hour: string; sales: number }) => s.sales))) * 180}px`,
                          minHeight: "4px",
                        }}
                        title={`${item.hour}: $${item.sales.toFixed(2)}`}
                      ></div>
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        ${item.sales.toFixed(0)}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left">
                      {item.hour}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Methods Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
                <PieChart className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Cash</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${stats.paymentMethods.cash.amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {stats.paymentMethods.cash.percentage}% • {stats.paymentMethods.cash.transactions} txns
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-beveren-600 rounded"></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Debit Card</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${stats.paymentMethods.debitCard.amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {stats.paymentMethods.debitCard.percentage}% • {stats.paymentMethods.debitCard.transactions} txns
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex rounded-lg overflow-hidden h-4">
                    <div className="bg-green-500" style={{ width: `${stats.paymentMethods.cash.percentage}%` }}></div>
                    <div
                      className="bg-beveren-600"
                      style={{ width: `${stats.paymentMethods.debitCard.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* Gift Card Usage */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gift Card Usage</h3>
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
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
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    ${stats.giftCardUsage.averageDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {((stats.giftCardUsage.totalTransactions / currentStats.totalTransactions) * 100).toFixed(1)}% of all
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
              <div className="text-center">
                <div className="w-16 h-16 bg-beveren-600 rounded-full flex items-center justify-center mx-auto mb-3 relative">
                  <span className="text-white font-bold text-xl">
                    {stats.salesByCashier[0].name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </span>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-xs">👑</span>
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white">{stats.salesByCashier[0].name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {stats.salesByCashier[0].transactions} transactions
                </p>
                <p className="text-lg font-bold text-beveren-600 dark:text-beveren-400">
                  ${stats.salesByCashier[0].sales.toFixed(2)}
                </p>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {(
                    (stats.salesByCashier[0].sales / stats.salesByCashier.reduce((sum: number, c: { name: string; sales: number; transactions: number; id: string }) => sum + c.sales, 0)) *
                    100
                  ).toFixed(1)}
                  % of team sales
                </div>
              </div>
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
                        title={`${item.day}: $${item.sales.toFixed(2)}`}
                      ></div>
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        ${item.sales.toFixed(0)}
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
                {stats.topProducts.map((product: { id: string; name: string; category: string; sales: number; revenue: number }, index: number) => (
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
                          {product.category} • {product.sales} sold
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">${product.revenue.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        ${(product.revenue / product.sales).toFixed(2)} avg
                      </div>
                    </div>
                  </div>
                ))}
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
                {stats.recentTransactions.map((transaction: SalesInvoice) => (
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
                        ${transaction.totalAmount.toFixed(2)}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">

      <RetailSidebar/>
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-20 right-0 z-50 bg-beveren-50 dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
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
              <button className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

        <div className="flex-1 px-6 py-8 mt-16 ml-20">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Cashiers</option>
                  {uniqueCashiers.map((cashier: string) => (
                    <option key={cashier} value={cashier}>
                      {cashier}
                    </option>
                  ))}
                </select>
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
                  $
                  {(cashierFilter !== "all" || paymentFilter !== "all"
                    ? filteredStats.totalRevenue
                    : currentStats.totalRevenue
                  ).toFixed(2)}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 dark:text-green-400">+12.5%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {cashierFilter !== "all" || paymentFilter !== "all"
                    ? filteredStats.totalTransactions
                    : currentStats.totalTransactions}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-blue-500 mr-1" />
                  <span className="text-sm text-blue-600 dark:text-blue-400">+8.2%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  $
                  {(cashierFilter !== "all" || paymentFilter !== "all"
                    ? filteredStats.averageOrderValue
                    : currentStats.averageOrderValue
                  ).toFixed(2)}
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-purple-500 mr-1" />
                  <span className="text-sm text-purple-600 dark:text-purple-400">+3.8%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 hidden sm:inline">vs last period</span>
                </div>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items Sold</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {cashierFilter !== "all" || paymentFilter !== "all"
                    ? filteredStats.totalItems
                    : currentStats.totalItems}
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
          {/* Fixed Sales by Hour Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sales by Hour</h3>
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Peak: 13:00</span>
              </div>
            </div>
            <div className="h-48 sm:h-64 flex items-end justify-between space-x-1">
              {stats.salesByHour.map((item: { hour: string; sales: number }, index: number) => (
                <div key={index} className="flex flex-col items-center flex-1 group">
                  <div className="relative">
                    <div
                      className="w-full bg-beveren-600 dark:bg-beveren-500 rounded-t hover:bg-beveren-700 dark:hover:bg-beveren-400 transition-colors cursor-pointer"
                      style={{
                        height: `${(item.sales / Math.max(...stats.salesByHour.map((s: { hour: string; sales: number }) => s.sales))) * 180}px`,
                        minHeight: "4px",
                      }}
                      title={`${item.hour}: $${item.sales.toFixed(2)}`}
                    ></div>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      ${item.sales.toFixed(0)}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-top-left">
                    {item.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Payment Methods Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Cash</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${stats.paymentMethods.cash.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {stats.paymentMethods.cash.percentage}% • {stats.paymentMethods.cash.transactions} txns
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-beveren-600 rounded"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Debit Card</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${stats.paymentMethods.debitCard.amount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {stats.paymentMethods.debitCard.percentage}% • {stats.paymentMethods.debitCard.transactions} txns
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex rounded-lg overflow-hidden h-4">
                  <div className="bg-green-500" style={{ width: `${stats.paymentMethods.cash.percentage}%` }}></div>
                  <div
                    className="bg-beveren-600"
                    style={{ width: `${stats.paymentMethods.debitCard.percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Enhanced Gift Card Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gift Card Usage</h3>
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
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
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  ${stats.giftCardUsage.averageDiscount.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {((stats.giftCardUsage.totalTransactions / currentStats.totalTransactions) * 100).toFixed(1)}% of all
                  transactions
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Top Cashier */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Performer</h3>
              <Users className="w-5 h-5 text-beveren-600" />
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-beveren-600 rounded-full flex items-center justify-center mx-auto mb-3 relative">
                <span className="text-white font-bold text-xl">
                  {stats.salesByCashier[0].name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </span>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-xs">👑</span>
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{stats.salesByCashier[0].name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {stats.salesByCashier[0].transactions} transactions
              </p>
              <p className="text-lg font-bold text-beveren-600 dark:text-beveren-400">
                ${stats.salesByCashier[0].sales.toFixed(2)}
              </p>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {(
                  (stats.salesByCashier[0].sales / stats.salesByCashier.reduce((sum: number, c: { name: string; sales: number; transactions: number; id: string }) => sum + c.sales, 0)) *
                  100
                ).toFixed(1)}
                % of team sales
              </div>
            </div>
          </div>

          {/* Fixed Weekly Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
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
                      title={`${item.day}: $${item.sales.toFixed(2)}`}
                    ></div>
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-700 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      ${item.sales.toFixed(0)}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Enhanced Top Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Selling Products</h3>
              <button className="text-sm text-beveren-600 dark:text-beveren-400 hover:underline">View All</button>
            </div>
            <div className="space-y-4">
              {stats.topProducts.map((product: { id: string; name: string; category: string; sales: number; revenue: number }, index: number) => (
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
                        {product.category} • {product.sales} sold
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">${product.revenue.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${(product.revenue / product.sales).toFixed(2)} avg
                    </div>
                  </div>
                </div>
              ))}
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
              {stats.recentTransactions.map((transaction: SalesInvoice) => (
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
                      ${transaction.totalAmount.toFixed(2)}
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
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
