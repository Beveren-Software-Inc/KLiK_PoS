import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Crown, 
  Star, 
  CreditCard, 
  ShoppingBag,
  Edit,
  MoreVertical,
  User,
  Gift,
  Clock,
  Tag,
  Activity,
  Building,
  Users as UsersIcon,
  Hash,
  Briefcase
} from "lucide-react"
import { getCustomerById, type Customer } from "../data/mockCustomers"
import AddCustomerModal from "./AddCustomerModal"

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const customer = id ? getCustomerById(id) : null
  const [showEditModal, setShowEditModal] = useState(false)

  const handleSaveCustomer = (updatedCustomer: Partial<Customer>) => {
    // In a real app, this would update the customer in the backend
    console.log('Saving customer:', updatedCustomer)
    setShowEditModal(false)
    // For now, we'll just close the modal since we're using mock data
    // In a real implementation, you'd update the customer and refresh the data
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Customer Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The customer you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/customers')}
            className="bg-beveren-600 text-white px-6 py-3 rounded-lg hover:bg-beveren-700 transition-colors"
          >
            Back to Customers
          </button>
        </div>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2)
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
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const getCustomerTypeInfo = (customer: Customer) => {
    switch (customer.type) {
      case 'individual':
        return {
          icon: <User size={16} />,
          label: 'Individual',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
        }
      case 'company':
        return {
          icon: <Building size={16} />,
          label: 'Company',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
        }
      case 'walk-in':
        return {
          icon: <UsersIcon size={16} />,
          label: 'Walk-In',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        }
      default:
        return {
          icon: <User size={16} />,
          label: 'Individual',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
        }
    }
  }

  const customerTypeInfo = getCustomerTypeInfo(customer)

  const getPaymentMethodIcon = (method: Customer['preferredPaymentMethod']) => {
    switch (method) {
      case 'card':
        return <CreditCard size={16} />
      case 'cash':
        return <span className="text-xs font-bold">CASH</span>
      case 'mobile':
        return <Phone size={16} />
      case 'loyalty':
        return <Gift size={16} />
      default:
        return <CreditCard size={16} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => navigate('/customers')}
              className="flex items-center space-x-2 text-gray-600 hover:text-beveren-600 dark:text-gray-300 dark:hover:text-beveren-400 transition-colors group"
              type="button"
            >
              <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-beveren-50 dark:bg-gray-800 dark:group-hover:bg-beveren-900 transition-colors">
                <ArrowLeft size={20} />
              </div>
              <span className="font-medium">Back to Customers</span>
            </button>
          </div>

          {/* Customer Header Card */}
          <div className="bg-gradient-to-r from-beveren-600 to-beveren-700 rounded-xl p-6 text-white mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold">{getInitials(customer.name)}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{customer.name}</h1>
                  <p className="text-beveren-100 text-lg">Customer ID: {customer.id}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${customerTypeInfo.color}`}>
                      {customerTypeInfo.icon}
                      <span className="ml-1">{customerTypeInfo.label}</span>
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20`}>
                      {customer.status === 'vip' && <Crown size={14} className="mr-1" />}
                      {customer.status.toUpperCase()}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Star size={16} className="text-yellow-300" />
                      <span className="font-medium">{customer.loyaltyPoints} points</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 md:mt-0">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Edit size={16} />
                  <span>Edit Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                {customer.type === 'company' ? (
                  <Building size={20} className="mr-2" />
                ) : (
                  <User size={20} className="mr-2" />
                )}
                {customer.type === 'company' ? 'Company Information' : 'Contact Information'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {customer.type === 'company' && customer.companyName && (
                    <div className="flex items-center space-x-3">
                      <Building size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Name</p>
                        <p className="text-gray-900 dark:text-white">{customer.companyName}</p>
                      </div>
                    </div>
                  )}
                  {customer.type === 'company' && customer.contactPerson && (
                    <div className="flex items-center space-x-3">
                      <User size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Person</p>
                        <p className="text-gray-900 dark:text-white">{customer.contactPerson}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center space-x-3">
                    <Mail size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-gray-900 dark:text-white">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone size={18} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</p>
                      <p className="text-gray-900 dark:text-white">{customer.phone}</p>
                    </div>
                  </div>
                  {customer.type === 'individual' && customer.dateOfBirth && (
                    <div className="flex items-center space-x-3">
                      <Calendar size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</p>
                        <p className="text-gray-900 dark:text-white">{formatDate(customer.dateOfBirth)}</p>
                      </div>
                    </div>
                  )}
                  {customer.type === 'company' && customer.taxId && (
                    <div className="flex items-center space-x-3">
                      <Hash size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tax ID</p>
                        <p className="text-gray-900 dark:text-white">{customer.taxId}</p>
                      </div>
                    </div>
                  )}
                  {customer.type === 'company' && customer.industry && (
                    <div className="flex items-center space-x-3">
                      <Briefcase size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Industry</p>
                        <p className="text-gray-900 dark:text-white">{customer.industry}</p>
                      </div>
                    </div>
                  )}
                  {customer.type === 'company' && customer.employeeCount && (
                    <div className="flex items-center space-x-3">
                      <UsersIcon size={18} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee Count</p>
                        <p className="text-gray-900 dark:text-white">{customer.employeeCount}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-start space-x-3">
                    <MapPin size={18} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</p>
                      <div className="text-gray-900 dark:text-white">
                        <p>{customer.address.street}</p>
                        <p>{customer.address.city}, {customer.address.state}</p>
                        <p>{customer.address.zipCode}</p>
                        <p>{customer.address.country}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase History */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <ShoppingBag size={20} className="mr-2" />
                Purchase History
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-beveren-600 dark:text-beveren-400">{customer.totalOrders}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(customer.totalSpent)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{customer.loyaltyPoints}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loyalty Points</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {customer.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notes</h2>
                <p className="text-gray-700 dark:text-gray-300">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Activity size={18} className="mr-2" />
                Quick Stats
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                    {customer.status === 'vip' && <Crown size={12} className="mr-1 inline" />}
                    {customer.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Payment Method</span>
                  <div className="flex items-center space-x-1">
                    {getPaymentMethodIcon(customer.preferredPaymentMethod)}
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {customer.preferredPaymentMethod}
                    </span>
                  </div>
                </div>
                {customer.gender && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Gender</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {customer.gender}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Member Since</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(customer.createdAt)}
                  </span>
                </div>
                {customer.lastVisit && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Last Visit</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDateTime(customer.lastVisit)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Tags */}
            {customer.tags && customer.tags.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Tag size={18} className="mr-2" />
                  Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {customer.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-beveren-100 text-beveren-700 dark:bg-beveren-900 dark:text-beveren-300 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Clock size={18} className="mr-2" />
                Recent Activity
              </h2>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">Last order placed</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {customer.lastVisit ? formatDateTime(customer.lastVisit) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">Account created</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatDateTime(customer.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && (
        <AddCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveCustomer}
        />
      )}
    </div>
  )
}
