

import { useEffect, useState } from "react";
import type { Customer } from "../../types";

interface ERPCustomer {
  name: string;
  customer_name?: string;
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
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/method/klik_pos.api.customer.get_customers");
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
        const randomAddress = uaeAddresses[Math.floor(Math.random() * uaeAddresses.length)];

        return {
          id: customer.name,
          name: customer.customer_name || `Customer ${customer.name.slice(0, 5)}`,
          email: customer.email_id || `${customer.name.slice(0, 5)}@example.com`,
          phone: customer.mobile_no || `+9715${Math.floor(Math.random() * 9000000) + 1000000}`,
          address: { ...randomAddress, country: "United Arab Emirates" },
          dateOfBirth: customer.custom_date_of_birth || getRandomBirthDate(),
          gender: (customer.custom_gender as Customer["gender"]) || getRandomGender(),
          loyaltyPoints: customer.custom_loyalty_points || Math.floor(Math.random() * 1000),
          totalSpent: customer.custom_total_spent || Math.floor(Math.random() * 10000) + 500,
          totalOrders: customer.custom_total_orders ?? 200,
          preferredPaymentMethod: getRandomPaymentMethod(),
          notes: customer.custom_notes || "",
          tags: customer.custom_tags?.split(",") || getRandomTags(),
          status: (customer.custom_status as Customer["status"]) || getRandomStatus(),
          createdAt: customer.creation || new Date().toISOString(),
          lastVisit: customer.custom_last_visit || getRandomRecentDate(),
          avatar: customer.custom_avatar || getRandomAvatar()
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
    fetchCustomers();
  }, []);

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
  const genders = ["male", "female", "other"] as const;
  return genders[Math.floor(Math.random() * genders.length)];
}

function getRandomBirthDate(): string {
  const start = new Date(1950, 0, 1);
  const end = new Date(2005, 0, 1);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomRecentDate(): string {
  const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function getRandomPaymentMethod(): Customer["preferredPaymentMethod"] {
  const methods = ["cash", "card", "mobile", "loyalty"] as const;
  return methods[Math.floor(Math.random() * methods.length)];
}

function getRandomAvatar(): string {
  const avatars = ["/avatars/1.png", "/avatars/2.png", "/avatars/3.png", "/avatars/4.png"];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

function getRandomStatus(): Customer["status"] {
  const statuses = ["active", "vip", "inactive"] as const;
  return statuses[Math.floor(Math.random() * statuses.length)];
}

function getRandomTags(): string[] {
  const allTags = ["regular", "wholesale", "corporate", "family", "new"];
  const count = Math.floor(Math.random() * 3) + 1;
  return [...new Set(Array(count).fill(0).map(() => allTags[Math.floor(Math.random() * allTags.length)]))];
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
