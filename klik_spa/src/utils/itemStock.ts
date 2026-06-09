type StockAwareItem = {
  is_stock_item?: boolean | number | null;
  available?: number | null;
};

/** Non-stock / service items (Maintain Stock unchecked on Item). */
export function isServiceItem(item: StockAwareItem): boolean {
  const value = item.is_stock_item;
  return value === false || value === 0;
}

/** Stock-tracked items that cannot be sold when quantity is zero or less. */
export function isItemOutOfStock(item: StockAwareItem): boolean {
  if (isServiceItem(item)) {
    return false;
  }

  if (item.available == null) {
    return false;
  }

  return item.available <= 0;
}
