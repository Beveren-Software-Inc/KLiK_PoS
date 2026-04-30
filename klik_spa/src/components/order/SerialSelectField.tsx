"use client";

import { useState } from "react";

interface SerialSelectFieldProps {
  itemId: string;
  itemCode: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  isMobile?: boolean;
}

export const SerialSelectField = ({
  options,
  value,
  onChange,
  isMobile,
}: SerialSelectFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter((sn) =>
    sn.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (sn: string) => {
    onChange(sn);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${isMobile ? "text-xs" : "text-xs"} px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-left flex items-center justify-between`}
      >
        <span className="truncate">{value || "Select Serial"}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-44 overflow-hidden">
          <div className="p-1 border-b border-gray-200 dark:border-gray-600">
            <input
              type="text"
              placeholder="Filter serial..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
          <div className="max-h-36 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((sn) => (
                <button
                  key={sn}
                  type="button"
                  onClick={() => handleSelect(sn)}
                  className={`w-full px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${value === sn ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400" : "text-gray-900 dark:text-white"}`}
                >
                  {sn}
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                No matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};