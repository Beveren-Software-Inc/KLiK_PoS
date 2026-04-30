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
export async function getItemPriceForCustomer(itemCode: string, customerId?: string, uom?: string): Promise<PriceInfo> {
  try {
    const customerParam = customerId ? `&customer=${customerId}` : '';
    const uomParam = uom ? `&uom=${encodeURIComponent(uom)}` : '';
    const response = await fetch(`/api/method/klik_pos.api.item.item_price.get_item_price_for_customer?item_code=${itemCode}${customerParam}${uomParam}`, {
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
export async function updateItemPricesForCustomer(items: Array<{id: string, item_code?: string, uom?: string}>, customerId?: string): Promise<Record<string, PriceInfo>> {
  const priceUpdates: Record<string, PriceInfo> = {};

  // Process items in parallel for better performance
  const promises = items.map(async (item) => {
    const itemCode = item.item_code || item.id;
    // Pass the item's UOM to ensure we get the price for the correct UOM
    const priceInfo = await getItemPriceForCustomer(itemCode, customerId, item.uom);
    priceUpdates[item.id] = priceInfo;
  });

  await Promise.all(promises);
  return priceUpdates;
}

/**
 * Apply pricing rules to cart items
 * This uses ERPNext's pricing rules to get discounted prices
 */
export interface PricingRuleResult {
  id: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  discount_amount?: number;
  pricing_rules?: string;
  has_pricing_rule?: number;
  free_item_data?: Array<any>;
  [key: string]: any; // Allow other item properties
}

export async function applyPricingRulesToCart(
  cartItems: Array<{id: string, item_code?: string, quantity: number, price: number, uom?: string, [key: string]: any}>,
  customerId?: string
): Promise<PricingRuleResult[]> {
  try {
    const customerParam = customerId ? `&customer=${customerId}` : '';
    const response = await fetch(`/api/method/klik_pos.api.item.pricing_rules.apply_pricing_rules_to_cart?cart_items=${encodeURIComponent(JSON.stringify(cartItems))}${customerParam}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.message || cartItems; // Return original items if API fails
  } catch (error) {
    console.error('Error applying pricing rules to cart:', error);
    // Return original items if pricing rule application fails
    return cartItems;
  }
}
