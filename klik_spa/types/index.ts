export interface Product {
  itemCode: string
  nameEn: string
  nameAr: string
  imageURL: string
  price: number
  inStock: boolean
  category: string
}

export interface CartItem {
  id: string
  name: string
  category: string
  price: number
  image: string
  quantity: number
}

export interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  originalPrice?: number
  image: string
  available: number
  sold: number
  discount?: number
  description?:string
}

export interface Category {
  id: string
  name: string
  icon: string
  count: number
}

export interface GiftCoupon {
  code: string
  value: number
  description: string
}

export interface Invoice {
  invoiceId: string
  dateTime: string
  items: Array<{
    itemCode: string
    nameEn: string
    nameAr: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  vat: number
  total: number
  qrCodeURL: string
}

export interface SalesInvoiceItem {
  id: string
  name: string
  category: string
  quantity: number
  unitPrice: number
  total: number
  discount: number
}

export interface SalesInvoice {
  id: string
  date: string
  time: string
  cashier: string
  cashierId: string
  customer: string
  customerId: string | null
  items: SalesInvoiceItem[]
  subtotal: number
  giftCardDiscount: number
  giftCardCode: string | null
  taxAmount: number
  totalAmount: number
  paymentMethod: "Cash" | "Debit Card"
  amountPaid: number
  changeGiven: number
  status: "Completed" | "Pending" | "Cancelled" | "Refunded"
  refundAmount: number
  notes: string
}

export interface DashboardStats {
  todaySales: {
    totalRevenue: number
    totalTransactions: number
    averageOrderValue: number
    totalItems: number
  }
  weekSales: {
    totalRevenue: number
    totalTransactions: number
    averageOrderValue: number
    totalItems: number
  }
  monthSales: {
    totalRevenue: number
    totalTransactions: number
    averageOrderValue: number
    totalItems: number
  }
  paymentMethods: {
    cash: { amount: number; percentage: number; transactions: number }
    debitCard: { amount: number; percentage: number; transactions: number }
  }
  giftCardUsage: {
    totalRedeemed: number
    totalTransactions: number
    averageDiscount: number
  }
  topProducts: Array<{
    id: string
    name: string
    category: string
    sales: number
    revenue: number
  }>
  salesByHour: Array<{ hour: string; sales: number }>
  salesByDay: Array<{ day: string; sales: number }>
  salesByCashier: Array<{ name: string; sales: number; transactions: number; id: string }>
  recentTransactions: SalesInvoice[]
}

export interface SalesReport {
  id: string
  type: "daily" | "weekly" | "monthly"
  date: string
  totalSales: number
  totalTransactions: number
  cashSales: number
  cardSales: number
  giftCardDiscount: number
  refunds: number
  cancellations: number
  topSellingItems: string[]
  cashierPerformance: Array<{ cashier: string; sales: number; transactions: number }>
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other'
  loyaltyPoints: number
  totalSpent: number
  totalOrders: number
  preferredPaymentMethod: 'cash' | 'card' | 'mobile' | 'loyalty'
  notes?: string
  tags: string[]
  status: 'active' | 'inactive' | 'vip'
  createdAt: string
  lastVisit?: string
  avatar?: string
}
