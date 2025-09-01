

import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { 
  Search, 
  Plus, 
  Filter, 
  Phone, 
  Mail, 
  Crown,
  Star,
  Users,
  Eye,
  Edit,

} from "lucide-react"
import { useCustomers } from "../hooks/useCustomers" // Import the hook
import AddCustomerModal from "./AddCustomerModal"
import type { Customer } from "../../types"
import RetailSidebar from "./RetailSidebar"
import BottomNavigation from "./BottomNavigation"
import { useMediaQuery } from "../hooks/useMediaQuery"
import type { Customer as ModalCustomer } from "../data/mockCustomers"

export default function CustomersPage() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery("(max-width: 1024px)")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | Customer['status']>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [prefilledData, setPrefilledData] = useState<{name?: string, email?: string, phone?: string}>({})

  // Use the customers hook
  const { customers, isLoading, error } = useCustomers()

  // Filter and search customers
  const filteredCustomers = useMemo(() => {
    if (isLoading) return []
    if (error) return []

    let filtered = customers

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(customer => customer.status === statusFilter)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(searchQuery) ||
        (customer.tags && customer.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }

    // Sort by last visit (most recent first)
    return filtered.sort((a, b) => {
      const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0
      const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0
      return dateB - dateA
    })
  }, [customers, searchQuery, statusFilter, isLoading, error])

  // Stats calculation
  const stats = useMemo(() => {
    if (isLoading) return { total: 0, active: 0, vip: 0, totalSpent: 0 }
    
    const total = customers.length
    const active = customers.filter(c => c.status === 'active').length
    const vip = customers.filter(c => c.status === 'vip').length
    const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0)
    
    return { total, active, vip, totalSpent }
  }, [customers, isLoading])

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading customers...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error loading customers</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'vip':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
  }

    // Function to detect input type and set prefilled data
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
  }

  // Function to handle Enter key press for new customer creation
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()

      // Check if customer exists in filtered results
      const existingCustomer = filteredCustomers.find(customer =>
        customer.name.toLowerCase() === searchQuery.toLowerCase() ||
        customer.email?.toLowerCase() === searchQuery.toLowerCase() ||
        customer.phone === searchQuery
      )

      if (!existingCustomer) {
        const trimmedValue = searchQuery.trim()

        // Check if it's an email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
          setPrefilledData({ email: trimmedValue })
        }
        // Check if it's a phone number (contains mostly digits with some special characters)
        else if (/^[\d\s+\-()]+$/.test(trimmedValue) && trimmedValue.replace(/[\s+\-()]/g, '').length >= 7) {
          setPrefilledData({ phone: trimmedValue })
        }
        // Otherwise treat as name
        else {
          setPrefilledData({ name: trimmedValue })
        }

        setShowAddModal(true)
        setSearchQuery('')
      }
    }
  }

  // const handleViewCustomer = (customerId: string) => {
  //   navigate(`/customers/${customerId}`)
  // }

  // Mobile layout: full-width content with persistent bottom navigation
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Customers</h1>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-beveren-600 text-white px-4 py-2 rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2 text-sm"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-20 w-[98%] mx-auto px-2 py-4">
          <div className="mx-auto w-full">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <Users className="text-blue-500" size={24} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Customers</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <Star className="text-green-500" size={24} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Customers</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <Crown className="text-yellow-500" size={24} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">VIP Customers</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.vip}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="w-6 h-6 bg-beveren-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">AED</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(stats.totalSpent)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search customers... (Press Enter to add new customer)"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onKeyPress={handleSearchKeyPress}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-2">
                  <Filter className="text-gray-400" size={18} />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | Customer['status'])}
                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-beveren-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Orders & Spent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Visit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-medium text-sm">
                                {getInitials(customer.name)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {customer.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                ID: {customer.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-gray-900 dark:text-white">
                              <Mail size={14} className="mr-2 text-gray-400" />
                              {customer.email}
                            </div>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Phone size={14} className="mr-2 text-gray-400" />
                              {customer.phone}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {customer.totalOrders} orders
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCurrency(customer.totalSpent)}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                            {customer.status === 'vip' && <Crown size={12} className="mr-1" />}
                            {customer.status.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {customer.lastVisit ? formatDate(customer.lastVisit) : 'Never'}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/customers/${customer.id}`)
                              }}
                              className="text-beveren-600 hover:text-beveren-700 dark:text-beveren-400 dark:hover:text-beveren-300"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCustomer(customer)
                                setShowAddModal(true)
                              }}
                              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              <Edit size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No customers found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery || statusFilter !== "all"
                      ? "Try adjusting your search or filter criteria."
                      : "Get started by adding your first customer."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Customer Modal */}
        {showAddModal && (
          <>
            {console.log('Opening modal with prefilled data:', prefilledData)}
            <AddCustomerModal
              customer={selectedCustomer as unknown as ModalCustomer}
              onClose={() => {
                setShowAddModal(false)
                setSelectedCustomer(null)
                setPrefilledData({})
              }}
              onSave={(customer: Partial<ModalCustomer>) => {
                console.log('Saving customer:', customer)
                setShowAddModal(false)
                setSelectedCustomer(null)
                setPrefilledData({})
              }}
              prefilledData={prefilledData}
            />
          </>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <RetailSidebar/>
      
      {/* Fixed Header */}
      <div className="fixed top-0 left-20 right-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-beveren-600 text-white px-6 py-3 rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Add Customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8 mt-16 ml-20 max-w-none">

        <div className="mx-auto w-full">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <Users className="text-blue-500" size={24} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Customers</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <Star className="text-green-500" size={24} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Customers</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.active}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <Crown className="text-yellow-500" size={24} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">VIP Customers</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.vip}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-beveren-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AED</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(stats.totalSpent)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search customers... (Press Enter to add new customer)"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <Filter className="text-gray-400" size={18} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | Customer['status'])}
                  className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-beveren-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Orders & Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Visit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCustomers.map((customer) => (
                    <tr 
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-beveren-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-sm">
                              {getInitials(customer.name)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {customer.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {customer.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            <Mail size={14} className="mr-2 text-gray-400" />
                            {customer.email}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <Phone size={14} className="mr-2 text-gray-400" />
                            {customer.phone}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {customer.totalOrders} orders
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatCurrency(customer.totalSpent)}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                          {customer.status === 'vip' && <Crown size={12} className="mr-1" />}
                          {customer.status.toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {customer.lastVisit ? formatDate(customer.lastVisit) : 'Never'}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/customers/${customer.id}`)
                            }}
                            className="text-beveren-600 hover:text-beveren-700 dark:text-beveren-400 dark:hover:text-beveren-300"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCustomer(customer)
                              setShowAddModal(true)
                            }}
                            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No customers found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Get started by adding your first customer."
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {showAddModal && (
        <>
          {console.log('Opening modal with prefilled data:', prefilledData)}
        <AddCustomerModal
          customer={selectedCustomer as unknown as ModalCustomer}
          onClose={() => {
            setShowAddModal(false)
            setSelectedCustomer(null)
              setPrefilledData({}) // Clear prefilled data
          }}
          onSave={(customer: Partial<ModalCustomer>) => {
            console.log('Saving customer:', customer)
            setShowAddModal(false)
            setSelectedCustomer(null)
              setPrefilledData({}) // Clear prefilled data
          }}
            prefilledData={prefilledData}
        />
        </>
      )}
    </div>
  )
}
