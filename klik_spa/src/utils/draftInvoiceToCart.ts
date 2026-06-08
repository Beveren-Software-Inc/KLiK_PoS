import { getDraftInvoiceItems } from '../services/salesInvoice';
import { toast } from 'react-toastify';
import { extractErrorFromException } from './errorExtraction';
import { cacheDraftInvoiceItems } from './draftInvoiceCache';
import type { CartItem as RootCartItem } from '../../types';
import type { Customer } from '../types/customer';

export interface InvoiceItem {
  name?: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  price_list_rate?: number;
  discount_amount?: number;
  discount_percentage?: number;
  amount: number;
  uom?: string;
  description?: string;
}

export interface CartItem {
  id: string;
  item_code?: string;
  name: string;
  category: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  discount_percentage?: number;
  custom_rate?: number;
  image: string;
  quantity: number;
  uom?: string;
}

function transformCustomerInfo(customer: any, invoiceData: any): Customer {
  return {
    id: customer.name,
    type: customer.customer_type === 'Company' ? 'company' : (customer.is_walkin ? 'walk-in' : 'individual'),
    name: customer.customer_name || customer.name,
    customerName: customer.customer_name || customer.name,
    email: customer.contact_data?.email_id || customer.email_id || invoiceData.customer_email || '',
    phone: customer.contact_data?.mobile_no || customer.contact_data?.phone || customer.mobile_no || invoiceData.customer_mobile_no || '',
    address: {
      addressType: 'Billing',
      street: customer.address_data?.address_line1 || invoiceData.customer_address_line1 || '',
      buildingNumber: customer.address_data?.address_line2 || '',
      city: customer.address_data?.city || invoiceData.customer_city || '',
      state: customer.address_data?.state || invoiceData.customer_state || '',
      zipCode: customer.address_data?.pincode || invoiceData.customer_pincode || '',
      country: customer.address_data?.country || invoiceData.customer_country || invoiceData.customer_address_doc?.country || '',
    },
    companyName: customer.company_name || (customer.customer_type === 'Company' ? customer.customer_name : undefined),
    contactPerson: customer.contact_data
      ? `${customer.contact_data.first_name || ''} ${customer.contact_data.last_name || ''}`.trim() || customer.customer_name
      : customer.contact_person || customer.customer_name || '',
    taxId: customer.vat_number || customer.tax_id || '',
    isWalkin: customer.is_walkin || 0,
    industry: customer.industry || '',
    employeeCount: customer.employee_count || '',
    registrationScheme: customer.registration_scheme || '',
    registrationNumber: customer.registration_number || '',
    loyaltyPoints: customer.loyalty?.loyalty_points || customer.custom_loyalty_points || 0,
    totalSpent: customer.custom_total_spent || 0,
    totalOrders: customer.custom_total_orders || 0,
    preferredPaymentMethod: customer.payment_method || 'Cash',
    tags: customer.custom_tags?.split(',').filter(Boolean) || [],
    status: customer.custom_status || 'active',
    createdAt: customer.creation || new Date().toISOString(),
    lastVisit: customer.custom_last_visit || undefined,
    defaultCurrency: customer.currency || customer.price_list_currency || invoiceData.default_currency || undefined,
    companyCurrency: customer.price_list_currency || invoiceData.company_currency || undefined,
    customerGroup: customer.customer_group || 'All Customer Groups',
    territory: customer.territory || 'All Territories',
    emailId: customer.email_id || null,
    mobileNo: customer.mobile_no || null,
    customerType: customer.customer_type,
    customerPrimaryContact: customer.customer_primary_contact,
    customerPrimaryAddress: customer.customer_primary_address,
    contactData: customer.contact_data ? {
      firstName: customer.contact_data.first_name,
      lastName: customer.contact_data.last_name,
      emailId: customer.contact_data.email_id,
      phone: customer.contact_data.phone,
      mobileNo: customer.contact_data.mobile_no,
    } : null,
    addressData: customer.address_data ? {
      addressLine1: customer.address_data.address_line1,
      addressLine2: customer.address_data.address_line2,
      city: customer.address_data.city,
      state: customer.address_data.state,
      pincode: customer.address_data.pincode,
      country: customer.address_data.country,
    } : null,
    customerAddress: customer.customer_address,
    addressDisplay: customer.address_display || null,
    shippingAddressName: customer.shipping_address_name || null,
    shippingAddress: customer.shipping_address || null,
    taxCategory: customer.tax_category || null,
    contactPersonName: customer.contact_person || null,
    contactDisplay: customer.contact_display || null,
    contactEmail: customer.contact_email || null,
    contactMobile: customer.contact_mobile || null,
    contactPhone: customer.contact_phone || null,
    contactDesignation: customer.contact_designation || null,
    contactDepartment: customer.contact_department || null,
    taxWithholdingCategory: customer.tax_withholding_category || null,
    taxWithholdingGroup: customer.tax_withholding_group || null,
    language: customer.language || 'en',
    priceListCurrency: customer.price_list_currency,
    sellingPriceList: customer.selling_price_list,
    paymentTermsTemplate: customer.payment_terms_template || null,
    currencyCode: customer.currency || null,
    salesTeam: customer.sales_team || [],
    vatNumber: customer.vat_number || '',
    paymentMethod: customer.payment_method || 'Cash',
    loyalty: customer.loyalty || undefined,
    loyaltyProgram: customer.loyalty?.loyalty_program || null,
    loyaltyTier: customer.loyalty?.loyalty_program_tier || customer.loyalty?.customer_loyalty_program_tier || null,
    redeemableValue: customer.loyalty?.redeemable_value || 0,
  };
}

function transformInvoiceCustomer(invoiceData: any): Customer | null {
  if (!invoiceData.customer) {
    return null;
  }

  return {
    id: invoiceData.customer,
    name: invoiceData.customer_name || invoiceData.customer,
    customerName: invoiceData.customer_name || invoiceData.customer,
    email: invoiceData.customer_email || '',
    emailId: invoiceData.customer_email || '',
    phone: invoiceData.customer_mobile_no || '',
    mobileNo: invoiceData.customer_mobile_no || '',
    isWalkin: invoiceData.customer_is_walkin || 0,
    territory: '',
    customerGroup: '',
    customerType: 'Individual',
    type: 'individual',
    address: {
      addressType: 'Billing',
      street: invoiceData.customer_address_line1 || '',
      city: invoiceData.customer_city || '',
      state: invoiceData.customer_state || '',
      zipCode: invoiceData.customer_pincode || '',
      country: invoiceData.customer_country || invoiceData.customer_address_doc?.country || '',
    },
    status: 'active',
    preferredPaymentMethod: 'Cash',
    loyaltyPoints: invoiceData.loyalty?.current_balance?.loyalty_points || 0,
    loyalty: invoiceData.loyalty?.current_balance || undefined,
    loyaltyProgram: invoiceData.loyalty?.current_balance?.loyalty_program || null,
    loyaltyTier: invoiceData.loyalty?.current_balance?.loyalty_program_tier
      || invoiceData.loyalty?.current_balance?.customer_loyalty_program_tier
      || null,
    redeemableValue: invoiceData.loyalty?.current_balance?.redeemable_value || 0,
    totalSpent: 0,
    totalOrders: 0,
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

async function getDraftCustomer(invoiceData: any): Promise<Customer | null> {
  if (!invoiceData.customer) {
    return null;
  }

  try {
    const response = await fetch(
      `/api/method/klik_pos.api.customer.get_customer_info?customer_name=${encodeURIComponent(invoiceData.customer)}`
    );
    const resData = await response.json();

    if (!resData.message || resData.message.success === false) {
      throw new Error(resData.message?.error || 'Failed to fetch customer info');
    }

    return transformCustomerInfo(resData.message, invoiceData);
  } catch (error) {
    console.error('Error fetching draft customer loyalty info:', error);
    return transformInvoiceCustomer(invoiceData);
  }
}

export async function addDraftInvoiceToCart(invoiceId: string): Promise<boolean> {
  try {
    // Fetch draft invoice items
    const invoiceData = await getDraftInvoiceItems(invoiceId);

    if (!invoiceData || !invoiceData.items || !Array.isArray(invoiceData.items)) {
      throw new Error('No items found in draft invoice');
    }

    // Convert invoice items to cart items
    const cartItems: CartItem[] = [];
    for (const [index, item] of invoiceData.items.entries()) {
      const discountAmount = Number(item.discount_amount) || 0;
      const discountPercentage = Number(item.discount_percentage) || 0;
      const priceListRate = Number(item.price_list_rate) || 0;
      const originalRate = priceListRate > 0 ? priceListRate : Number(item.rate || 0) + discountAmount;
      const cartItem: CartItem = {
        // Keep each draft line unique so duplicate item codes don't collapse into one cart row.
        id: item.name || `${item.item_code}-${index}`,
        item_code: item.item_code,
        name: item.item_name,
        category: 'General',
        price: originalRate,
        original_price: originalRate,
        discount_amount: discountAmount,
        discount_percentage: discountPercentage,
        image: '',
        quantity: item.qty,
        uom: item.uom,
      };
      cartItems.push(cartItem);
    }

    const customer = await getDraftCustomer(invoiceData);

    // Cache the items and customer instead of adding directly to cart
    cacheDraftInvoiceItems(invoiceId, cartItems as RootCartItem[], customer);

    return true;

  } catch (error: unknown) {
    console.error('Error caching draft invoice items:', error);
    const errorMessage = extractErrorFromException(error, 'Failed to cache draft invoice items');
    toast.error(errorMessage);
    return false;
  }
}
