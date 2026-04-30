import { type Customer } from "./customer";

export type ExtendedCustomer = Customer & {
  address: Customer['address'] & {
    addressType?: string;
    buildingNumber?: string;
  };
};

export interface AddCustomerModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onSave: (customer: Partial<Customer>) => void;
  isFullPage?: boolean;
  prefilledName?: string;
  prefilledData?: { name?: string; email?: string; phone?: string };
}

export type CustomerFormData = {
  customer_type: "individual" | "company";
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxId: string;
  address: {
    addressType: string;
    street: string;
    buildingNumber: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  status: "active" | "inactive";
  vatNumber: string;
  registrationScheme: string;
  registrationNumber: string;
  preferredPaymentMethod: Customer["preferredPaymentMethod"];
  customer_group: string;
  territory: string;
};

export type CountryOption = { value: string; label: string };