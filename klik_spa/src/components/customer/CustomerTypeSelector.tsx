import React from "react";

interface CustomerTypeOption {
  value: "individual" | "company";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
}

interface CustomerTypeSelectorProps {
  customerType: "individual" | "company";
  onChange: (type: "individual" | "company") => void;
  availableTypes: CustomerTypeOption[];
}

export const CustomerTypeSelector: React.FC<CustomerTypeSelectorProps> = ({
  customerType,
  onChange,
  availableTypes,
}) => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Customer Type
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <label
              key={type.value}
              className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${
                customerType === type.value
                  ? "border-beveren-500 bg-beveren-50 dark:bg-beveren-900/20"
                  : "border-gray-200 dark:border-gray-600"
              }`}
            >
              <input
                type="radio"
                name="customerType"
                value={type.value}
                checked={customerType === type.value}
                onChange={() => onChange(type.value)}
                className="sr-only"
              />
              <IconComponent
                size={24}
                className={`mb-2 ${
                  customerType === type.value
                    ? "text-beveren-600"
                    : "text-gray-400"
                }`}
              />
              <span
                className={`font-medium text-sm ${
                  customerType === type.value
                    ? "text-beveren-900 dark:text-beveren-100"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {type.label}
              </span>
              <span
                className={`text-xs text-center mt-1 ${
                  customerType === type.value
                    ? "text-beveren-700 dark:text-beveren-300"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {type.desc}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};