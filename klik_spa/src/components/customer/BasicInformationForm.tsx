import React from "react";
import { User } from "lucide-react";
import countryList from "react-select-country-list";

interface BasicInformationFormProps {
  customerType: "individual" | "company";
  formData: {
    name: string;
    taxId: string;
    customer_group: string;
    territory: string;
    address: { country: string };
  };
  errors: Record<string, string>;
  loadingGroups: boolean;
  loadingTerritories: boolean;
  customerGroups: Array<{ name: string; customer_group_name: string }>;
  territories: Array<{ name: string; territory_name: string }>;
  isZatcaEnabled?: boolean;
  isTaxIdRequired?: boolean;
  isCustomerGroupRequired?: boolean;
  isTerritoryRequired?: boolean;
  onChange: (field: string, value: any) => void;
}

export const BasicInformationForm: React.FC<BasicInformationFormProps> = ({
  customerType,
  formData,
  errors,
  loadingGroups,
  loadingTerritories,
  customerGroups,
  territories,
  isZatcaEnabled,
  isTaxIdRequired = false,
  isCustomerGroupRequired = false,
  isTerritoryRequired = false,
  onChange,
}) => {
  const countryOptions = countryList().getData();

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <User size={20} className="mr-2" />
        Basic Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Customer Name <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange("name", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.name ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter full name"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {customerType === "company" && isZatcaEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer Country
            </label>
            <input
              list="country-list"
              value={formData.address.country}
              onChange={(e) => onChange("address.country", e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Customer Group
            {isCustomerGroupRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={formData.customer_group}
            onChange={(e) => onChange("customer_group", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
              errors.customer_group ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
            disabled={loadingGroups}
          >
            {loadingGroups ? (
              <option>Loading...</option>
            ) : (
              customerGroups.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.customer_group_name}
                </option>
              ))
            )}
          </select>
          {errors.customer_group && <p className="text-red-500 text-xs mt-1">{errors.customer_group}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Territory
            {isTerritoryRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={formData.territory}
            onChange={(e) => onChange("territory", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:text-white ${
              errors.territory ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
            disabled={loadingTerritories}
          >
            <option value="All Territories">All Territories</option>
            {territories.map((territory) => (
              <option key={territory.name} value={territory.name}>
                {territory.territory_name || territory.name}
              </option>
            ))}
          </select>
          {loadingTerritories && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Loading territories...
            </p>
          )}
          {errors.territory && <p className="text-red-500 text-xs mt-1">{errors.territory}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tax ID
            {isTaxIdRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={formData.taxId}
            onChange={(e) => onChange("taxId", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.taxId ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Enter tax ID"
          />
          {errors.taxId && <p className="text-red-500 text-xs mt-1">{errors.taxId}</p>}
        </div>
      </div>
    </div>
  );
};