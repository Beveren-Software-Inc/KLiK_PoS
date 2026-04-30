import React from "react";
import { Mail } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import countryList from "react-select-country-list";

interface ContactInformationFormProps {
  customerType: "individual" | "company";
  formData: {
    contactName: string;
    email: string;
    phone: string;
    address: { country: string };
  };
  errors: Record<string, string>;
  isEmailRequired?: boolean;
  isPhoneRequired?: boolean;
  onChange: (field: string, value: string) => void;
}

export const ContactInformationForm: React.FC<ContactInformationFormProps> = ({
  customerType,
  formData,
  errors,
  isEmailRequired = false,
  isPhoneRequired = false,
  onChange,
}) => {
  const countryOptions = countryList().getData();
  const isCompany = customerType === "company";

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Mail size={20} className="mr-2" />
        Contact Information
        <span className="text-sm font-normal text-gray-500 ml-2">
          (At least one required)
        </span>
      </h3>
      
      <div className="space-y-4">
        {isCompany && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Name <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.contactName}
              onChange={(e) => onChange("contactName", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.contactName ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Enter contact person name"
            />
            {errors.contactName && <p className="text-red-500 text-xs mt-1">{errors.contactName}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
              {isEmailRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => onChange("email", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.email || errors.contact ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="customer@email.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
              {isPhoneRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            <PhoneInput
              international
              defaultCountry={(countryOptions.find(c => c.label === (formData.address.country || ""))?.value as any) || ""}
              value={formData.phone}
              onChange={(value: string | undefined) => onChange("phone", value || "")}
              className={`w-full flex flex-row px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.phone ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
        </div>

        {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
      </div>
    </div>
  );
};