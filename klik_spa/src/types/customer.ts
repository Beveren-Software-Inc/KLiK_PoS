export interface Customer {
  id: string
  type: 'individual' | 'company' | 'walk-in'
  name: string
  email: string
  phone: string
  address: {
    addressType?: string
    street: string
    buildingNumber?: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  // Individual customer fields
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other'
  // Company customer fields
  companyName?: string
  contactPerson?: string
  taxId?: string
  industry?: string
  employeeCount?: string
  // Common fields
  loyaltyPoints: number
  totalSpent: number
  totalOrders: number
  preferredPaymentMethod: 'Cash' | 'Bank Card' | 'Bank Payment' | 'Credit'
  notes?: string
  tags: string[]
  status: 'active' | 'inactive' | 'vip'
  createdAt: string
  lastVisit?: string
  avatar?: string
  // Additional fields for ERPNext integration
  defaultCurrency?: string
  companyCurrency?: string
}
