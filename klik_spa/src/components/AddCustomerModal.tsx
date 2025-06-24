import React, { useState, useEffect } from "react"
import { X, User, Mail, Phone, MapPin, Calendar, CreditCard, Tag, Save, Building, Users } from "lucide-react"
import { type Customer } from "../data/mockCustomers"

interface AddCustomerModalProps {
  customer?: Customer | null
  onClose: () => void
  onSave: (customer: Partial<Customer>) => void
  isFullPage?: boolean
}

export default function AddCustomerModal({ customer, onClose, onSave, isFullPage = false }: AddCustomerModalProps) {
  const isEditing = !!customer
  
  const [formData, setFormData] = useState({
    type: "individual" as Customer['type'],
    name: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "UAE"
    },
    // Individual fields
    dateOfBirth: "",
    gender: "" as "male" | "female" | "other" | "",
    // Company fields
    companyName: "",
    contactPerson: "",
    taxId: "",
    industry: "",
    employeeCount: "",
    // Common fields
    preferredPaymentMethod: "card" as Customer['preferredPaymentMethod'],
    notes: "",
    tags: [] as string[],
    status: "active" as Customer['status']
  })

  const [tagInput, setTagInput] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (customer) {
      setFormData({
        type: customer.type,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        // Individual fields
        dateOfBirth: customer.dateOfBirth || "",
        gender: customer.gender || "",
        // Company fields
        companyName: customer.companyName || "",
        contactPerson: customer.contactPerson || "",
        taxId: customer.taxId || "",
        industry: customer.industry || "",
        employeeCount: customer.employeeCount || "",
        // Common fields
        preferredPaymentMethod: customer.preferredPaymentMethod,
        notes: customer.notes || "",
        tags: customer.tags || [],
        status: customer.status
      })
    }
  }, [customer])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required"
    }

    if (!formData.address.street.trim()) {
      newErrors.street = "Street address is required"
    }

    if (!formData.address.city.trim()) {
      newErrors.city = "City is required"
    }

    // Company-specific validation
    if (formData.type === 'company') {
      if (!formData.companyName.trim()) {
        newErrors.companyName = "Company name is required"
      }
      if (!formData.contactPerson.trim()) {
        newErrors.contactPerson = "Contact person is required"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const customerData: Partial<Customer> = {
      ...formData,
      // Clean up conditional fields
      dateOfBirth: formData.dateOfBirth || undefined,
      gender: formData.gender || undefined,
      companyName: formData.type === 'company' ? formData.companyName : undefined,
      contactPerson: formData.type === 'company' ? formData.contactPerson : undefined,
      taxId: formData.type === 'company' ? formData.taxId || undefined : undefined,
      industry: formData.type === 'company' ? formData.industry || undefined : undefined,
      employeeCount: formData.type === 'company' ? formData.employeeCount || undefined : undefined,
      // Preserve existing data for edits
      id: customer?.id || `CUST${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      loyaltyPoints: customer?.loyaltyPoints || 0,
      totalSpent: customer?.totalSpent || 0,
      totalOrders: customer?.totalOrders || 0,
      createdAt: customer?.createdAt || new Date().toISOString(),
      lastVisit: customer?.lastVisit
    }

    onSave(customerData)
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className={isFullPage ? "h-full" : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"}>
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-800 flex flex-col" : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"}>
        {/* Header */}
        {!isFullPage && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={isFullPage ? "flex-1 p-6 space-y-6 overflow-y-auto" : "p-6 space-y-6"}>
          {/* Customer Type Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Tag size={20} className="mr-2" />
              Customer Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { value: 'individual', label: 'Individual', icon: User, desc: 'Personal customer' },
                { value: 'company', label: 'Company', icon: Building, desc: 'Business customer' },
                { value: 'walk-in', label: 'Walk-In', icon: Users, desc: 'Temporary customer' }
              ].map((type) => {
                const IconComponent = type.icon
                return (
                  <label
                    key={type.value}
                    className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      formData.type === type.value
                        ? 'border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="customerType"
                      value={type.value}
                      checked={formData.type === type.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Customer['type'] }))}
                      className="sr-only"
                    />
                    <IconComponent size={24} className={`mb-2 ${
                      formData.type === type.value ? 'text-beveren-600' : 'text-gray-400'
                    }`} />
                    <span className={`font-medium text-sm ${
                      formData.type === type.value ? 'text-beveren-900 dark:text-beveren-100' : 'text-gray-900 dark:text-white'
                    }`}>
                      {type.label}
                    </span>
                    <span className={`text-xs text-center mt-1 ${
                      formData.type === type.value ? 'text-beveren-700 dark:text-beveren-300' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {type.desc}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <User size={20} className="mr-2" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name field - conditional label */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {formData.type === 'company' ? 'Company Name *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={formData.type === 'company' ? 'Enter company name' : "Enter customer's full name"}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Contact Person for Company */}
              {formData.type === 'company' && (
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.contactPerson ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter contact person name"
                  />
                  {errors.contactPerson && <p className="text-red-500 text-xs mt-1">{errors.contactPerson}</p>}
                </div>
              )}

              {/* Gender for Individual */}
              {formData.type === 'individual' && (
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {/* Date of Birth for Individual */}
              {formData.type === 'individual' && (
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {/* Tax ID for Company */}
              {formData.type === 'company' && (
                <div>
                  <label htmlFor="taxId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter tax identification number"
                  />
                </div>
              )}

              {/* Industry for Company */}
              {formData.type === 'company' && (
                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Technology, Healthcare, Retail"
                  />
                </div>
              )}

              {/* Employee Count for Company */}
              {formData.type === 'company' && (
                <div>
                  <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Employee Count
                  </label>
                  <select
                    id="employeeCount"
                    value={formData.employeeCount}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeCount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select range</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Customer['status'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Mail size={20} className="mr-2" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="customer@email.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+971-50-123-4567"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <MapPin size={20} className="mr-2" />
              Address
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  id="street"
                  value={formData.address.street}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, street: e.target.value }
                  }))}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.street ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="123 Sheikh Zayed Road"
                />
                {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={formData.address.city}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, city: e.target.value }
                    }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Dubai"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State/Emirate
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={formData.address.state}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, state: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Dubai"
                  />
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    value={formData.address.zipCode}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, zipCode: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                    placeholder="12345"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  value={formData.address.country}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, country: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  placeholder="UAE"
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <CreditCard size={20} className="mr-2" />
              Preferences
            </h3>
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Payment Method
              </label>
              <select
                id="paymentMethod"
                value={formData.preferredPaymentMethod}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  preferredPaymentMethod: e.target.value as Customer['preferredPaymentMethod']
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="card">Credit/Debit Card</option>
                <option value="cash">Cash</option>
                <option value="mobile">Mobile Payment</option>
                <option value="loyalty">Loyalty Points</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Tag size={20} className="mr-2" />
              Tags
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Add a tag and press Enter"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-beveren-100 text-beveren-700 dark:bg-beveren-900 dark:text-beveren-300 rounded-full text-sm font-medium flex items-center space-x-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-beveren-500 hover:text-beveren-700 dark:text-beveren-400 dark:hover:text-beveren-200"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
              placeholder="Add any additional notes about this customer..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2"
            >
              <Save size={18} />
              <span>{isEditing ? 'Update Customer' : 'Save Customer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
