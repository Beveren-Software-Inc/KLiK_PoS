export interface Customer {
  id: string
  type: 'individual' | 'company' | 'walk-in'
  name: string
  customerName?: string
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
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other'
  companyName?: string
  contactPerson?: string
  taxId?: string
  isWalkin?: number
  industry?: string
  employeeCount?: string
  registrationScheme?: string
  registrationNumber?: string
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
  defaultCurrency?: string
  companyCurrency?: string
  customerGroup?: string
  territory?: string
  emailId?: string | null
  mobileNo?: string | null
  customerType?: string
  customerPrimaryContact?: any
  customerPrimaryAddress?: any
  contactData?: {
    firstName?: string
    lastName?: string
    emailId?: string
    phone?: string
    mobileNo?: string
  } | null
  addressData?: {
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    pincode?: string
    country?: string
  } | null
  customerAddress?: any
  addressDisplay?: string | null
  shippingAddressName?: string | null
  shippingAddress?: string | null
  taxCategory?: string | null
  contactPersonName?: string | null
  contactDisplay?: string | null
  contactEmail?: string | null
  contactMobile?: string | null
  contactPhone?: string | null
  contactDesignation?: string | null
  contactDepartment?: string | null
  taxWithholdingCategory?: string | null
  taxWithholdingGroup?: string | null
  language?: string
  priceListCurrency?: string
  sellingPriceList?: string
  paymentTermsTemplate?: string | null
  currencyCode?: string | null
  salesTeam?: any[]
  vatNumber?: string
  paymentMethod?: string
  loyalty?: LoyaltySummary
  loyaltyProgram?: string | null
  loyaltyTier?: string | null
  redeemableValue?: number
}

export interface LoyaltySummary {
  enabled: boolean
  loyalty_program: string | null
  loyalty_program_name?: string | null
  loyalty_program_type?: string | null
  loyalty_program_tier?: string | null
  customer_loyalty_program_tier?: string | null
  loyalty_points: number
  available_points?: number
  conversion_factor?: number
  redeemable_value: number
  total_spent?: number
  collection_factor?: number
  expense_account?: string | null
  cost_center?: string | null
  company?: string | null
}
