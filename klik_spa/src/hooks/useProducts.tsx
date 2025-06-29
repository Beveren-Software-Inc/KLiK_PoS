// import { useFrappeGetDocList } from "frappe-react-sdk";
// import type { MenuItem } from "../../types";

// interface UseProductsReturn {
//   products: MenuItem[]
//   isLoading: boolean
//   error: string | null
//   refetch: () => void
//   count: number
// }

// interface Item {
//   name: string
//   item_name?: string
//   description?: string
//   standard_rate?: number | string
//   item_group?: string
//   image?: string
//   actual_qty?: number | string
// }

// export function useProducts(): UseProductsReturn {
//   const { 
//     data, 
//     error, 
//     isLoading, 
//     mutate 
//   } = useFrappeGetDocList<Item>("Item", {
//     fields: [
//       "name", 
//       "item_name", 
//       "description", 
     
//       "item_group", 
  
//     ],
//     filters: [["disabled", "=", 0]],
//     limit: 100,
//     orderBy: {
//       field: "modified",
//       order: "desc",
//     },
//   });

 
//   // Handle different data formats from Frappe API
//   let itemsArray: Item[] = [];
  
//   if (data) {
//     if (Array.isArray(data)) {    
//       itemsArray = data;
//     } else {
//       console.warn("⚠️ Unexpected data format:", data);
//       itemsArray = [];
//     }
//   }

//   const products = itemsArray.map((item): MenuItem => ({
//     id: item.name,
//     name: item.item_name || item.name,
//     description: item.description || '',
//     price: 200,
//     category: item.item_group || 'General',
//     image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop',
//     available: 100,
//     sold: 0,
//     preparationTime: 10
//   }));

//   // Handle error properly - convert to string
//   let errorMessage: string | null = null;
//   if (error) {
//     if (typeof error === 'string') {
//       errorMessage = error;
//     } else if (error instanceof Error) {
//       errorMessage = error.message;
//     } else if (typeof error === 'object' && error !== null) {
//       errorMessage = error._error_message || error.message || JSON.stringify(error);
//     } else {
//       errorMessage = 'An unknown error occurred';
//     }
//   }

//   return {
//     products,
//     isLoading,
//     error: errorMessage,
//     refetch: mutate,
//     count: products.length,
//   };
// }
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

const {
  data,
  error,
  isLoading,
  mutate,
} = useFrappeGetDocList<Item>("Item", {
  fields: ["name", "item_name", "description", "item_group"],
  filters: [
    ["disabled", "=", 0],
    ["is_stock_item", "=", 1]
  ],
  limit: 100,
  orderBy: {
    field: "modified",
    order: "desc",
  },
});

useEffect(() => {
  async function fetchItemData(items: Item[]) {
    const warehouse = "Production RM AMC3 - AMCC"; // make dynamic later
    const price_list = "Standard Selling"; // default price list

    const results: MenuItem[] = await Promise.all(
      items.map(async (item) => {
        let balance = 0;
        let price = 0;

        try {
          // Fetch item balance
          const balanceResponse = await fetch(
            `/api/method/klik_pos.api.item.get_item_balance?item_code=${item.name}&warehouse=${encodeURIComponent(warehouse)}`
          );
          const balanceData = await balanceResponse.json();
          balance = balanceData?.message?.balance ?? 0;
        } catch (err) {
          console.warn(`Failed to fetch balance for ${item.name}`, err);
        }

        try {
          // Fetch item price
          const priceResponse = await fetch(
            `/api/method/klik_pos.api.item.get_item_price?item_code=${item.name}&price_list=${encodeURIComponent(price_list)}`
          );
          const priceData = await priceResponse.json();
          price = priceData?.message?.price ?? 0;
        } catch (err) {
          console.warn(`Failed to fetch price for ${item.name}`, err);
        }

        return {
          id: item.name,
          name: item.item_name || item.name,
          description: item.description || "",
          price: price,
          category: item.item_group || "General",
          image:
            "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop",
          available: balance,
          sold: 0,
          preparationTime: 10,
        };
      })
    );

    setProducts(results);
  }

  if (data && Array.isArray(data)) {
    fetchItemData(data);
  }
}, [data]);


  useEffect(() => {
    if (error) {
      if (typeof error === "string") {
        setErrorMessage(error);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else if (typeof error === "object" && error !== null) {
        setErrorMessage(
          (error as any)._error_message ||
            (error as any).message ||
            JSON.stringify(error)
        );
      } else {
        setErrorMessage("An unknown error occurred");
      }
    }
  }, [error]);

  return {
    products,
    isLoading,
    error: errorMessage,
    refetch: mutate,
    count: products.length,
  };
}
