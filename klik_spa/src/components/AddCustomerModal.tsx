import React, { useState, useEffect } from "react";
import { X, User, Mail, MapPin, CreditCard, Building, Save, ChevronRight } from "lucide-react";
import { type Customer } from "../data/mockCustomers";
import { useCustomerActions } from "../services/customerService";
import { toast } from "react-toastify";
import { usePOSDetails } from "../hooks/usePOSProfile";
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import countryList from "react-select-country-list";
import { useMemo } from "react";
interface AddCustomerModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onSave: (customer: Partial<Customer>) => void;
  isFullPage?: boolean;
}

export default function AddCustomerModal({ customer, onClose, onSave, isFullPage = false }: AddCustomerModalProps) {
  const { createCustomer, updateCustomer } = useCustomerActions();
  const isEditing = !!customer;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { posDetails, loading: posLoading } = usePOSDetails();

  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
const countryOptions = countryList().getData();

  // Initialize form data
  const [formData, setFormData] = useState({
    type: "individual" as Customer['type'],
    name: "",
    email: "",
    phone: "",
    address: {
      addressType: "",
      streetName: "",
      buildingNumber: "",
      subdivisionName: "",
      cityName: "",
      postalCode: "",
      country: "Saudi Arabia",
      isPrimary: true
    },
    status: "active" as Customer['status'],
    // Company specific fields
    vatNumber: "",
    registrationScheme: "",
    registrationNumber: "",
    // Payment method
    preferredPaymentMethod: "Cash" as Customer['preferredPaymentMethod']
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with customer data if editing
  useEffect(() => {
    if (customer) {
      setFormData({
        type: customer.type,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: {
          addressType: customer.address?.addressType || "Billing",
          streetName: customer.address?.streetName || "",
          buildingNumber: customer.address?.buildingNumber || "",
          subdivisionName: customer.address?.subdivisionName || "",
          cityName: customer.address?.cityName || "",
          postalCode: customer.address?.postalCode || "",
          country: customer.address?.country || "Saudi Arabia",
          isPrimary: customer.address?.isPrimary !== false
        },
        status: customer.status,
        vatNumber: customer.vatNumber || "",
        registrationScheme: customer.registrationScheme || "",
        registrationNumber: customer.registrationNumber || "",
        preferredPaymentMethod: customer.preferredPaymentMethod || "Cash"
      });
      // If editing, show all steps as completed
      setCompletedSteps(new Set([1, 2, 3, 4]));
      setCurrentStep(4);
    }
  }, [customer]);

  const isB2B = posDetails?.business_type === 'B2B';
  const isB2C = posDetails?.business_type === 'B2C';
  const isBoth = posDetails?.business_type === 'B2B & B2C';

  // Available customer types based on business type
  const getAvailableCustomerTypes = () => {
    if (isB2B) return [{ value: 'company', label: 'Company', icon: Building, desc: 'Business customer' }];
    if (isB2C) return [{ value: 'individual', label: 'Individual', icon: User, desc: 'Personal customer' }];
    if (isBoth) return [
      { value: 'individual', label: 'Individual', icon: User, desc: 'Personal customer' },
      { value: 'company', label: 'Company', icon: Building, desc: 'Business customer' }
    ];
    return [
      { value: 'individual', label: 'Individual', icon: User, desc: 'Personal customer' },
      { value: 'company', label: 'Company', icon: Building, desc: 'Business customer' }
    ];
  };

  // Validate specific steps
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (formData.type === 'company') {
        // For company: Basic Information - name is required
        if (!formData.name.trim()) {
          newErrors.name = "Full name is required";
        }
      } else if (formData.type === 'individual') {
        // For individual: Basic + Contact - at least phone or email required
        if (!formData.email.trim() && !formData.phone.trim()) {
          newErrors.contact = "Either email or phone number must be provided";
        }
        // Email format validation if provided
        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Please enter a valid email address";
        }
      }
    }

    if (step === 2 && formData.type === 'company') {
      // Contact Information for company
      if (!formData.email.trim()) {
        newErrors.email = "Email is required for company";
      }
      if (!formData.phone.trim()) {
        newErrors.phone = "Phone number is required for company";
      }

      // Email format validation if provided
      if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    if (step === 3 && formData.type === 'company') {
      // ZATCA Details
      if (!formData.vatNumber.trim() && !formData.registrationNumber.trim()) {
        newErrors.vatOrRegistration = "Either VAT number or Registration number must be provided";
      }
      
      if (formData.registrationScheme && !formData.registrationNumber.trim()) {
        newErrors.registrationNumber = "Registration number is required when registration scheme is selected";
      }
      if (formData.vatNumber.trim()) {
    if (!/^[3]\d{13}[3]$/.test(formData.vatNumber.trim())) {
      newErrors.vatNumber = "VAT number must be 15 digits, start with 3 and end with 3 (ZATCA format)";
    }
  }
    }

    // Address validation (optional but validate format if provided)
    const addressStep = formData.type === 'company' ? 4 : 2;
    if (step === addressStep) {
      if (formData.address.buildingNumber && !/^\d{4}$/.test(formData.address.buildingNumber)) {
        newErrors.buildingNumber = "Building number must be exactly 4 digits";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      toast.error(newErrors[firstErrorKey]);
      return false;
    }

    return true;
  };

  const proceedToNextStep = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => prev + 1);
      setErrors({});
    }
  };

  const canProceedFromStep = (step: number): boolean => {
    if (step === 1) {
      if (formData.type === 'company') {
        return formData.name.trim() !== "";
      } else if (formData.type === 'individual') {
        return formData.email.trim() !== "" || formData.phone.trim() !== "";
      }
    }
    if (step === 2 && formData.type === 'company') {
      return formData.email.trim() !== "" && formData.phone.trim() !== "";
    }
    if (step === 3 && formData.type === 'company') {
      return formData.vatNumber.trim() !== "" || formData.registrationNumber.trim() !== "";
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate all completed steps
    let isValid = true;
    for (let step = 1; step <= currentStep; step++) {
      if (!validateStep(step)) {
        isValid = false;
        break;
      }
    }

    if (!isValid) return;
    setIsSubmitting(true);
    
    try {
      const customerData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        type: formData.type,
        address: formData.address,
        status: formData.status,
        preferredPaymentMethod: formData.preferredPaymentMethod,
        ...(formData.type === 'company' && {
          vatNumber: formData.vatNumber || undefined,
          registrationScheme: formData.registrationScheme || undefined,
          registrationNumber: formData.registrationNumber || undefined,
        })
      };

      if (isEditing && customer?.id) {
        const updatedCustomer = await updateCustomer(customer.id, customerData);
        onSave({
          ...updatedCustomer,
          id: customer.id,
        });
      } else {
        const newCustomer = await createCustomer(customerData);
        onSave({
          ...newCustomer,
          id: newCustomer.name,
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Customer save error:', error);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'Failed to save customer. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

 const registrationSchemes = [
  { value: "Select Registration Scheme", label: "Select Registration Scheme" },
  { value: "Commercial Registration number(CRN)", label: "Commercial Registration number(CRN)" },
  { value: "MOMRAH(MOM)", label: "MOMRAH(MOM)" },
  { value: "MHRSD(MLS)", label: "MHRSD(MLS)" },
  { value: "700(700)", label: "700(700)" },
  { value: "MISA(SAG)", label: "MISA(SAG)" },
  { value: "Other OD(OTH)", label: "Other OD(OTH)" }
];

const addressTypes = [
  { value: "Billing", label: "Billing" },
  { value: "Shipping", label: "Shipping" },
  { value: "Office", label: "Office" },
  { value: "Personal", label: "Personal" },
  { value: "Plant", label: "Plant" },
  { value: "Postal", label: "Postal" },
  { value: "Shop", label: "Shop" },
  { value: "Subsidiary", label: "Subsidiary" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Current", label: "Current" },
  { value: "Permanent", label: "Permanent" },
  { value: "Other", label: "Other"}
]


  const paymentMethods = [
  { value: "Cash", label: "Cash" },
  { value: "Bank Card", label: "Bank Card" },
  { value: "Bank Payment", label: "Bank Payment" },
  { value: "Credit", label: "Credit" }
];

  const availableCustomerTypes = getAvailableCustomerTypes();

  // Determine what steps to show based on customer type
  const getMaxSteps = () => {
    if (formData.type === 'individual') return 2; // Basic+Contact, Address
    if (formData.type === 'company') return 4; // Basic, Contact, ZATCA, Address
    return 2;
  };

  return (
    <div className={isFullPage ? "h-full" : "fixed inset-0 bg-black/70 bg-opacity-50 flex items-center justify-center p-4 z-50"}>
      <div className={isFullPage ? "h-full bg-white dark:bg-gray-800 flex flex-col" : "bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"}>
        {/* Header */}
        {!isFullPage && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            {Array.from({length: getMaxSteps()}, (_, i) => {
              const stepNumber = i + 1;
              const isCompleted = completedSteps.has(stepNumber);
              const isCurrent = currentStep === stepNumber;
              const canShow = stepNumber <= currentStep || isCompleted;
              
              return (
                <div key={stepNumber} className={`flex items-center ${i < getMaxSteps() - 1 ? 'flex-1' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted ? 'bg-beveren-600 text-white' :
                    isCurrent ? 'bg-beveren-100 text-beveren-600 border-2 border-beveren-600' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {stepNumber}
                  </div>
                  {i < getMaxSteps() - 1 && (
                    <div className={`flex-1 h-1 mx-4 ${
                      isCompleted ? 'bg-beveren-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Step {currentStep} of {getMaxSteps()}: {
              currentStep === 1 && formData.type === 'company' ? 'Basic Information' :
              currentStep === 1 && formData.type === 'individual' ? 'Basic & Contact Information' :
              currentStep === 2 && formData.type === 'company' ? 'Contact Information' :
              currentStep === 2 && formData.type === 'individual' ? 'Address (Optional)' :
              currentStep === 3 && formData.type === 'company' ? 'ZATCA Details' :
              'Address (Optional)'
            }
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={isFullPage ? "flex-1 p-6 space-y-6 overflow-y-auto" : "p-6 space-y-6"}>
          
          {/* Step 1: Customer Type & Basic Information + Contact (Individual) OR Basic Only (Company) */}
          <div className={`transition-all duration-300 ${currentStep >= 1 ? 'block' : 'hidden'}`}>
            {/* Customer Type Selection - Only show if multiple types available */}
            {availableCustomerTypes.length > 1 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Customer Type
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableCustomerTypes.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <label
                        key={type.value}
                        className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          formData.type === type.value
                            ? 'border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20'
                            : 'border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="customerType"
                          value={type.value}
                          checked={formData.type === type.value}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, type: e.target.value as Customer['type'] }));
                            setCurrentStep(1);
                            setCompletedSteps(new Set());
                          }}
                          className="sr-only"
                        />
                        <IconComponent size={24} className={`mb-2 ${
                          formData.type === type.value ? 'text-beveren-600' : 'text-gray-400'
                        }`} />
                        <span className={`font-medium text-sm ${
                          formData.type === type.value ? 'text-beveren-900 dark:text-beveren-100' : 'text-gray-900 dark:text-white'
                        }`}>
                          {type.label}
                        </span>
                        <span className={`text-xs text-center mt-1 ${
                          formData.type === type.value ? 'text-beveren-700 dark:text-beveren-300' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {type.desc}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <User size={20} className="mr-2" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Customer['status'] }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div> */}

                {formData.type === "company" && (
                    <div>
                      <label
                        htmlFor="country"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Customer Country
                      </label>
                      <input
                        list="country-list"
                        id="country"
                        value={formData.address.country}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            address: { ...prev.address, country: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Select country"
                      />
                      <datalist id="country-list">
                        {countryOptions.map((country) => (
                          <option key={country.value} value={country.label} />
                        ))}
                      </datalist>
                    </div>
                  )}
              </div>
            </div>

            {/* Contact Information for Individual - Show in Step 1 */}
            {formData.type === 'individual' && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Mail size={20} className="mr-2" />
                  Contact Information
                  <span className="text-sm font-normal text-gray-500 ml-2">(At least one required)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        errors.email || errors.contact ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="customer@email.com"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  <div className="space-y-4">
      {/* Phone Number */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phone Number
        </label>
        <PhoneInput
          id="phone"
          international
          defaultCountry="SA" // or "US", "SA" etc. (set based on your context)
          value={formData.phone}
          onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
                </div>
                {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
              </div>
            )}

            {/* Action buttons for step 1 */}
            {/* Action buttons for step 1 */}
<div className="flex justify-between mt-4">
  <div className="flex space-x-3">
    {/* Show Save button only if still on step 1 */}
    {formData.type === 'individual' && canProceedFromStep(1) && currentStep === 1 && (
      <button
        type="submit"
        disabled={isSubmitting}
        className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
          isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin">↻</span>
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Save size={18} />
            <span>Save Customer</span>
          </>
        )}
      </button>
    )}
  </div>
  
  {canProceedFromStep(1) && currentStep === 1 && (
    <button
      type="button"
      onClick={proceedToNextStep}
      className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2"
    >
      <span>{formData.type === 'company' ? 'Continue to Contact' : 'Add Address'}</span>
      <ChevronRight size={16} />
    </button>
  )}
</div>

          </div>

          {/* Step 2: Contact Information (Company only) OR Address (Individual) */}
          {currentStep >= 2 && formData.type === 'company' && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Mail size={20} className="mr-2" />
                Contact Information
                {formData.type === 'individual' && (
                  <span className="text-sm font-normal text-gray-500 ml-2">(At least one required)</span>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.email || errors.contact ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="customer@email.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                  {/* Phone Number */}
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Phone Number
                      </label>
                      <PhoneInput
                        id="phone"
                        international
                        defaultCountry="SA" // or "US", "SA" etc. (set based on your context)
                        value={formData.phone}
                        onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
              </div>
              {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}

              <div className="flex justify-between mt-4">
                <div className="flex space-x-3">
                  {formData.type === 'individual' && canProceedFromStep(2) && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
                        isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin">↻</span>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          <span>Save Customer</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {canProceedFromStep(2) && currentStep === 2 && (
                  <button
                    type="button"
                    onClick={proceedToNextStep}
                    className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2"
                  >
                    <span>{formData.type === 'company' ? 'Continue to ZATCA' : 'Add Address'}</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: ZATCA Details (Company only) */}
          {currentStep >= 3 && formData.type === 'company' && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <CreditCard size={20} className="mr-2" />
                ZATCA Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    id="paymentMethod"
                    value={formData.preferredPaymentMethod}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      preferredPaymentMethod: e.target.value as Customer['preferredPaymentMethod']
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  >
                    {paymentMethods.map(method => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="vatNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    VAT Number
                  </label>
                  <input
                    type="text"
                    id="vatNumber"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, vatNumber: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.vatOrRegistration ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter VAT number"
                  />
                </div>

                <div>
                  <label htmlFor="registrationScheme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration Scheme
                  </label>
                  <select
                    id="registrationScheme"
                    value={formData.registrationScheme}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationScheme: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
                  >
                    {registrationSchemes.map(scheme => (
                      <option key={scheme.value} value={scheme.value}>{scheme.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registration Number {formData.registrationScheme ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    id="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.registrationNumber || errors.vatOrRegistration ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter registration number"
                  />
                  {errors.registrationNumber && <p className="text-red-500 text-xs mt-1">{errors.registrationNumber}</p>}
                </div>
              </div>
              {errors.vatOrRegistration && <p className="text-red-500 text-xs mt-1">{errors.vatOrRegistration}</p>}

              <div className="flex justify-between mt-4">
                {/* <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin">↻</span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Save Customer</span>
                    </>
                  )}
                </button> */}

                {canProceedFromStep(3) && currentStep === 3 && (
                  <button
                    type="button"
                    onClick={proceedToNextStep}
                    className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700 transition-colors flex items-center space-x-2"
                  >
                    <span>Add Address</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Address for Individual OR Step 4: Address for Company */}
          {(currentStep >= 2 && formData.type === 'individual') || 
 (currentStep >= 4 && formData.type === 'company') ? (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
      <MapPin size={20} className="mr-2" />
      Address (Optional)
    </h3>

    <div className="space-y-4">
      {/* Address Type + Street */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
  <label
    htmlFor="addressType"
    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
  >
    Address Type
  </label>
  <select
    id="addressType"
    value={formData.address.addressType}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, addressType: e.target.value },
      }))
    }
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
               rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 
               dark:bg-gray-700 dark:text-white"
  >
    <option value="">Select Address Type</option>
    {addressTypes.map((type) => (
      <option key={type.value} value={type.value}>
        {type.label}
      </option>
    ))}
  </select>
</div>



        <div>
          <label htmlFor="streetName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Street Name {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
          </label>
          <input
            type="text"
            id="streetName"
            value={formData.address.streetName}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, streetName: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter street name"
          />
        </div>
      </div>

      {/* Building + Subdivision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="buildingNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Building Number (4 digits){formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
          </label>
          <input
            type="text"
            id="buildingNumber"
            value={formData.address.buildingNumber}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, buildingNumber: e.target.value }
            }))}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.buildingNumber ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="1234"
            maxLength={4}
          />
          {errors.buildingNumber && <p className="text-red-500 text-xs mt-1">{errors.buildingNumber}</p>}
        </div>

        <div>
          <label htmlFor="subdivisionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subdivision Name {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
          </label>
          <input
            type="text"
            id="subdivisionName"
            value={formData.address.subdivisionName}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, subdivisionName: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter subdivision"
          />
        </div>
      </div>

      {/* City + Postal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cityName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            City Name {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
          </label>
          <input
            type="text"
            id="cityName"
            value={formData.address.cityName}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, cityName: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter city name"
          />
        </div>

        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Postal Code {formData.type === "company" && (
    <span className="text-red-500">*</span>
  )}
          </label>
          <input
            type="text"
            id="postalCode"
            value={formData.address.postalCode}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, postalCode: e.target.value }
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
            placeholder="12345"
          />
        </div>
      </div>

      {/* Primary Checkbox */}
      <div className="flex items-center">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.address.isPrimary}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              address: { ...prev.address, isPrimary: e.target.checked }
            }))}
            className="w-4 h-4 text-beveren-600 bg-gray-100 border-gray-300 rounded focus:ring-beveren-500 dark:focus:ring-beveren-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Is Primary Address
          </span>
        </label>
      </div>
    </div>

    <div className="flex justify-end mt-4">
      <button
        type="submit"
        disabled={isSubmitting}
        className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
          isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin">↻</span>
            <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
          </>
        ) : (
          <>
            <Save size={18} />
            <span>{isEditing ? 'Update Customer' : 'Save Customer'}</span>
          </>
        )}
      </button>
    </div>
  </div>
) : null}


          {/* Error Display */}
          {submitError && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {submitError}
            </div>
          )}

          {/* Cancel Button - Always visible */}
          <div className="flex justify-start pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-red-500 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
                