// types/index.ts

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
  original_price?: number
  discount_amount?: number
  discount_percentage?: number
  custom_rate?: number
  image: string
  quantity: number
  available?: number
  uom?: string
  item_code?: string
  base_uom?: string
  conversion_factor?: number
  bundle_entries?: BundleEntry[]
  has_serial_no?: boolean
  has_batch_no?: boolean
  valuation_rate?: number
  item_tax_template?: string
  item_tax_rate?: Record<string, number>
  total_tax_rate?: number
  tax_templates?: TaxTemplate[]
}

export interface TaxTemplate {
  account: string
  rate: number
  is_inclusive: boolean
}

export interface BundleEntry {
  serial_no?: string
  batch_no?: string
  qty?: number
  warehouse?: string
  selected?: boolean
}

export interface PriceListRate {
  price_list: string
  rate: number
}

export interface ItemTaxInfo {
  has_vat: boolean
  is_inclusive: boolean
  total_tax_rate: number
  exclusive_tax_rate?: number
  inclusive_tax_rate?: number
  item_tax_template?: string
  source?: string
  tax_templates?: Array<{
    account: string
    rate: number
    is_inclusive: boolean
  }>
}

export interface BundleComponent {
  item_code: string
  item_name: string
  qty: number
  uom?: string
  description?: string
  is_stock_item?: boolean
  has_batch_no?: boolean
  has_serial_no?: boolean
  available?: number
  available_bundle_qty?: number
}

export interface VariantOptionValue {
  value: string
  variant_count: number
}

export interface VariantAttributeOption {
  attribute: string
  values: VariantOptionValue[]
}

export interface MenuItem {
  id: string
  item_code?: string
  name: string
  category: string
  price: number
  price_with_vat?: number
  originalPrice?: number
  image: string
  available: number
  is_stock_item?: boolean
  sold: number
  discount?: number
  description?: string
  uom?: string
  currency_symbol?: string
  tax_info?: ItemTaxInfo
  barcode?: string
  cost_price?: number
  price_lists?: PriceListRate[]
  item_group?: string // Item group reference
  is_product_bundle?: boolean
  bundle_items?: BundleComponent[]
  is_variant_template?: boolean
  has_variants?: boolean
  variant_of?: string
  variant_based_on?: string
  variant_count?: number
  variant_attributes?: Record<string, string>
}

export interface Category {
  id: string
  name: string
  icon: string
  count: number
}

// ============ Item Group Types ============
export interface ItemGroup {
  id: string
  name: string
  name_en?: string
  name_ar?: string
  parent_group?: string
  is_group?: boolean
  image?: string
  description?: string
  count?: number // Number of items in this group
  item_count?: number
  route?: string
  lft?: number
  rgt?: number
  old_parent?: string
  show_in_website?: boolean
  show_in_pos?: boolean
  weightage?: number
  custom_icon?: string
  custom_color?: string
  custom_order?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
  total_count?: number
}

export interface ItemGroupWithChildren extends ItemGroup {
  children?: ItemGroupWithChildren[]
  items?: MenuItem[]
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
  customer_mobile_no?: string
  customer_email_id?: string
  company_name: string
  company_tax_no: string
  company_address: string
  company_phone: string
  company_email: string
  company_website: string
  notes?: string
  currency_symbol?: string
  cashier_name: string
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
  rate: number
  amount: number
  description?: string
  returned_qty?: number
  available_qty?: number
}

export interface SalesInvoice {
  id: string
  date: string
  name: string
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
  payment_methods?: Array<{
    mode_of_payment: string
    amount: number
  }>
  amountPaid: number
  changeGiven: number
  status: "Draft" | "Completed" | "Pending" | "Cancelled" | "Refunded" | "Paid" | "Unpaid" | "Overdue" | "Return"
  custom_zatca_submit_status?: string
  custom_is_printed?: boolean | number
  refundAmount: number
  notes: string
  currency: string
  customer_address_doc?: AddressDoc
  company_address_doc?: AddressDoc
  company: string
  posting_date: string
  posting_time: string
  posProfile?: string
  custom_pos_opening_entry?: string
  invoice: []
  cashier_name: string
  customer_email: string
  customer_mobile_no: string
  outstanding_amount: number
  paid_amount: number
  grand_total: number
  rounding_adjustment: number
  total_taxes_and_charges: number
  total_discount_amount: number
  total: number
  taxes: []
  owner: string
  sales_team: Array<{
    sales_person: string
    contact_no?: string
    allocated_amount?: number
    allocated_percentage?: number
  }>
  tax_id: string
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
  email_id: string
  customer_name: string
  mobile_no: string
  territory: string
  customer_group: string
  customer_type: string
  phone: string
  is_walkin: number
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
    addressType?: 'Billing' | 'Shipping' | 'Other'
    streetName?: string
  }
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other'
  loyaltyPoints: number
  type: 'individual' | 'company'
  totalSpent: number
  totalOrders: number
  preferredPaymentMethod: 'Cash' | 'Card' | 'Mobile' | 'Loyalty'
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
  mode_of_payment: string
  default?: 0 | 1
  name?: string
}

export interface POSProfile {
  name: string
  company: string
  warehouse: string
  currency: string
  default_sales_type?: 'Cash' | 'Credit' | string
  allow_zero_rate_sales?: boolean | number
  write_off_account?: string
  write_off_cost_center?: string
  payment_methods?: PaymentMode[]
  custom_use_scanner_fully?: boolean
  hide_unavailable_items?: boolean
  custom_default_view?: 'Grid View' | 'List View'
  custom_scale_barcodes_start_with?: string
  custom_prevent_invoice_reprinting?: boolean | number
  // Add other fields as needed
}

export type AddressDoc = {
  name: string
  address_line1: string
  address_line2?: string
  city?: string
  state?: string
  country?: string
  phone?: string
  email_id?: string
  display?: string
  county: string
  street_name: string
  // ... add more as needed
}

// ============ API Response Types ============

export interface InitializePOSResponse {
  items: MenuItem[]
  item_groups: ItemGroup[]
  pos_details: POSProfile
  total_count: number
  has_more: boolean
}

export interface GetItemsResponse {
  items: MenuItem[]
  total_count: number
  has_more: boolean
}

export interface SearchItemsResponse {
  items: MenuItem[]
  total_count: number
  has_more: boolean
  search_query: string
}

export interface GetItemGroupsResponse {
  item_groups: ItemGroup[]
  total_count: number
}

export interface GetItemGroupDetailResponse {
  item_group: ItemGroup
  items?: MenuItem[]
  children?: ItemGroup[]
}

export interface GetItemsByGroupResponse {
  group: ItemGroup
  items: MenuItem[]
  total_count: number
  has_more: boolean
}

export interface StockBatchResponse {
  [itemCode: string]: number
}

export interface CustomerSearchResponse {
  customers: Customer[]
  total_count: number
}

// ============ Store State Types ============

export interface ProductStoreState {
  // Data
  products: MenuItem[]
  posDetails: POSProfile | null
  itemGroups: ItemGroup[]
  customers: Customer[]
  selectedCustomer: Customer | null
  
  // UI State
  searchQuery: string
  selectedCategory: string
  selectedItemGroupId: string | null
  
  // Pagination
  totalCount: number
  hasMore: boolean
  currentOffset: number
  
  // Loading States
  isLoading: boolean
  isLoadingMore: boolean
  isSearching: boolean
  isLoadingCustomers: boolean
  isRefreshingStock: boolean
  isLoadingItemGroups: boolean
  error: string | null
  
  // Cache
  lastFullRefresh: number | null
  lastUpdated: Date | null
  itemGroupsLastFetched: number | null
}

// ============ Component Props Types ============

export interface CategoryTabsProps {
  showItemCount?: boolean
  showIcons?: boolean
  onGroupSelect?: (group: ItemGroup) => void
}

export interface ProductCardProps {
  item: MenuItem
  onAddToCart?: (item: MenuItem) => void
  showStock?: boolean
  showPrice?: boolean
  compact?: boolean
}

export interface ProductGridProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
  viewMode?: 'grid' | 'list'
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  totalCount?: number
}

export interface SearchBarProps {
  placeholder?: string
  autoFocus?: boolean
  showBarcodeButton?: boolean
  onBarcodeClick?: () => void
}
