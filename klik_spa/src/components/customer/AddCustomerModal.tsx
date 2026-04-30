import React, { useEffect, useState } from "react";
import { X, Save, Building, User } from "lucide-react";
import type { AddCustomerModalProps } from "../../types/customerForm";
import type { Customer } from "../../types/customer";
import { MissingFieldsRenderer } from "./MissingFieldsRenderer";
import { CustomerTypeSelector } from "./CustomerTypeSelector";
import { BasicInformationForm } from "./BasicInformationForm";
import { ContactInformationForm } from "./ContactInformationForm";
import { ZatcaDetailsForm } from "./ZatcaDetailsForm";
import { AddressForm } from "./AddressForm";
import { toast } from "react-toastify";
import { usePOSProfileStore } from "../../stores/posProfileStore";
import { useCustomerForm, useMissingFieldsIntegration, useRequiredCustomerFields } from "../../hooks/useCustomers";

export default function AddCustomerModal({
  customer: propCustomer,
  onClose,
  onSave,
  isFullPage = false,
  prefilledName = "",
  prefilledData = {},
}: AddCustomerModalProps) {
  const { posDetails } = usePOSProfileStore();
  const {
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
    handleSubmit,
    canSaveCustomer,
  } = useCustomerForm(propCustomer, prefilledName, prefilledData);

  const [missingDynamicData, setMissingDynamicData] = useState<Record<string, any>>({});
  const [isMissingFieldsValid, setIsMissingFieldsValid] = useState(true);

  const existingFormFields = [
    'customer_type', 'customer_name', 'name', 'contactName', 'email', 'phone', 
    'taxId', 'address', 'status', 'vatNumber', 'registrationScheme', 
    'registrationNumber', 'preferredPaymentMethod', 'customer_group', 'territory'
  ];

  const { requiredFields } = useRequiredCustomerFields(existingFormFields, formData.customer_type);

  const isFieldRequired = (fieldname: string): boolean => {
    return requiredFields.some(f => f.fieldname === fieldname);
  };

  const {
    missingFields,
    missingFieldsErrors,
    loading: missingFieldsLoading,
    error: missingFieldsError,
    hasMissingFields,
    handleFieldChange,
    validateAndGetErrors,
    getMissingFieldsData
  } = useMissingFieldsIntegration({
    existingFieldNames: existingFormFields,
    customerType: formData.customer_type,
    formData,
    onMissingFieldsChange: (data, isValid) => {
      setMissingDynamicData(data);
      setIsMissingFieldsValid(isValid);
    }
  });

  useEffect(() => {
    if (posDetails && posDetails.custom_allow_to_create_and_edit_customers !== 1) {
      toast.error("You do not have permission to create or edit customers.");
      onClose();
    }
  }, [posDetails, onClose]);

  const getAvailableCustomerTypes = () => {
    const isB2B = posDetails?.business_type === "B2B";
    const isB2C = posDetails?.business_type === "B2C";
    const isBoth = posDetails?.business_type === "B2B & B2C";

    if (isB2B) return [{ value: "company" as const, label: "Company", icon: Building, desc: "Business customer" }];
    if (isB2C) return [{ value: "individual" as const, label: "Individual", icon: User, desc: "Personal customer" }];
    if (isBoth) return [
      { value: "individual" as const, label: "Individual", icon: User, desc: "Personal customer" },
      { value: "company" as const, label: "Company", icon: Building, desc: "Business customer" },
    ];
    return [
      { value: "individual" as const, label: "Individual", icon: User, desc: "Personal customer" },
      { value: "company" as const, label: "Company", icon: Building, desc: "Business customer" },
    ];
  };

  const updateFormField = (field: string, value: any) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev: any) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  const showCustomerTypeSelector = posDetails?.business_type === "B2B & B2C";
  const showZatcaForm = formData.customer_type === "company" && posDetails?.is_zatca_enabled === true;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isMissingValid = validateAndGetErrors();
    if (!isMissingValid) {
      toast.error("Please fill all additional required fields");
      return;
    }
    
    const allFormData = {
      ...formData,
    };
    
    
    const customOnSave = async (customerData: Partial<Customer>) => {
      const finalCustomerData = {
        ...customerData,
        ...allFormData,
        name: allFormData.name || customerData.name,
        email: allFormData.email || customerData.email,
        phone: allFormData.phone || customerData.phone,
        taxId: allFormData.taxId || customerData.taxId,
        customer_group: allFormData.customer_group || customerData.customer_group,
        territory: allFormData.territory || customerData.territory,
        preferredPaymentMethod: allFormData.preferredPaymentMethod || customerData.preferredPaymentMethod,
        status: allFormData.status || customerData.status,
        ...(allFormData.customer_type === "company" && {
          contactName: allFormData.contactName || customerData.contactName,
          vatNumber: allFormData.vatNumber || customerData.vatNumber,
          registrationScheme: allFormData.registrationScheme || customerData.registrationScheme,
          registrationNumber: allFormData.registrationNumber || customerData.registrationNumber,
        }),
        address: {
          ...allFormData.address,
          ...customerData.address
        }
      };
      onSave(finalCustomerData);
    };
    
    await handleSubmit(e, customOnSave, onClose);
  };

  return (
    <div className={isFullPage ? "h-full" : "fixed inset-0 bg-black/70 bg-opacity-50 flex items-center justify-center p-4 z-50"}>
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-800 flex flex-col" : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"}>
        {!isFullPage && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditing ? "Edit Customer" : "Add New Customer"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X size={24} />
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className={isFullPage ? "flex-1 flex flex-col" : "flex flex-col h-full"}>
          <div className={isFullPage ? "flex-1 p-6 space-y-6 overflow-y-auto" : "flex-1 p-6 space-y-6 overflow-y-auto"}>
            {showCustomerTypeSelector ? (
              <CustomerTypeSelector
                customerType={formData.customer_type}
                onChange={(type) => updateFormField("customer_type", type)}
                availableTypes={getAvailableCustomerTypes()}
              />
            ) : (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Type</h3>
                <div className="bg-beveren-50 dark:bg-beveren-900/20 border-2 border-beveren-500 rounded-lg p-4">
                  <div className="flex items-center">
                    {formData.customer_type === "company" ? <Building size={24} className="text-beveren-600 mr-3" /> : <User size={24} className="text-beveren-600 mr-3" />}
                    <div>
                      <span className="font-medium text-beveren-900 dark:text-beveren-100">
                        {formData.customer_type === "company" ? "Company" : "Individual"} Customer
                      </span>
                      <p className="text-sm text-beveren-700 dark:text-beveren-300 mt-1">
                        {formData.customer_type === "company" ? "Business customer (B2B)" : "Personal customer (B2C)"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <BasicInformationForm
              customerType={formData.customer_type}
              formData={formData}
              errors={errors}
              loadingGroups={loadingGroups}
              loadingTerritories={loadingTerritories}
              customerGroups={customerGroups}
              territories={territories}
              isZatcaEnabled={posDetails?.is_zatca_enabled}
              isTaxIdRequired={isFieldRequired('tax_id')}
              isCustomerGroupRequired={isFieldRequired('customer_group')}
              isTerritoryRequired={isFieldRequired('territory')}
              onChange={updateFormField}
            />

            {formData.customer_type === "individual" && (
              <ContactInformationForm
                customerType="individual"
                formData={formData}
                errors={errors}
                isEmailRequired={isFieldRequired('email_id')}
                isPhoneRequired={isFieldRequired('mobile_no')}
                onChange={updateFormField}
              />
            )}

            {formData.customer_type === "company" && (
              <ContactInformationForm
                customerType="company"
                formData={formData}
                errors={errors}
                isEmailRequired={isFieldRequired('email_id')}
                isPhoneRequired={isFieldRequired('mobile_no')}
                onChange={updateFormField}
              />
            )}

            {showZatcaForm && (
              <ZatcaDetailsForm
                formData={formData}
                errors={errors}
                isVatRequired={isFieldRequired('vat_number')}
                isRegistrationRequired={isFieldRequired('registration_number')}
                onChange={updateFormField}
              />
            )}

            <AddressForm
              customerType={formData.customer_type}
              formData={formData.address}
              errors={errors}
              isZatcaEnabled={posDetails?.is_zatca_enabled}
              onChange={(field, value) => updateFormField(`address.${field}`, value)}
            />

            {!missingFieldsLoading && hasMissingFields && (
              <MissingFieldsRenderer
                missingFields={missingFields}
                onFieldChange={(fieldname, value) => {
                  handleFieldChange(fieldname, value);
                  // Also update formData to keep it in sync
                  updateFormField(fieldname, value);
                }}
                errors={missingFieldsErrors}
              />
            )}

            {missingFieldsLoading && (
              <div className="text-center py-8">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-beveren-500 border-t-transparent rounded-full"></div>
                <p className="mt-2 text-gray-500">Loading additional required fields...</p>
              </div>
            )}

            {missingFieldsError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                Error loading required fields: {missingFieldsError}
              </div>
            )}

            {submitError && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
                {submitError}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !canSaveCustomer()}
                className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
                  isSubmitting || !canSaveCustomer() ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">↻</span>
                    <span>{isEditing ? "Updating..." : "Creating..."}</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{isEditing ? "Update Customer" : "Save Customer"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}