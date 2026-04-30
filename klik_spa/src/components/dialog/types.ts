import type { CartItem, GiftCoupon } from "../../../types";
import type { Customer } from "../../types/customer";

export interface PaymentDialogProps {
  isOpen: boolean;
  onClose: (paymentCompleted?: boolean) => void;
  cartItems: CartItem[];
  appliedCoupons: GiftCoupon[];
  selectedCustomer: Customer | null;
  onCompletePayment: (paymentData: any) => void;
  onHoldOrder: (orderData: any) => void;
  isMobile?: boolean;
  isFullPage?: boolean;
  initialSharingMode?: string | null;
  externalInvoiceData?: any;
  itemDiscounts?: any;
  totalItemDiscount?: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  amount: number;
}

export interface PaymentAmount {
  [key: string]: number;
}

export interface Calculations {
  subtotal: number;
  couponDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
  selectedTax: any;
  isInclusive: boolean;
}

export interface BackendTaxBreakdownLine {
  description?: string;
  account_head?: string;
  charge_type?: string;
  rate?: number;
  tax_amount?: number;
  total?: number;
  included_in_print_rate?: number;
}

export interface BackendTaxPreview {
  tax_breakdown: BackendTaxBreakdownLine[];
  net_total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  rounded_total: number;
  disable_rounded_total: number;
}