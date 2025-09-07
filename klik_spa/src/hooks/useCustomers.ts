

import { useEffect, useState } from "react";
import type { Customer } from "../data/mockCustomers";

interface ERPCustomer {
  name: string;
  customer_name?: string;
  customer_type?: string;
  email_id?: string;
  mobile_no?: string;
  customer_group?: string;
  custom_gender?: string;
  custom_date_of_birth?: string;
  custom_loyalty_points?: number;
  custom_status?: string;
  custom_total_orders?: number;
  custom_total_spent?: number;
  custom_last_visit?: string;
  custom_tags?: string;
  creation?: string;
  custom_avatar?: string;
  custom_notes?: string;
  default_currency?: string;
  company_currency?: string;
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
        const uaeAddresses = [
          { street: "Sheikh Zayed Road", city: "Dubai", state: "Dubai", zipCode: "12345" },
          { street: "Corniche Road", city: "Abu Dhabi", state: "Abu Dhabi", zipCode: "54321" },
          { street: "Al Qasba", city: "Sharjah", state: "Sharjah", zipCode: "67890" },
          { street: "Al Rigga Road", city: "Deira", state: "Dubai", zipCode: "23456" }
        ];
        const randomIndex = Math.floor(Math.random() * uaeAddresses.length);
        const randomAddress = uaeAddresses[randomIndex];
        return {
          id: customer.name,
          type: customer.customer_type === "Company" ? "company" : "individual",
          name: customer.customer_name || `Customer ${customer.name.slice(0, 5)}`,
          email: customer.email_id || `${customer.name.slice(0, 5)}@example.com`,
          phone: customer.mobile_no || `+9715${Math.floor(Math.random() * 9000000) + 1000000}`,
          address: {
            street: randomAddress?.street || "",
            city: randomAddress?.city || "",
            state: randomAddress?.state || "",
            zipCode: randomAddress?.zipCode || "",
            country: "United Arab Emirates"
          },
          dateOfBirth: customer.custom_date_of_birth || getRandomBirthDate(),
          gender: customer.custom_gender as Customer["gender"] || getRandomGender(),
          loyaltyPoints: customer.custom_loyalty_points || 0,
          totalSpent: customer.custom_total_spent || 0,
          totalOrders: customer.custom_total_orders || 0,
          preferredPaymentMethod: getRandomPaymentMethod(),
          notes: customer.custom_notes || "",
          tags: customer.custom_tags?.split(",").filter(Boolean) || [],
          status: (customer.custom_status as Customer["status"]) || "active",
          createdAt: customer.creation || new Date().toISOString(),
          lastVisit: customer.custom_last_visit || undefined,
          avatar: customer.custom_avatar || undefined,
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

  return {
    customers,
    isLoading,
    error,
    refetch: fetchCustomers
  };
}

// --------------------
// Helper functions
// --------------------
function getRandomGender(): "male" | "female" | "other" {
  const genders: ("male" | "female" | "other")[] = ["male", "female", "other"];
  const index = Math.floor(Math.random() * genders.length);
  return genders[index] || "male";
}

function getRandomBirthDate(): string {
  const start = new Date(1950, 0, 1);
  const end = new Date(2005, 0, 1);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomPaymentMethod(): Customer["preferredPaymentMethod"] {
  const methods: Customer["preferredPaymentMethod"][] = ["cash", "card", "mobile", "loyalty"];
  const index = Math.floor(Math.random() * methods.length);
  return methods[index] || "cash";
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
        // if (!resData.message.success) {
        //   throw new Error(resData.error || "Failed to fetch customer");
        // }

        setCustomer(resData.message);
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
