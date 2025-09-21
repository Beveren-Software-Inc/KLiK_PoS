interface CustomerAddress {
  addressType?: string;
  street: string;
  buildingNumber?: string;
  city: string;
  state?: string;
  zipCode?: string;
  country: string;
}

interface CustomerData {
  name: string;
  customer_type: string;
  email: string;
  phone: string;
  name_arabic?: string;
  address: CustomerAddress;
  preferredPaymentMethod?: string;
  contactName?: string;
  vatNumber?: string;
  registrationScheme?: string;
  registrationNumber?: string;
  customer_group?: string;
  territory?: string;
}

export const useCustomerActions = () => {
  const csrfToken = window.csrf_token;

  const createCustomer = async (customerData: CustomerData) => {
    try {
      const response = await fetch('/api/method/klik_pos.api.customer.create_or_update_customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
           "X-Frappe-CSRF-Token": csrfToken,

        },
        body: JSON.stringify({ customer_data: customerData }),
        credentials: 'include'
      });

      const result = await response.json();

      if (!result.message || !result.message.success) {
        throw new Error(result.message?.error || "Customer creation failed");
      }

      return result.message;
    } catch (error) {
      console.error("❌ Error creating customer:", error);
      throw error;
    }
  };

  const updateCustomer = async (customerId: string, customerData: Partial<CustomerData>) => {
    try {
      const response = await fetch('/api/method/klik_pos.api.customer.update_customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
             "X-Frappe-CSRF-Token": csrfToken,

        },
        body: JSON.stringify({
          customer_id: customerId,
          customer_data: customerData
        }),
        credentials: 'include'

      });

      const result = await response.json();

      if (!result.message || !result.message.success) {
        throw new Error(result.message?.error || "Customer update failed");
      }

      return result.message;
    } catch (error) {
      console.error("❌ Error updating customer:", error);
      throw error;
    }
  };

  const getCustomerGroups = async () => {
    try {
      const response = await fetch('/api/method/klik_pos.api.customer.get_customer_groups', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const result = await response.json();

      if (!result.message || !result.message.success) {
        throw new Error(result.message?.error || "Failed to fetch customer groups");
      }

      return result.message.data;
    } catch (error) {
      console.error("❌ Error fetching customer groups:", error);
      throw error;
    }
  };

  const getTerritories = async () => {
    try {
      const response = await fetch('/api/method/klik_pos.api.customer.get_territories', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const result = await response.json();

      if (!result.message || !result.message.success) {
        throw new Error(result.message?.error || "Failed to fetch territories");
      }

      return result.message.data;
    } catch (error) {
      console.error("❌ Error fetching territories:", error);
      throw error;
    }
  };

  return {
    createCustomer,
    updateCustomer,
    getCustomerGroups,
    getTerritories
  };
};
