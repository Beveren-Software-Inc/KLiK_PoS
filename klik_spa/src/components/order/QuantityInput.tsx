"use client";

import { useState, useEffect } from "react";
import type { CartItem } from "../../../types";

interface QuantityInputProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  isMobile?: boolean;
}

export const QuantityInput = ({
  item,
  onUpdateQuantity,
  isMobile,
}: QuantityInputProps) => {
  const [inputValue, setInputValue] = useState(item.quantity.toString());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(item.quantity.toString());
    }
  }, [item.quantity, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const numValue = Number(inputValue);

    if (isNaN(numValue) || numValue <= 0) {
      setInputValue(item.quantity.toString());
      if (numValue <= 0) {
        onUpdateQuantity(item.id, 0);
      }
    } else {
      setInputValue(numValue.toString());
      onUpdateQuantity(item.id, numValue);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`w-full ${
        isMobile ? "text-sm" : "text-sm"
      } px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
    />
  );
};