import React from "react";
import { CreditCard } from "lucide-react";
import { type Customer } from "../../types/customer";

interface ZatcaDetailsFormProps {
  formData: {
    preferredPaymentMethod: Customer["preferredPaymentMethod"];
    vatNumber: string;
    registrationScheme: string;
    registrationNumber: string;
  };
  errors: Record<string, string>;
  isVatRequired?: boolean;
  isRegistrationRequired?: boolean;
  onChange: (field: string, value: string) => void;
}

const paymentMethods = [
  { value: "Cash", label: "Cash" },
  { value: "Bank Card", label: "Bank Card" },
  { value: "Bank Payment", label: "Bank Payment" },
  { value: "Credit", label: "Credit" },
];

const registrationSchemes = [
  { value: "Commercial Registration number(CRN)", label: "Commercial Registration number(CRN)" },
  { value: "MOMRAH(MOM)", label: "MOMRAH(MOM)" },
  { value: "MHRSD(MLS)", label: "MHRSD(MLS)" },
  { value: "700(700)", label: "700(700)" },
  { value: "MISA(SAG)", label: "MISA(SAG)" },
  { value: "Other OD(OTH)", label: "Other OD(OTH)" },
];

export const ZatcaDetailsForm: React.FC<ZatcaDetailsFormProps> = ({
  formData,
  errors,
  isVatRequired = false,
  isRegistrationRequired = false,
  onChange,
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <CreditCard size={20} className="mr-2" />
        ZATCA Details
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Method
          </label>
          <select
            value={formData.preferredPaymentMethod}
            onChange={(e) => onChange("preferredPaymentMethod", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
          >
            {paymentMethods.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            VAT Number
            {isVatRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={formData.vatNumber}
            onChange={(e) => onChange("vatNumber", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.vatNumber || errors.vatOrRegistration ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter VAT number"
          />
          {errors.vatNumber && <p className="text-red-500 text-xs mt-1">{errors.vatNumber}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Registration Scheme
          </label>
          <select
            value={formData.registrationScheme}
            onChange={(e) => onChange("registrationScheme", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select Registration Scheme</option>
            {registrationSchemes.map((scheme) => (
              <option key={scheme.value} value={scheme.value}>
                {scheme.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Registration Number
            {isRegistrationRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={formData.registrationNumber}
            onChange={(e) => onChange("registrationNumber", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.registrationNumber || errors.vatOrRegistration ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter registration number"
          />
          {errors.registrationNumber && <p className="text-red-500 text-xs mt-1">{errors.registrationNumber}</p>}
        </div>
      </div>
      
      {errors.vatOrRegistration && (
        <p className="text-red-500 text-xs mt-1">{errors.vatOrRegistration}</p>
      )}
    </div>
  );
};