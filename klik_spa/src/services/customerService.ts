import { useFrappeCreateDoc, useFrappeUpdateDoc } from "frappe-react-sdk";

export const useCustomerActions = () => {
  const { createDoc } = useFrappeCreateDoc();
  const { updateDoc } = useFrappeUpdateDoc();

  const createCustomer = async (customerData: CustomerData) => {
    try {
      const customer = await createDoc('Customer', {
        customer_name: customerData.name,
        customer_type: "Individual",
        customer_name_in_arabic: "nknkn",
        email_id: customerData.email,
        mobile_no: customerData.phone,
        custom_country: "Kenya"
      });

      await createDoc('Address', {
        address_title: `${customerData.name} - Primary`,
        address_type: 'Billing',
        address_line1: customerData.address.street,
        city: customerData.address.city,
        state: customerData.address.state,
        pincode: customerData.address.zipCode,
        country: customerData.address.country,
        is_primary_address: 1,
        is_shipping_address: 1,
        links: [{
          link_doctype: 'Customer',
          link_name: customer.name,
          link_title: customerData.name
        }]
      });

      return customer;

    } catch (error) {
      console.error("❌ Error creating customer:", error);
      throw error;
    }
  };

  const updateCustomer = async (customerId: string, customerData: Partial<CustomerData>) => {
    try {
        console.log("What are the data",customerData)
      return await updateDoc("Customer", customerId, customerData);
    } catch (error) {
      console.error("❌ Error updating customer:", error);
      throw error;
    }
  };

  return {
    createCustomer,
    updateCustomer
  };
};
