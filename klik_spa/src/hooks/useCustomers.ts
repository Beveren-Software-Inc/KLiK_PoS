

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

  const fetchCustomers = async (search?: string) => {
    setIsLoading(true);
    try {
      const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
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

      setCustomers(enhanced);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(searchQuery);
  }, [searchQuery]);

  const addCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [newCustomer, ...prev]);
  };

  return {
    customers,
    isLoading,
    error,
    refetch: fetchCustomers,
    addCustomer
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
        const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_info?customer_name=${customerId}`);
        const resData = await response.json();

        if (!resData.message || resData.message.success === false) {
          throw new Error(resData.message?.error || "Failed to fetch customer");
        }

        // Transform the API response to match the Customer interface
        const apiCustomer = resData.message;
        const transformedCustomer: Customer = {
          id: apiCustomer.name,
          type: apiCustomer.customer_type === "Company" ? "company" : "individual",
          name: apiCustomer.customer_name || `Customer ${apiCustomer.name.slice(0, 5)}`,
          email: apiCustomer.email_id || "",
          phone: apiCustomer.mobile_no || "",
          address: {
            addressType: "Billing",
            street: "",
            city: "",
            state: "",
            zipCode: "",
            country: "Saudi Arabia" // Default country
          },
          dateOfBirth: "",
          gender: "other",
          loyaltyPoints: 0,
          totalSpent: 0,
          totalOrders: 0,
          preferredPaymentMethod: "Cash",
          notes: "",
          tags: [],
          status: "active",
          createdAt: apiCustomer.creation || new Date().toISOString(),
          lastVisit: undefined,
          avatar: undefined,
          defaultCurrency: undefined,
          companyCurrency: undefined,
          customer_group: apiCustomer.customer_group || "All Customer Groups",
          territory: apiCustomer.territory || "Saudi Arabia",
          // Add missing fields that AddCustomerModal expects
          contactPerson: apiCustomer.customer_name || "", // Use customer_name as contact person for individual customers
          companyName: apiCustomer.customer_type === "Company" ? apiCustomer.customer_name : undefined,
          taxId: "",
          industry: "",
          employeeCount: ""
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
