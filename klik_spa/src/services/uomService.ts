interface UOMData {
  uom: string;
  conversion_factor: number;
  price: number;
}

interface UOMsAndPrices {
  base_uom: string;
  uoms: UOMData[];
}

export async function getItemUOMsAndPrices(itemCode: string): Promise<UOMsAndPrices> {
  try {
    const response = await fetch(`/api/method/klik_pos.api.item.get_item_uoms_and_prices?item_code=${itemCode}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch UOMs and prices');
    }

    if (data?.message) {
      return data.message;
    }

    throw new Error('No UOM data received');
  } catch (error) {
    console.error(`Error fetching UOMs and prices for ${itemCode}:`, error);

    // Return default fallback
    return {
      base_uom: 'Nos',
      uoms: [{ uom: 'Nos', conversion_factor: 1.0, price: 0.0 }]
    };
  }
}

export async function updateItemUOMAndPrice(
  itemId: string,
  selectedUOM: string,
  newPrice: number
): Promise<void> {
  // This function will be called to update the cart item with new UOM and price
  // The actual implementation depends on how the cart update is handled
  console.log(`Updating item ${itemId} to UOM ${selectedUOM} with price ${newPrice}`);
}
