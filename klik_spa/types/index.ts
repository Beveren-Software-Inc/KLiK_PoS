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
  description?: string
  uom?: string
  currency_symbol?: string
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
  item: Array<{
    itemCode: string
    nameEn: string
    nameAr: string
    qty: number
    unitPrice: number
    lineTotal: number
    rate: number
    amount: number
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
  item_code?: string
  item_name?: string
  qty?: number
  rate?: number
  amount?: number
  description?: string
  returned_qty?: number
  available_qty?: number
}

export interface SalesInvoice {
  id: string;
  date: string;
  name: string;
  time: string;
  cashier: string;
  cashierId: string;
  customer: string;
  customerId: string | null;
  items: SalesInvoiceItem[];
  subtotal: number;
  giftCardDiscount: number;
  giftCardCode: string | null;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: "Cash" | "Debit Card";
  amountPaid: number;
  changeGiven: number;
  status: "Completed" | "Pending" | "Cancelled" | "Refunded" | "Paid" | "Unpaid" | "Overdue";
  refundAmount: number;
  notes: string;
  currency: string;
  customer_address_doc?: AddressDoc;
  company_address_doc?: AddressDoc;
  company: string;
  posting_date: string;
  posting_time: string;
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
  email_id:string
  customer_name:string
  mobile_no: string
  territory: string
  customer_group:string
  customer_type:string
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
  defaultCurrency?: string
  companyCurrency?: string
}

export interface PaymentMode {
  mode_of_payment: string;
  default?: 0 | 1;
}

export interface POSProfile {
  name: string;
  company: string;
  warehouse: string;
  currency: string;
  write_off_account?: string;
  write_off_cost_center?: string;
  payment_methods?: PaymentMode[];
  // Add other fields as needed
}

export type AddressDoc = {
  name: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email_id?: string;
  display?: string;
  county:string;
  // ... add more as needed
};
