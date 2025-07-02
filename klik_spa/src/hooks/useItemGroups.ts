import { useEffect, useState } from "react";

interface ItemGroup {
  id: string;
  name: string;
  parent?: string;
  icon?: string;
  count?: number;
}

interface UseItemGroupsReturn {
  itemGroups: ItemGroup[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  count: number;
}

export function useItemGroups(): UseItemGroupsReturn {
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchItemGroups = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/method/klik_pos.api.item.get_item_groups_for_pos`);
      const resData = await response.json();

      // ✅ No `.data`, directly use resData.message
      if (resData?.message && Array.isArray(resData.message)) {
        setItemGroups(resData.message);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error fetching item groups:", error);
      setErrorMessage(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItemGroups();
  }, []);

  return {
    itemGroups,
    isLoading,
    error: errorMessage,
    refetch: fetchItemGroups,
    count: itemGroups.length,
  };
}
