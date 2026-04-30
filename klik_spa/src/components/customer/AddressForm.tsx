import React from "react";
import { MapPin } from "lucide-react";
import countryList from "react-select-country-list";

interface AddressFormProps {
  customerType: "individual" | "company";
  formData: {
    addressType: string;
    street: string;
    buildingNumber: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  errors: Record<string, string>;
  isZatcaEnabled?: boolean;
  onChange: (field: string, value: string) => void;
}

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
  { value: "Other", label: "Other" },
];

export const AddressForm: React.FC<AddressFormProps> = ({
  customerType,
  formData,
  errors,
  isZatcaEnabled,
  onChange,
}) => {
  const countryOptions = countryList().getData();
  const isRequired = customerType === "company" && isZatcaEnabled;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <MapPin size={20} className="mr-2" />
        Address{customerType === "company" ? "" : " (Optional)"}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Address Type
          </label>
          <select
            value={formData.addressType}
            onChange={(e) => onChange("addressType", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
          >
            {addressTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Street Address {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) => onChange("street", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.street ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Enter street address"
            />
            {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Building Number (4 digits) {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.buildingNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 4) onChange("buildingNumber", value);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.buildingNumber ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="1234"
              maxLength={4}
            />
            {errors.buildingNumber && <p className="text-red-500 text-xs mt-1">{errors.buildingNumber}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              City {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => onChange("city", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.city ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Enter city"
            />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              State/Province {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => onChange("state", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.state ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Enter state/province"
            />
            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zip Code {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={formData.zipCode}
              onChange={(e) => onChange("zipCode", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
                errors.zipCode ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Enter zip code"
            />
            {errors.zipCode && <p className="text-red-500 text-xs mt-1">{errors.zipCode}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Country
            </label>
            <input
              list="country-list"
              value={formData.country}
              onChange={(e) => onChange("country", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white"
              placeholder="Select country"
            />
            <datalist id="country-list">
              {countryOptions.map((country) => (
                <option key={country.value} value={country.label} />
              ))}
            </datalist>
          </div>
        </div>
      </div>
    </div>
  );
};