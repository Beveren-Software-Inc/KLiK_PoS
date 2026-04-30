"use client";

import { AutoComplete } from "./AutoComplete";

interface LinkSelectProps {
  doctype: string;
  value: string;
  onChange: (val: string, option?: any) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export const LinkSelect = ({ 
  doctype, 
  value, 
  onChange, 
  onBlur,
  placeholder, 
  className 
}: LinkSelectProps) => {
  
  const fetchOptions = async (searchTerm: string) => {
    const params = new URLSearchParams({
      doctype: doctype,
      txt: searchTerm
    });
    
    const response = await fetch(`/api/method/klik_pos.api.links.get_link_options?${params}`);
    const data = await response.json();
    return data.message || [];
  };

  return (
    <AutoComplete
      options={[]}
      value={value}
      onChange={(val, extra, option) => onChange(val, option)}
      onSearch={fetchOptions}
      placeholder={placeholder || `Search ${doctype}...`}
      className={className}
      onBlur={onBlur}
      minSearchLength={0}
      renderOption={(opt) => (
        <div className="flex flex-col">
           <span className="font-bold">{opt.label}</span>
           <span className="text-xs text-gray-500">{opt.value}</span>
        </div>
      )}
    />
  );
};