export interface PriceInfo {
  success: boolean;
  price: number;
  currency: string;
  currency_symbol: string;
  error?: string;
}

/**
 * Get item price for a specific customer
 */
export async function getItemPriceForCustomer(itemCode: string, customerId?: string): Promise<PriceInfo> {
  try {
    const customerParam = customerId ? `&customer=${customerId}` : '';
    const response = await fetch(`/api/method/klik_pos.api.item.get_item_price_for_customer?item_code=${itemCode}${customerParam}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.message || result;
  } catch (error) {
    console.error('Error fetching item price for customer:', error);
    return {
      success: false,
      price: 0,
      currency: 'SAR',
      currency_symbol: 'SAR',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update prices for multiple items based on customer
 */
export async function updateItemPricesForCustomer(items: Array<{id: string, item_code?: string}>, customerId?: string): Promise<Record<string, PriceInfo>> {
  const priceUpdates: Record<string, PriceInfo> = {};

  // Process items in parallel for better performance
  const promises = items.map(async (item) => {
    const itemCode = item.item_code || item.id;
    const priceInfo = await getItemPriceForCustomer(itemCode, customerId);
    priceUpdates[item.id] = priceInfo;
  });

  await Promise.all(promises);
  return priceUpdates;
}
