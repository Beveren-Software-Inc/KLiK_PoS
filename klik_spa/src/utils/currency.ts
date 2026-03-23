/**
 * Currency utility functions for formatting and symbol mapping
 */

import { formatCurrency as formatLocalizedCurrency, formatNumber, getCurrentLanguage } from "../i18n/runtime";

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
  if (!currency) return '$';

  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol || currency; // Return currency code if symbol not found
};

/**
 * Format amount with currency symbol
 * @param amount - Amount to format
 * @param currency - Currency code
 * @returns Formatted string (e.g., "SAR 100.00", "$50.00")
 */
export const formatCurrency = (amount: number, currency?: string): string => {
  if (!amount && amount !== 0) return formatNumber(0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return formatLocalizedCurrency(amount, currency || 'USD', undefined, getCurrentLanguage());
};

/**
 * Format amount with currency symbol (compact version)
 * @param amount
 * @param currency
 * @returns Formatted string (e.g., "SAR100.00", "$50.00")
 */
export const formatCurrencyCompact = (amount: number, currency?: string): string => {
  if (!amount && amount !== 0) return formatNumber(0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  try {
    return formatLocalizedCurrency(
      amount,
      currency || 'USD',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      getCurrentLanguage(),
    ).replace(/\s+/g, "");
  } catch {
    const symbol = getCurrencySymbol(currency || 'USD');
    return `${symbol}${amount.toFixed(2)}`;
  }
};
