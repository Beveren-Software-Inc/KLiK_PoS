

import { useEffect, useState } from "react";
import type { Customer } from "../types/customer";

interface ERPCustomer {
  name: string;
  customer_name?: string;
  customer_type?: string;
  customer_group?: string;
  territory?: string;
  default_currency?: string;
  company_currency?: string;
  custom_total_orders?: number;
  custom_total_spent?: number;
  custom_last_visit?: string;
  contact?: {
    first_name?: string;
    last_name?: string;
    email_id?: string;
    phone?: string;
    mobile_no?:string;
  };
  address?: {
    address_line1?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
}

export function useCustomers(searchQuery?: string) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [start, setStart] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchCustomers = async (search?: string, append = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      // Default page size 100
      params.set('limit', '100');
      params.set('start', String(append ? start : 0));
      const searchParam = `?${params.toString()}`;
      const response = await fetch(`/api/method/klik_pos.api.customer.get_customers${searchParam}`);
      const resData = await response.json();

      if (!resData.message.success) {
        throw new Error(resData.error || "Failed to fetch customers");
      }

      const data: ERPCustomer[] = resData.message.data;
      const enhanced = data.map((customer): Customer => {
        return {
          id: customer.name,
          type: customer.customer_type === "Company" ? "company" : "individual",
          name: customer.customer_name || `Customer ${customer.name.slice(0, 5)}`,
          email: customer.contact?.email_id || "",
          phone: customer.contact?.mobile_no || customer.contact?.phone || "",
          address: {
            street: customer.address?.address_line1 || "",
            city: customer.address?.city || "",
            state: customer.address?.state || "",
            zipCode: customer.address?.pincode || "",
            country: customer.address?.country || ""
          },
          dateOfBirth: "",
          gender: "other",
          loyaltyPoints: 0,
          totalSpent: customer.custom_total_spent || 0,
          totalOrders: customer.custom_total_orders || 0,
          preferredPaymentMethod: "Cash",
          notes: "",
          tags: [],
          status: "active",
          createdAt: new Date().toISOString(),
          lastVisit: customer.custom_last_visit || undefined,
          avatar: undefined,
          defaultCurrency: customer.default_currency,
          companyCurrency: customer.company_currency
        };
      });

      setCustomers(prev => append ? [...prev, ...enhanced] : enhanced);
      const total = resData.message.total_count || 0;
      setTotalCount(total);
      const nextStart = (append ? start : 0) + enhanced.length;
      setStart(nextStart);
      setHasMore(nextStart < total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reset paging on new search
    setStart(0);
    setHasMore(false);
    setTotalCount(0);
    const t = setTimeout(() => {
      fetchCustomers(searchQuery, false);
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadMore = async () => {
    if (hasMore) {
      await fetchCustomers(searchQuery, true);
    }
  };

  const addCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [newCustomer, ...prev]);
  };

  return {
    customers,
    isLoading,
    error,
    refetch: fetchCustomers,
    addCustomer,
    hasMore,
    totalCount,
    loadMore,
  };
}

export function useCustomerDetails(customerId: string | null) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    const fetchCustomer = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching customer details for ID:', customerId);
        const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_info?customer_name=${encodeURIComponent(customerId)}`);
        const resData = await response.json();

        console.log('Customer API response:', resData);

        if (!resData.message || resData.message.success === false) {
          throw new Error(resData.message?.error || "Failed to fetch customer");
        }

        // Transform the API response to match the Customer interface
        const apiCustomer = resData.message;
        const transformedCustomer: Customer = {
          id: apiCustomer.name,
          type: apiCustomer.customer_type === "Company" ? "company" : "individual",
          name: apiCustomer.customer_name || `Customer ${apiCustomer.name.slice(0, 5)}`,
          email: apiCustomer.contact_data?.email_id || apiCustomer.email_id || "",
          phone: apiCustomer.contact_data?.mobile_no || apiCustomer.contact_data?.phone || apiCustomer.mobile_no || "",
          address: {
            addressType: "Billing",
            street: apiCustomer.address_data?.address_line1 || "",
            buildingNumber: apiCustomer.address_data?.address_line2 || "",
            city: apiCustomer.address_data?.city || "",
            state: apiCustomer.address_data?.state || "",
            zipCode: apiCustomer.address_data?.pincode || "",
            country: apiCustomer.address_data?.country || "Saudi Arabia"
          },
          dateOfBirth: "",
          gender: "other",
          loyaltyPoints: 0,
          totalSpent: 0,
          totalOrders: 0,
          preferredPaymentMethod: apiCustomer.payment_method || "Cash",
          notes: "",
          tags: [],
          status: "active",
          createdAt: apiCustomer.creation || new Date().toISOString(),
          lastVisit: undefined,
          avatar: undefined,
          defaultCurrency: undefined,
          companyCurrency: undefined,
          customer_group: apiCustomer.customer_group || "All Customer Groups",
          territory: apiCustomer.territory || "All Territories",
          // Add missing fields that AddCustomerModal expects
          contactPerson: apiCustomer.contact_data ?
            `${apiCustomer.contact_data.first_name || ''} ${apiCustomer.contact_data.last_name || ''}`.trim() || apiCustomer.customer_name :
            apiCustomer.customer_name || "",
          companyName: apiCustomer.customer_type === "Company" ? apiCustomer.customer_name : undefined,
          taxId: apiCustomer.vat_number || "",
          industry: apiCustomer.industry || "",
          employeeCount: apiCustomer.employee_count || "",
          registrationScheme: apiCustomer.registration_scheme || "",
          registrationNumber: apiCustomer.registration_number || ""
        };

        setCustomer(transformedCustomer);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unknown error");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId]);

  return { customer, isLoading, error };
}
