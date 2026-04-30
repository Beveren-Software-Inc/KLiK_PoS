"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, X, Loader2 } from "lucide-react";

interface AutoCompleteOption {
  label: string;
  value: string;
  extra?: any;
  description?: string;
  avatar?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface AutoCompleteProps {
  options: AutoCompleteOption[];
  value: string;
  onChange: (val: string, extra?: any, option?: AutoCompleteOption) => void;
  onSearch?: (searchTerm: string) => Promise<AutoCompleteOption[]> | AutoCompleteOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  clearable?: boolean;
  showAvatar?: boolean;
  searchFields?: string[];
  minSearchLength?: number;
  debounceDelay?: number;
  renderOption?: (option: AutoCompleteOption, isSelected: boolean) => React.ReactNode;
  onClear?: () => void;
  onBlur?: () => void;
}

export const AutoComplete = ({
  options: externalOptions,
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  disabled = false,
  className = "",
  loading: externalLoading = false,
  clearable = true,
  showAvatar = false,
  searchFields = ["label", "description", "extra"],
  minSearchLength = 1,
  debounceDelay = 300,
  renderOption,
  onClear,
  onBlur,
}: AutoCompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [internalOptions, setInternalOptions] = useState<AutoCompleteOption[]>(externalOptions);
  const [internalLoading, setInternalLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">("bottom");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevOptionsRef = useRef<AutoCompleteOption[]>(externalOptions);
  const isSelectingRef = useRef(false);
  const selectedValueRef = useRef(value);

  useEffect(() => {
    selectedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (JSON.stringify(prevOptionsRef.current) !== JSON.stringify(externalOptions)) {
      prevOptionsRef.current = externalOptions;
      setInternalOptions(externalOptions);
    }
  }, [externalOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setIsOpen(false);
          setSearch("");
          setHighlightedIndex(-1);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current && !isSelectingRef.current) {
      inputRef.current.focus();
      calculateDropdownPosition();
    }
  }, [isOpen]);

  const calculateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 320 && spaceAbove > spaceBelow) {
      setDropdownPosition("top");
    } else {
      setDropdownPosition("bottom");
    }
  };

  const handleSearch = useCallback(async (searchTerm: string) => {
    if (!onSearch) return;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setInternalLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(searchTerm);
        if (!isSelectingRef.current) {
          setInternalOptions(results);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setInternalLoading(false);
      }
    }, debounceDelay);
  }, [onSearch, debounceDelay]);

  useEffect(() => {
    if (isOpen && onSearch && search.length >= minSearchLength && !isSelectingRef.current) {
      handleSearch(search);
    } else if (search.length === 0 && !onSearch && !isSelectingRef.current) {
      setInternalOptions(externalOptions);
    }
  }, [search, isOpen, onSearch, minSearchLength, handleSearch, externalOptions]);

  const filterOptions = useCallback((searchTerm: string): AutoCompleteOption[] => {
    if (!searchTerm) return internalOptions;
    
    const lowerSearch = searchTerm.toLowerCase();
    return internalOptions.filter((opt) => {
      return searchFields.some((field) => {
        const val = opt[field as keyof AutoCompleteOption];
        if (typeof val === "string") {
          return val.toLowerCase().includes(lowerSearch);
        }
        if (field === "metadata" && opt.metadata) {
          return Object.values(opt.metadata).some((v) =>
            String(v).toLowerCase().includes(lowerSearch)
          );
        }
        return false;
      });
    });
  }, [internalOptions, searchFields]);

  const filteredOptions = onSearch ? internalOptions : filterOptions(search);

  const handleSelect = useCallback((opt: AutoCompleteOption) => {
    
    isSelectingRef.current = true;
    onChange(opt.value, opt.extra, opt);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
    
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 200);
  }, [onChange, value]);

  const handleClear = useCallback(() => {
    isSelectingRef.current = true;
    onChange("", undefined, undefined);
    setSearch("");
    if (onClear) onClear();
    setIsOpen(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 200);
  }, [onChange, onClear, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex, handleSelect]);

  const handleContainerBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node) && !isSelectingRef.current) {
      onBlur?.();
    }
  };

  const defaultRenderOption = useCallback((opt: AutoCompleteOption, isSelected: boolean) => (
    <div className="flex items-center gap-3">
      {showAvatar && opt.avatar && (
        <img src={opt.avatar} alt={opt.label} className="w-8 h-8 rounded-full object-cover" />
      )}
      {showAvatar && !opt.avatar && opt.icon && (
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          {opt.icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {opt.label}
        </div>
        {opt.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {opt.description}
          </div>
        )}
        {opt.extra && typeof opt.extra === "string" && (
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
            {opt.extra}
          </div>
        )}
      </div>
      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
    </div>
  ), [showAvatar]);

  const isLoading = externalLoading || internalLoading;

  const getSelectedOption = () => {
    if (!value) return null;
    return [...externalOptions, ...internalOptions].find((opt) => opt.value === value);
  };

  const selectedOption = getSelectedOption();

  const dropdown = isOpen && !disabled ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPosition === "bottom" && buttonRef.current
          ? buttonRef.current.getBoundingClientRect().bottom + 6
          : undefined,
        bottom: dropdownPosition === "top" && buttonRef.current
          ? window.innerHeight - buttonRef.current.getBoundingClientRect().top + 6
          : undefined,
        left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 0,
        width: buttonRef.current ? buttonRef.current.getBoundingClientRect().width : 300,
        zIndex: 999999,
      }}
      className={`
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-800
        rounded-xl shadow-2xl
        overflow-hidden
        animate-in fade-in duration-200
      `}
    >
      <div className="p-2 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type to search..."
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
            <div className="text-sm text-gray-400">Searching...</div>
          </div>
        ) : filteredOptions.length > 0 ? (
          filteredOptions.map((opt, idx) => (
            <div
              key={`${opt.value}-${idx}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(opt);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(opt);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`
                px-3 py-2 cursor-pointer text-sm transition-colors
                hover:bg-gray-100 dark:hover:bg-gray-800
                ${highlightedIndex === idx ? "bg-gray-100 dark:bg-gray-800" : ""}
                ${opt.value === value ? "bg-blue-50 dark:bg-blue-900/20" : ""}
              `}
            >
              {renderOption
                ? renderOption(opt, opt.value === value)
                : defaultRenderOption(opt, opt.value === value)}
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <div className="text-sm text-gray-400">No results found</div>
            <div className="text-xs text-gray-500 mt-1">Try searching with different terms</div>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} onBlur={handleContainerBlur} className={`relative w-full ${className}`}>
      <div
        ref={buttonRef}
        onClick={() => {
          if (!disabled && !isSelectingRef.current) {
            setIsOpen(!isOpen);
          }
        }}
        className={`
          flex items-center justify-between w-full h-11 px-4 gap-2
          border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer 
          bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700 transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : ""}
        `}
      >
        <span className={`flex-1 truncate text-sm ${selectedOption ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {clearable && selectedOption && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
};