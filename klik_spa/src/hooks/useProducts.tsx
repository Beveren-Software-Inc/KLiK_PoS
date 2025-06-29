
import { useFrappeGetDocList } from "frappe-react-sdk";
import type { MenuItem } from "../../types";
import { useEffect, useState } from "react";

interface UseProductsReturn {
  products: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  count: number;
}

interface Item {
  name: string;
  item_name?: string;
  description?: string;
  standard_rate?: number | string;
  item_group?: string;
  image?: string;
  actual_qty?: number;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    const warehouse = "Production RM AMC3 - AMCC";
    const priceList = "Standard Selling";

    try {
      const response = await fetch(
        `/api/method/klik_pos.api.item.get_items_with_balance_and_price?warehouse=${encodeURIComponent(warehouse)}&price_list=${encodeURIComponent(priceList)}`
      );
      const resData = await response.json();

      if (resData?.message && Array.isArray(resData.message)) {
        setProducts(resData.message);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error fetching products:", error);
      setErrorMessage(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  return {
    products,
    isLoading,
    error: errorMessage,
    refetch: fetchItems,
    count: products.length,
  };
}