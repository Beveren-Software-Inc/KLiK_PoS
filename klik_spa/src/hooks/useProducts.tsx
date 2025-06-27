import { useFrappeGetDocList } from "frappe-react-sdk";
import type { MenuItem } from "../../types";

interface UseProductsReturn {
  products: MenuItem[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  count: number
}

interface Item {
  name: string
  item_name?: string
  description?: string
  standard_rate?: number | string
  item_group?: string
  image?: string
  actual_qty?: number | string
}

export function useProducts(): UseProductsReturn {
  const { 
    data, 
    error, 
    isLoading, 
    mutate 
  } = useFrappeGetDocList<Item>("Item", {
    fields: [
      "name", 
      "item_name", 
      "description", 
     
      "item_group", 
  
    ],
    filters: [["disabled", "=", 0]],
    limit: 100,
    orderBy: {
      field: "modified",
      order: "desc",
    },
  });

 
  // Handle different data formats from Frappe API
  let itemsArray: Item[] = [];
  
  if (data) {
    if (Array.isArray(data)) {    
      itemsArray = data;
    } else {
      console.warn("⚠️ Unexpected data format:", data);
      itemsArray = [];
    }
  }

  const products = itemsArray.map((item): MenuItem => ({
    id: item.name,
    name: item.item_name || item.name,
    description: item.description || '',
    price: 200,
    category: item.item_group || 'General',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop',
    available: 100,
    sold: 0,
    preparationTime: 10
  }));

  // Handle error properly - convert to string
  let errorMessage: string | null = null;
  if (error) {
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = error._error_message || error.message || JSON.stringify(error);
    } else {
      errorMessage = 'An unknown error occurred';
    }
  }

  return {
    products,
    isLoading,
    error: errorMessage,
    refetch: mutate,
    count: products.length,
  };
}