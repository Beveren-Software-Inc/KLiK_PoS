/**
 * Currency utility functions for formatting and symbol mapping
 */

// Common currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'SAR': 'ر.س',
  'AED': 'د.إ',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CAD': 'C$',
  'AUD': 'A$',
  'CHF': 'CHF',
  'CNY': '¥',
  'INR': '₹',
  'KRW': '₩',
  'MXN': '$',
  'NZD': 'NZ$',
  'SGD': 'S$',
  'THB': '฿',
  'TRY': '₺',
  'ZAR': 'R',
  'BRL': 'R$',
  'RUB': '₽',
  'SEK': 'kr',
  'NOK': 'kr',
  'DKK': 'kr',
  'PLN': 'zł',
  'CZK': 'Kč',
  'HUF': 'Ft',
  'ILS': '₪',
  'EGP': '£',
  'QAR': 'ر.ق',
  'KWD': 'د.ك',
  'BHD': 'د.ب',
  'OMR': 'ر.ع',
  'JOD': 'د.أ',
  'LBP': 'ل.ل',
  'PKR': '₨',
  'BDT': '৳',
  'LKR': '₨',
  'NPR': '₨',
  'AFN': '؋',
  'IRR': '﷼',
  'IQD': 'د.ع',
  'SYP': '£',
  'YER': '﷼',
  'MAD': 'د.م',
  'TND': 'د.ت',
  'DZD': 'د.ج',
  'LYD': 'ل.د',
  'ETB': 'Br',
  'KES': 'KSh',
  'UGX': 'USh',
  'TZS': 'TSh',
  'ZMW': 'ZK',
  'BWP': 'P',
  'SZL': 'L',
  'LSL': 'L',
  'NAD': 'N$',
  'MUR': '₨',
  'SCR': '₨',
  'MVR': 'ރ',
  'NIO': 'C$',
  'GTQ': 'Q',
  'HNL': 'L',
  'SVC': '$',
  'BZD': 'BZ$',
  'JMD': 'J$',
  'TTD': 'TT$',
  'BBD': 'Bds$',
  'XCD': '$',
  'AWG': 'ƒ',
  'ANG': 'ƒ',
  'SRD': '$',
  'GYD': 'G$',
  'VEF': 'Bs',
  'COP': '$',
  'PEN': 'S/',
  'BOB': 'Bs',
  'CLP': '$',
  'ARS': '$',
  'UYU': '$U',
  'PYG': '₲',
  'FKP': '£',
  'FJD': 'FJ$',
  'PGK': 'K',
  'SBD': 'SI$',
  'VUV': 'Vt',
  'WST': 'WS$',
  'TOP': 'T$',
  'PHP': '₱',
  'IDR': 'Rp',
  'MYR': 'RM',
  'VND': '₫',
  'LAK': '₭',
  'KHR': '៛',
  'MMK': 'K',
  'BND': 'B$',
};

/**
 * Get currency symbol from currency code
 * @param currency - Currency code (e.g., 'USD', 'SAR', 'EUR')
 * @returns Currency symbol (e.g., '$', 'ر.س', '€')
 */
export const getCurrencySymbol = (currency: string): string => {
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    return currency;
  }

  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol || currency; // Return currency code if symbol not found
};


/**
 * Format amount with a pre-rendered currency symbol and thousands separators.
 * @param amount - Amount to format
 * @param currencySymbol - Currency symbol to prefix
 * @returns Formatted string (e.g., "KES 9,900.00")
 */
export const formatCurrencyWithSymbol = (amount: number, currencySymbol?: string): string => {
  const safeAmount = Number(amount || 0);
  const symbol = currencySymbol;

  return `${symbol} ${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
