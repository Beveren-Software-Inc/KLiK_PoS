import { useState, useEffect, useRef, useCallback } from "react";
import { type Customer } from "../types/customer";
import { type CustomerFormData, type ExtendedCustomer } from "../types/customerForm";
import { useCustomerActions } from "../services/customerService";
import { usePOSProfileStore } from "../stores/posProfileStore";
import { toast } from "react-toastify";

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
  is_walkin?: number;
  tax_id?: string;
  contact?: {
    first_name?: string;
    last_name?: string;
    email_id?: string;
    phone?: string;
    mobile_no?: string;
  };
  address?: {
    address_line1?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
}

export interface RequiredField {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string;
  default?: any;
  description?: string;
  placeholder?: string;
}

export interface MissingField extends RequiredField {
  value: any;
  error?: string;
}

export const useCustomerForm = (customer: Customer | null | undefined, prefilledName: string, prefilledData: any) => {
  const { posDetails } = usePOSProfileStore();
  const isEditing = !!customer;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerGroups, setCustomerGroups] = useState<Array<{name: string, customer_group_name: string}>>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [territories, setTerritories] = useState<Array<{name: string, territory_name: string}>>([]);
  const [loadingTerritories, setLoadingTerritories] = useState(true);
  const formInitializedRef = useRef(false);
  
  const { getCustomerGroups, getTerritories, createCustomer, updateCustomer } = useCustomerActions();

  const [formData, setFormData] = useState<CustomerFormData>({
    customer_type: "individual",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    taxId: "",
    address: {
      addressType: "Billing",
      street: "",
      buildingNumber: "",
      city: "",
      state: "",
      zipCode: "",
      country: customer?.address.country || posDetails?.company?.country || "",
    },
    status: "active",
    vatNumber: "",
    registrationScheme: "",
    registrationNumber: "",
    preferredPaymentMethod: "Cash",
    customer_group: "All Customer Groups",
    territory: "All Territories",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupsData = await getCustomerGroups();
        setCustomerGroups(groupsData);
        setLoadingGroups(false);

        const territoriesData = await getTerritories();
        setTerritories(territoriesData);
        setLoadingTerritories(false);
      } catch (error) {
        console.error('Error fetching customer groups or territories:', error);
        setLoadingGroups(false);
        setLoadingTerritories(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (customer && !formInitializedRef.current) {
      setFormData({
        customer_type: customer.type || "individual",
        name: customer.name,
        taxId: customer.taxId || "",
        contactName: customer.contactPerson || "",
        email: customer.email,
        phone: customer.phone,
        address: {
          addressType: (customer.address as ExtendedCustomer['address'])?.addressType || "Billing",
          street: customer.address?.street || "",
          buildingNumber: (customer.address as ExtendedCustomer['address'])?.buildingNumber || "",
          city: customer.address?.city || "",
          state: customer.address?.state || "",
          zipCode: customer.address?.zipCode || "",
          country: customer.address?.country || posDetails?.company?.country || "",
        },
        status: customer.status,
        vatNumber: customer.taxId || "",
        registrationScheme: customer.registrationScheme || "",
        registrationNumber: customer.registrationNumber || "",
        preferredPaymentMethod: customer.preferredPaymentMethod || "Cash",
        customer_group: customer.customer_group || "All Customer Groups",
        territory: customer.territory || "All Territories",
      });
      formInitializedRef.current = true;
    } else if (prefilledData && Object.keys(prefilledData).length > 0 && !formInitializedRef.current) {
      setFormData((prev) => ({
        ...prev,
        name: prefilledData.name || prev.name,
        email: prefilledData.email || prev.email,
        phone: prefilledData.phone || prev.phone,
      }));
      formInitializedRef.current = true;
    } else if (prefilledName && !formInitializedRef.current) {
      setFormData((prev) => ({
        ...prev,
        name: prefilledName,
      }));
      formInitializedRef.current = true;
    }
  }, [customer?.id, prefilledName, prefilledData]);

  useEffect(() => {
    if (posDetails && !isEditing) {
      let defaultCustomerType: "individual" | "company" = "individual";
      if (posDetails.business_type === "B2B") {
        defaultCustomerType = "company";
      }
      setFormData((prev) => ({ ...prev, customer_type: defaultCustomerType }));
    }
  }, [posDetails, isEditing]);

  useEffect(() => {
    if (posDetails?.company?.country) {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, country: posDetails.company?.country ?? "" },
      }));
    }
  }, [posDetails?.company?.country]);

  const isValidPhone = (phone: string): boolean => {
    if (!phone.trim()) return false;
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.customer_type === "company") {
      if (!formData.name.trim()) newErrors.name = "Customer name is required";
      if (!formData.contactName.trim()) newErrors.contactName = "Contact name is required";
      if (!formData.email.trim() && !formData.phone.trim()) {
        newErrors.contact = "Either email or phone number must be provided";
      }
      if (formData.phone.trim() && !isValidPhone(formData.phone)) {
        newErrors.phone = "Phone number must have at least 10 digits including country code";
      }
    } else if (formData.customer_type === "individual") {
      if (!formData.email.trim() && !formData.phone.trim()) {
        newErrors.contact = "Either email or phone number must be provided";
      } else if (formData.phone.trim() && !isValidPhone(formData.phone)) {
        newErrors.phone = "Phone number must have at least 10 digits including country code";
      }
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.customer_type === "company" && posDetails?.is_zatca_enabled) {
      if (!formData.vatNumber.trim() && !formData.registrationNumber.trim()) {
        newErrors.vatOrRegistration = "Either VAT number or Registration number must be provided";
      }
      if (formData.registrationScheme && formData.registrationScheme !== "" && !formData.registrationNumber.trim()) {
        newErrors.registrationNumber = "Registration number is required when registration scheme is selected";
      }
      if (formData.vatNumber.trim() && !/^[3]\d{13}[3]$/.test(formData.vatNumber.trim())) {
        newErrors.vatNumber = "VAT number must be 15 digits, start with 3 and end with 3 (ZATCA format)";
      }
    }

    if (formData.customer_type === "company" && posDetails?.is_zatca_enabled === true) {
      if (!formData.address.street.trim()) newErrors.street = "Street address is required for company";
      if (!formData.address.buildingNumber.trim()) {
        newErrors.buildingNumber = "Building number is required for company";
      } else if (formData.address.buildingNumber.trim().length !== 4) {
        newErrors.buildingNumber = "Building number must be exactly 4 digits";
      }
      if (!formData.address.city.trim()) newErrors.city = "City is required for company";
      if (!formData.address.state.trim()) newErrors.state = "State/Province is required for company";
      if (!formData.address.zipCode.trim()) newErrors.zipCode = "Zip code is required for company";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      if (firstErrorKey) toast.error(newErrors[firstErrorKey]);
      return false;
    }
    return true;
  };

  const canSaveCustomer = (): boolean => {
    if (formData.customer_type === "individual") {
      const hasValidEmail = formData.email.trim() !== "";
      const hasValidPhone = isValidPhone(formData.phone);
      return hasValidEmail || hasValidPhone;
    } else if (formData.customer_type === "company") {
      const hasBasicFields = (
        formData.name.trim() !== "" &&
        formData.contactName.trim() !== "" &&
        (formData.email.trim() !== "" || isValidPhone(formData.phone))
      );

      const hasAddressFields = !posDetails?.is_zatca_enabled || (
        formData.address.street.trim() !== "" &&
        formData.address.buildingNumber.trim() !== "" &&
        formData.address.buildingNumber.trim().length === 4 &&
        formData.address.city.trim() !== "" &&
        formData.address.state.trim() !== "" &&
        formData.address.zipCode.trim() !== ""
      );

      const hasRequiredFields = hasBasicFields && hasAddressFields;

      if (posDetails?.is_zatca_enabled === true) {
        const hasZatcaData = formData.vatNumber.trim() !== "" || formData.registrationNumber.trim() !== "";
        return hasRequiredFields && hasZatcaData;
      }
      return hasRequiredFields;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent, onSave: (customer: Partial<Customer>) => void, onClose: () => void) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const { customer_type, contactName, vatNumber, registrationScheme, registrationNumber, ...restFormData } = formData;
      
      const customerData = {
        ...restFormData,
        name: formData.name,
        customer_type: customer_type === "individual" ? "Individual" : "Company",
        email: formData.email,
        phone: formData.phone,
        taxId: formData.taxId,
        address: formData.address,
        preferredPaymentMethod: formData.preferredPaymentMethod,
        customer_group: formData.customer_group,
        territory: formData.territory,
        ...(customer_type === "company" && {
          contactName: formData.contactName,
          vatNumber: formData.vatNumber || undefined,
          registrationScheme: formData.registrationScheme || undefined,
          registrationNumber: formData.registrationNumber || undefined,
        }),
      };

      if (isEditing && customer?.id) {
        const updatedCustomer = await updateCustomer(customer.id, customerData);
        onSave({ ...updatedCustomer, id: customer.id });
      } else {
        const newCustomer = await createCustomer(customerData);
        onSave({
          ...newCustomer,
          id: newCustomer.customer_name || newCustomer.name,
          name: formData.name,
          type: customer_type,
          email: formData.email,
          phone: formData.phone,
          taxId: formData.taxId,
          address: formData.address,
          preferredPaymentMethod: formData.preferredPaymentMethod,
          customer_group: formData.customer_group,
          territory: formData.territory,
          ...(customer_type === "company" && {
            contactName: formData.contactName,
            vatNumber: formData.vatNumber,
            registrationScheme: formData.registrationScheme,
            registrationNumber: formData.registrationNumber,
          }),
          ...restFormData
        });
      }
      onClose();
    } catch (error) {
      console.error("Customer save error:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save customer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    submitError,
    isEditing,
    customerGroups,
    loadingGroups,
    territories,
    loadingTerritories,
    posDetails,
    handleSubmit,
    canSaveCustomer,
  };
};

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
          is_walkin: customer.is_walkin,
          taxId: customer.tax_id || "",
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
        const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_info?customer_name=${encodeURIComponent(customerId)}`);
        const resData = await response.json();

        if (!resData.message || resData.message.success === false) {
          throw new Error(resData.message?.error || "Failed to fetch customer");
        }

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
          is_walkin: apiCustomer.is_walkin,
          createdAt: apiCustomer.creation || new Date().toISOString(),
          lastVisit: undefined,
          avatar: undefined,
          defaultCurrency: undefined,
          companyCurrency: undefined,
          customer_group: apiCustomer.customer_group || "All Customer Groups",
          territory: apiCustomer.territory || "All Territories",
          contactPerson: apiCustomer.contact_data ?
            `${apiCustomer.contact_data.first_name || ''} ${apiCustomer.contact_data.last_name || ''}`.trim() || apiCustomer.customer_name :
            apiCustomer.customer_name || "",
          companyName: apiCustomer.customer_type === "Company" ? apiCustomer.customer_name : undefined,
          taxId: apiCustomer.vat_number || apiCustomer.tax_id || "",
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

export function useRequiredCustomerFields(existingFieldNames: string[], customerType?: 'individual' | 'company') {
  const [requiredFields, setRequiredFields] = useState<RequiredField[]>([]);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  const fetchRequiredFields = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/method/klik_pos.api.customer.get_required_customer_fields', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': (window as any).frappe?.csrf_token || ''
        }
      });
      
      const result = await response.json();
      
      if (!result.message) {
        throw new Error('Failed to fetch required customer fields');
      }
      
      const fields: RequiredField[] = result.message;
      setRequiredFields(fields);
      
      let missing = fields.filter(field => !existingFieldNames.includes(field.fieldname));
      
      missing = missing.filter(field => {
        if (field.fieldname === 'customer_type') return false;
        
        if (customerType === 'individual') {
          const companySpecificFields = ['tax_id', 'vat_number', 'registration_scheme', 'registration_number'];
          if (companySpecificFields.includes(field.fieldname)) return false;
        }
        
        return true;
      });
      
      const missingWithValues = missing.map(field => ({
        ...field,
        value: field.fieldtype === 'Check' ? false : (field.default || ''),
        error: undefined
      }));
      
      setMissingFields(missingWithValues);
      
    } catch (err) {
      console.error('Error fetching required fields:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch required fields');
    } finally {
      setLoading(false);
    }
  }, [existingFieldNames, customerType]);

  useEffect(() => {
    if (existingFieldNames.length > 0 && !isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchRequiredFields();
    }
  }, [existingFieldNames, customerType, fetchRequiredFields]);

  const updateMissingFieldValue = useCallback((fieldname: string, value: any) => {
    setMissingFields(prev =>
      prev.map(field => {
        if (field.fieldname === fieldname) {
          return { ...field, value, error: undefined };
        }
        return field;
      })
    );
  }, []);

  const validateMissingFields = useCallback((): boolean => {
    let isValid = true;
    
    setMissingFields(prev =>
      prev.map(field => {
        if (field.fieldtype === 'Check') return field;
        
        const hasValue = field.value !== undefined && 
                        field.value !== null && 
                        (typeof field.value !== 'string' || field.value.trim() !== '');
        
        if (!hasValue) {
          isValid = false;
          return { ...field, error: `${field.label} is required` };
        }
        
        return { ...field, error: undefined };
      })
    );
    
    return isValid;
  }, []);

  const getMissingFieldsData = useCallback((): Record<string, any> => {
    const data: Record<string, any> = {};
    missingFields.forEach(field => {
      data[field.fieldname] = field.value;
    });
    return data;
  }, [missingFields]);

  const resetMissingFields = useCallback(() => {
    setMissingFields(prev =>
      prev.map(field => ({
        ...field,
        value: field.fieldtype === 'Check' ? false : '',
        error: undefined
      }))
    );
  }, []);

  return {
    requiredFields,
    missingFields,
    loading,
    error,
    updateMissingFieldValue,
    validateMissingFields,
    getMissingFieldsData,
    resetMissingFields,
    hasMissingFields: missingFields.length > 0,
    refetch: fetchRequiredFields
  };
}

interface UseMissingFieldsIntegrationProps {
  existingFieldNames: string[];
  customerType?: 'individual' | 'company';
  formData: any;
  onMissingFieldsChange: (data: Record<string, any>, isValid: boolean) => void;
}

export const useMissingFieldsIntegration = ({
  existingFieldNames,
  customerType,
  formData,
  onMissingFieldsChange
}: UseMissingFieldsIntegrationProps) => {
  const [missingFieldsErrors, setMissingFieldsErrors] = useState<Record<string, string>>({});
  const hasNotifiedRef = useRef(false);
  
  const {
    missingFields,
    loading,
    error,
    updateMissingFieldValue,
    getMissingFieldsData,
    validateMissingFields,
    hasMissingFields
  } = useRequiredCustomerFields(existingFieldNames, customerType);

  useEffect(() => {
    if (!hasNotifiedRef.current && missingFields.length > 0) {
      hasNotifiedRef.current = true;
      const isValid = validateMissingFields();
      const missingData = getMissingFieldsData();
      onMissingFieldsChange(missingData, isValid);
    }
  }, [missingFields, validateMissingFields, getMissingFieldsData, onMissingFieldsChange]);

  const validateAndGetErrors = useCallback((): boolean => {
    const isValid = validateMissingFields();
    
    const newErrors: Record<string, string> = {};
    missingFields.forEach(field => {
      if (field.error) {
        newErrors[field.fieldname] = field.error;
      }
    });
    setMissingFieldsErrors(newErrors);
    
    return isValid;
  }, [validateMissingFields, missingFields]);

  const clearFieldError = useCallback((fieldname: string) => {
    setMissingFieldsErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldname];
      return newErrors;
    });
  }, []);

  const handleFieldChange = useCallback((fieldname: string, value: any) => {
    updateMissingFieldValue(fieldname, value);
    clearFieldError(fieldname);
  }, [updateMissingFieldValue, clearFieldError]);

  return {
    missingFields,
    missingFieldsErrors,
    loading,
    error,
    hasMissingFields,
    handleFieldChange,
    validateAndGetErrors,
    getMissingFieldsData,
    clearFieldError
  };
};