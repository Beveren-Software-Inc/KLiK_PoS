"use client";

import { useState, useEffect, useCallback } from "react";
import type { CartItem } from "../../../types";

interface UOMSelectFieldProps {
  item: CartItem;
  onUOMChange: (itemId: string, selectedUOM: string, newPrice: number) => void;
  isMobile?: boolean;
  selectedCustomer?: { id: string } | null;
}

interface UOMDataRow {
  uom: string;
  conversion_factor: number;
  price: number;
}

interface UOMPriceResponse {
  base_uom?: string;
  uoms?: UOMDataRow[];
}

export const UOMSelectField = ({
  item,
  onUOMChange,
  isMobile,
  selectedCustomer,
}: UOMSelectFieldProps) => {
  const [availableUOMs, setAvailableUOMs] = useState<string[]>(
    item.uom ? [item.uom] : []
  );
  const [defaultUOM, setDefaultUOM] = useState<string>(item.uom || "");
  const [selectedUOM, setSelectedUOM] = useState<string>(item.uom || "");
  const [uomPrices, setUOMPrices] = useState<Record<string, number>>({});
  const [uomConversionFactors, setUOMConversionFactors] = useState<
    Record<string, number>
  >({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const fetchUOMs = useCallback(async (itemCode: string) => {
    try {
      const customerParam = selectedCustomer?.id
        ? `&customer=${encodeURIComponent(selectedCustomer.id)}`
        : "";

      const response = await fetch(
        `/api/method/klik_pos.api.item.item_details.get_item_uoms_and_prices?item_code=${encodeURIComponent(itemCode)}${customerParam}&_=${Date.now()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data?.message) {
          const uomData = data.message as UOMPriceResponse;
          const rows = Array.isArray(uomData.uoms) ? uomData.uoms : [];
          const uoms = rows
            .map((row) => row.uom)
            .filter((uom): uom is string => Boolean(uom));

          const uniqueUOMs = Array.from(new Set(uoms));

          const prices: Record<string, number> = {};
          const factors: Record<string, number> = {};

          for (const row of rows) {
            if (!row.uom) continue;
            prices[row.uom] = Number(row.price) || 0;
            factors[row.uom] = Number(row.conversion_factor) || 1;
          }

          if (uomData.base_uom && !factors[uomData.base_uom]) {
            factors[uomData.base_uom] = 1;
          }

          if (uomData.base_uom) {
            setDefaultUOM(uomData.base_uom);
          } else if (item.uom) {
            setDefaultUOM(item.uom);
          }

          setUOMPrices(prices);
          setUOMConversionFactors(factors);

          if (uniqueUOMs.length > 0) {
            setAvailableUOMs(uniqueUOMs);
            return;
          }
        }
      }

      if (item.uom) {
        setDefaultUOM(item.uom);
        setAvailableUOMs([item.uom]);
        setUOMPrices({ [item.uom]: item.price });
        setUOMConversionFactors({ [item.uom]: 1 });
      } else {
        setDefaultUOM("");
        setAvailableUOMs([]);
        setUOMPrices({});
        setUOMConversionFactors({});
      }
    } catch (error) {
      console.error("Error loading item-specific UOMs:", error);
      if (item.uom) {
        setDefaultUOM(item.uom);
        setAvailableUOMs([item.uom]);
        setUOMPrices({ [item.uom]: item.price });
        setUOMConversionFactors({ [item.uom]: 1 });
      } else {
        setDefaultUOM("");
        setAvailableUOMs([]);
        setUOMPrices({});
        setUOMConversionFactors({});
      }
    }
  }, [item.price, item.uom, selectedCustomer?.id]);

  useEffect(() => {
    const loadItemSpecificUOMs = async () => {
      const itemCode = item.item_code || item.id;
      if (itemCode) {
        await fetchUOMs(itemCode);
      } else {
        if (item.uom) {
          setDefaultUOM(item.uom);
          setAvailableUOMs([item.uom]);
          setUOMPrices({ [item.uom]: item.price });
          setUOMConversionFactors({ [item.uom]: 1 });
        } else {
          setDefaultUOM("");
          setAvailableUOMs([]);
          setUOMPrices({});
          setUOMConversionFactors({});
        }
      }
    };

    loadItemSpecificUOMs();
  }, [item.id, item.item_code, item.price, item.uom, fetchUOMs]);

  useEffect(() => {
    setSelectedUOM(item.uom || availableUOMs[0] || "");
  }, [item.uom, availableUOMs]);

  const filteredUOMs = availableUOMs.filter((uom) =>
    uom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatConversionFactor = (value: number) =>
    new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(value);

  const handleUOMSelect = (newUOM: string) => {
    const directUOMPrice = uomPrices[newUOM];
    const currentFactor = uomConversionFactors[selectedUOM] || 1;
    const targetFactor = uomConversionFactors[newUOM] || 1;
    const stockUOMPrice = currentFactor > 0 ? item.price / currentFactor : item.price;
    const fallbackConvertedPrice = stockUOMPrice * targetFactor;
    const newPrice =
      typeof directUOMPrice === "number" && directUOMPrice > 0
        ? directUOMPrice
        : fallbackConvertedPrice;

    setSelectedUOM(newUOM);
    setIsDropdownOpen(false);
    setSearchQuery("");
    onUOMChange(item.id, newUOM, Number(newPrice.toFixed(6)));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={`w-full ${
          isMobile ? "text-sm" : "text-sm"
        } px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-left flex items-center justify-between`}
      >
        <span>{selectedUOM || "Select UOM"}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
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

      {selectedUOM && defaultUOM && selectedUOM !== defaultUOM && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2">
            <label className="text-gray-600 dark:text-gray-400 font-medium text-xs">
              Conversion Factor:
            </label>
            <div className="px-2 py-1 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 text-gray-900 dark:text-white font-mono text-xs">
              {formatConversionFactor(uomConversionFactors[selectedUOM] || 1)}
            </div>
          </div>
        </div>
      )}

      {isDropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 dark:border-gray-600">
            <input
              type="text"
              placeholder="Search UOM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredUOMs.length > 0 ? (
              filteredUOMs.map((uom) => (
                <button
                  key={uom}
                  type="button"
                  onClick={() => handleUOMSelect(uom)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    uom === selectedUOM
                      ? "bg-beveren-50 dark:bg-beveren-900/20 text-beveren-600 dark:text-beveren-400"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {uom}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No UOMs found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};