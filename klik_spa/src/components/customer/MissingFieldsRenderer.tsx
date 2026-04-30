import React, { useState, useEffect } from 'react';
import type { MissingField } from '../../hooks/useCustomers';
import { LinkSelect } from '../ui/LinkSelect';

interface MissingFieldsRendererProps {
  missingFields: MissingField[];
  onFieldChange: (fieldname: string, value: any) => void;
  errors?: Record<string, string>;
}

export const MissingFieldsRenderer: React.FC<MissingFieldsRendererProps> = ({
  missingFields,
  onFieldChange,
  errors = {}
}) => {
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  if (missingFields.length === 0) {
    return null;
  }

  const handleFieldBlur = (fieldname: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldname));
  };

  const showError = (fieldname: string) => {
    return touchedFields.has(fieldname) && errors[fieldname];
  };

  const renderField = (field: MissingField) => {
    const hasError = showError(field.fieldname);
    const commonClasses = `w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-beveren-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
      hasError ? 'border-red-500 border' : 'border border-gray-300 dark:border-gray-600'
    }`;

    switch (field.fieldtype) {
      case 'Check':
        return (
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={field.value || false}
              onChange={(e) => onFieldChange(field.fieldname, e.target.checked)}
              onBlur={() => handleFieldBlur(field.fieldname)}
              className="w-4 h-4 text-beveren-600 border-gray-300 rounded focus:ring-beveren-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {field.label}
            </span>
          </label>
        );

      case 'Select':
        const selectOptions = field.options?.split('\n').filter(opt => opt.trim()) || [];
        return (
          <select
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
          >
            <option value="">Select {field.label}</option>
            {selectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'Link':
        return (
          <LinkSelect
            doctype={field.options || field.fieldname}
            value={field.value || ''}
            onChange={(val, option) => onFieldChange(field.fieldname, val)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            placeholder={`Select ${field.label}`}
            className="w-full"
          />
        );

      case 'Small Text':
      case 'Text':
        return (
          <textarea
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
            rows={4}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'Long Text':
        return (
          <textarea
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
            rows={6}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'Currency':
      case 'Int':
      case 'Float':
        return (
          <input
            type="number"
            step={field.fieldtype === 'Int' ? '1' : '0.01'}
            value={field.value || ''}
            onChange={(e) => {
              const val = field.fieldtype === 'Int' 
                ? parseInt(e.target.value, 10) 
                : parseFloat(e.target.value);
              onFieldChange(field.fieldname, isNaN(val) ? '' : val);
            }}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'Date':
        return (
          <input
            type="date"
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
          />
        );

      case 'Datetime':
        return (
          <input
            type="datetime-local"
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
          />
        );

      default:
        return (
          <input
            type="text"
            value={field.value || ''}
            onChange={(e) => onFieldChange(field.fieldname, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldname)}
            className={commonClasses}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="mr-2">📋</span>
        Additional Required Fields
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {missingFields.map((field) => (
          <div 
            key={field.fieldname} 
            className={
              field.fieldtype === 'Long Text' || field.fieldtype === 'Small Text' 
                ? 'md:col-span-2' 
                : ''
            }
          >
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label}
              <span className="text-red-500 ml-1">*</span>
            </label>
            {renderField(field)}
            {showError(field.fieldname) && (
              <p className="text-red-500 text-xs mt-1">{errors[field.fieldname]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};