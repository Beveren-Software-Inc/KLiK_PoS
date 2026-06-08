"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { MenuItem, VariantAttributeOption } from "../../types";
import { formatCurrencyWithSymbol } from "../utils/currency";

interface VariantPickerResponse {
  template: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    image?: string;
    variant_based_on?: string;
  };
  attributes: VariantAttributeOption[];
  variants: MenuItem[];
}

interface VariantPickerModalProps {
  item: MenuItem;
  customerId?: string;
  onClose: () => void;
  onSelectVariant: (variant: MenuItem) => Promise<void> | void;
}

export default function VariantPickerModal({
  item,
  customerId,
  onClose,
  onSelectVariant,
}: VariantPickerModalProps) {
  const [data, setData] = useState<VariantPickerResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVariants = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ template_item_code: item.id });
        if (customerId) {
          params.set("customer", customerId);
        }
        const response = await fetch(
          `/api/method/klik_pos.api.item.item_variants.get_template_variants?${params.toString()}`,
        );
        const payload = await response.json();
        if (!response.ok || !payload?.message) {
          throw new Error(payload?._server_messages || "Failed to load variants");
        }
        setData(payload.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load variants");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchVariants();
  }, [customerId, item.id]);

  const matchingVariants = useMemo(() => {
    const variants = data?.variants ?? [];
    const activeSelections = Object.entries(selected).filter(([, value]) => value);

    return variants.filter((variant) =>
      activeSelections.every(
        ([attribute, value]) => variant.variant_attributes?.[attribute] === value,
      ),
    );
  }, [data?.variants, selected]);

  useEffect(() => {
    if (matchingVariants.length === 1) {
      setSelectedVariantId(matchingVariants[0].id);
      return;
    }

    if (selectedVariantId && !matchingVariants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(null);
    }
  }, [matchingVariants, selectedVariantId]);

  const selectedVariant =
    matchingVariants.find((variant) => variant.id === selectedVariantId) ??
    (matchingVariants.length === 1 ? matchingVariants[0] : null);

  const isOutOfStock =
    selectedVariant?.is_stock_item !== false && (selectedVariant?.available ?? 0) <= 0;

  const handleSelect = (attribute: string, value: string) => {
    setSelected((current) => ({
      ...current,
      [attribute]: current[attribute] === value ? "" : value,
    }));
  };

  const handleAdd = async () => {
    if (!selectedVariant || isOutOfStock) return;

    setIsAdding(true);
    try {
      await onSelectVariant(selectedVariant);
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Choose Variant
            </p>
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
              {item.name}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select the exact item variant to add to the cart.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Close variant picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-beveren-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          ) : !data?.variants.length ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              No active sales variants were found for this template.
            </div>
          ) : (
            <div className="space-y-5">
              {data.attributes.map((group) => (
                <div key={group.attribute}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {group.attribute}
                    </h3>
                    {selected[group.attribute] && (
                      <button
                        type="button"
                        onClick={() => handleSelect(group.attribute, selected[group.attribute])}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((option) => {
                      const active = selected[group.attribute] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelect(group.attribute, option.value)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            active
                              ? "border-beveren-600 bg-beveren-600 text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:border-beveren-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Matching Variants
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {matchingVariants.length} shown
                  </span>
                </div>

                <div className="grid gap-2">
                  {matchingVariants.map((variant) => {
                    const active = selectedVariant?.id === variant.id;
                    const disabled = variant.is_stock_item !== false && variant.available <= 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => !disabled && setSelectedVariantId(variant.id)}
                        disabled={disabled}
                        className={`flex items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-beveren-600 bg-beveren-50 dark:bg-beveren-900/20"
                            : "border-gray-200 bg-white hover:border-beveren-300 dark:border-gray-700 dark:bg-gray-900/40"
                        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {variant.name}
                          </p>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {variant.id}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {Object.entries(variant.variant_attributes ?? {})
                              .map(([attr, value]) => `${attr}: ${value}`)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-beveren-600 dark:text-beveren-400">
                            {formatCurrencyWithSymbol(variant.price, variant.currency_symbol)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {variant.is_stock_item === false
                              ? "Service"
                              : disabled
                              ? "Out"
                              : `${variant.available} available`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedVariant || isOutOfStock || isAdding}
            className="rounded-md bg-beveren-600 px-4 py-2 text-sm font-semibold text-white hover:bg-beveren-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add Variant"}
          </button>
        </div>
      </div>
    </div>
  );
}
