interface TaxTemplateLike {
  is_inclusive?: boolean;
}

interface PricingItemLike {
  id?: string;
  item_code?: string;
  price?: number;
  total_tax_rate?: number;
  tax_templates?: TaxTemplateLike[];
  item_tax_rate?: string | Record<string, number>;
}

interface SelectedTaxLineLike {
  charge_type?: string;
  rate?: number;
  included_in_print_rate?: boolean;
}

interface SelectedTaxTemplateLike {
  tax_lines?: Array<{
    account_head?: string;
    charge_type?: string;
    rate?: number;
    included_in_print_rate?: boolean;
  }>;
}

interface DiscountDataLike {
  discountPercentage?: number;
  discountAmount?: number;
  customRate?: number;
}

type DiscountMapLike = Record<string, DiscountDataLike | undefined>;

interface RateOptions {
  itemDiscounts?: DiscountMapLike;
  isTaxIncludedInBasicRate?: boolean;
  selectedTaxLineMap?: Map<string, SelectedTaxLineLike>;
  selectedTaxTemplate?: SelectedTaxTemplateLike | null;
}

function parseItemTaxRate(raw: string | Record<string, number> | undefined) {
  if (!raw) return {} as Record<string, number>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {} as Record<string, number>;
    }
  }
  return raw;
}

function resolveDiscountData(item: PricingItemLike, itemDiscounts: DiscountMapLike = {}) {
  const itemCodeKey = typeof item.item_code === "string" ? item.item_code : undefined;
  const itemIdKey = typeof item.id === "string" ? item.id : undefined;
  return (itemCodeKey ? itemDiscounts[itemCodeKey] : undefined) || (itemIdKey ? itemDiscounts[itemIdKey] : undefined) || {};
}

function getLegacyExclusiveTaxRate(item: PricingItemLike) {
  const taxTemplates = Array.isArray(item?.tax_templates) ? item.tax_templates : [];
  const hasExclusiveTax = taxTemplates.some((tax) => !tax?.is_inclusive);
  if (!hasExclusiveTax) return 0;
  return Number(item?.total_tax_rate || 0);
}

export function getExclusiveTaxRateForItem(item: PricingItemLike, options: RateOptions = {}) {
  const {
    isTaxIncludedInBasicRate = false,
    selectedTaxLineMap = new Map<string, SelectedTaxLineLike>(),
    selectedTaxTemplate = null,
  } = options;

  if (isTaxIncludedInBasicRate) {
    return 0;
  }

  const itemTaxRate = parseItemTaxRate(item?.item_tax_rate);
  let exclusiveRate = 0;
  let matchedSelectedTemplate = false;

  for (const [accountHead, itemRate] of Object.entries(itemTaxRate || {})) {
    const taxLine = selectedTaxLineMap.get(accountHead);
    if (!taxLine) continue;
    matchedSelectedTemplate = true;
    if (taxLine.charge_type !== "On Net Total" || taxLine.included_in_print_rate) continue;
    exclusiveRate += Number(itemRate || taxLine.rate || 0);
  }

  if (matchedSelectedTemplate) {
    return exclusiveRate;
  }

  if (selectedTaxTemplate?.tax_lines?.length) {
    return selectedTaxTemplate.tax_lines.reduce((total, line) => {
      if (line.charge_type !== "On Net Total" || line.included_in_print_rate) {
        return total;
      }
      return total + Number(line.rate || 0);
    }, 0);
  }

  return getLegacyExclusiveTaxRate(item);
}

export function getEffectiveItemRate(item: PricingItemLike, options: RateOptions = {}) {
  const { itemDiscounts = {} } = options;
  const discountData = resolveDiscountData(item, itemDiscounts);
  const discountPercentage = Number(discountData.discountPercentage || 0);
  const discountAmount = Number(discountData.discountAmount || 0);
  const customRate = discountData.customRate;

  if (customRate !== undefined && customRate !== null) {
    const enteredRate = Math.max(0, Number(customRate) || 0);
    const exclusiveTaxRate = getExclusiveTaxRateForItem(item, options);
    if (exclusiveTaxRate > 0) {
      return enteredRate / (1 + exclusiveTaxRate / 100);
    }
    return enteredRate;
  }

  let rate = Number(item?.price || 0);
  if (discountPercentage > 0) {
    rate = rate * (1 - discountPercentage / 100);
  }
  if (discountAmount > 0) {
    rate = Math.max(0, rate - discountAmount);
  }
  return Math.max(0, rate);
}

export function getEffectiveDisplayRate(item: PricingItemLike, options: RateOptions = {}) {
  const baseRate = getEffectiveItemRate(item, options);
  const exclusiveTaxRate = getExclusiveTaxRateForItem(item, options);
  if (exclusiveTaxRate > 0) {
    return baseRate * (1 + exclusiveTaxRate / 100);
  }
  return baseRate;
}