import { useState, useCallback } from 'react';
import { getItemUOMsAndPrices, getAllUOMs } from '../services/uomService';

interface UOMData {
  uom: string;
  conversion_factor: number;
  price: number;
}

interface UOMsAndPrices {
  base_uom: string;
  uoms: UOMData[];
}

export function useUOMs() {
  const [loadingUOMs, setLoadingUOMs] = useState(false);

  const getUOMsAndPrices = useCallback(async (itemCode: string): Promise<UOMsAndPrices> => {
    if (!itemCode) {
      return { base_uom: 'Nos', uoms: [{ uom: 'Nos', conversion_factor: 1.0, price: 0.0 }] };
    }

    setLoadingUOMs(true);
    try {
      const data = await getItemUOMsAndPrices(itemCode);
      return data || { base_uom: 'Nos', uoms: [{ uom: 'Nos', conversion_factor: 1.0, price: 0.0 }] };
    } catch (error) {
      console.error('Error fetching UOMs and prices:', error);
      return { base_uom: 'Nos', uoms: [{ uom: 'Nos', conversion_factor: 1.0, price: 0.0 }] };
    } finally {
      setLoadingUOMs(false);
    }
  }, []);

  const getAllAvailableUOMs = useCallback(async (): Promise<string[]> => {
    try {
      return await getAllUOMs();
    } catch (error) {
      console.error('Error fetching all UOMs:', error);
      return ['Nos', 'Box', 'Kilogram', 'Liter', 'Meter', 'Dozen']; // Fallback
    }
  }, []);

  return {
    getUOMsAndPrices,
    loadingUOMs,
    getAllAvailableUOMs
  };
}
