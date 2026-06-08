/**
 * Currency math utilities to handle floating point precision issues.
 * Precision follows Frappe boot defaults when available.
 */

export function getCurrencyPrecision(): number {
  const maybeFrappe = (globalThis as unknown as {
    frappe?: { boot?: { sysdefaults?: { currency_precision?: string | number } } }
  }).frappe;
  const precision = Number(maybeFrappe?.boot?.sysdefaults?.currency_precision);
  return Number.isFinite(precision) && precision >= 0 ? precision : 2;
}

function getCurrencyFactor(): number {
  return 10 ** getCurrencyPrecision();
}

/**
 * Convert dollars to cents (multiply by 100)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * getCurrencyFactor());
}

/**
 * Convert cents to dollars (divide by 100)
 */
export function toDollars(cents: number): number {
  return cents / getCurrencyFactor();
}

/**
 * Add two currency amounts with precision
 */
export function addCurrency(amount1: number, amount2: number): number {
  const cents1 = toCents(amount1);
  const cents2 = toCents(amount2);
  return toDollars(cents1 + cents2);
}

/**
 * Subtract two currency amounts with precision
 */
export function subtractCurrency(amount1: number, amount2: number): number {
  const cents1 = toCents(amount1);
  const cents2 = toCents(amount2);
  return toDollars(cents1 - cents2);
}

/**
 * Multiply currency amount with precision
 */
export function multiplyCurrency(amount: number, multiplier: number): number {
  const cents = toCents(amount);
  return toDollars(Math.round(cents * multiplier));
}

/**
 * Divide currency amount with precision
 */
export function divideCurrency(amount: number, divisor: number): number {
  const cents = toCents(amount);
  return toDollars(Math.round(cents / divisor));
}

/**
 * Round currency amount to Frappe currency precision
 */
export function roundCurrency(amount: number): number {
  const factor = getCurrencyFactor();
  return Math.round((Number(amount) || 0) * factor) / factor;
}

/**
 * Format currency amount to Frappe currency precision string
 */
export function formatCurrencyAmount(amount: number): string {
  return roundCurrency(amount).toFixed(getCurrencyPrecision());
}

/**
 * Calculate remaining amount after subtracting payments
 */
export function calculateRemainingAmount(total: number, payments: number[]): number {
  const totalCents = toCents(total);
  const paymentsCents = payments.map(toCents);
  const totalPaymentsCents = paymentsCents.reduce((sum, payment) => sum + payment, 0);
  return toDollars(Math.max(0, totalCents - totalPaymentsCents));
}

/**
 * Calculate total of payment amounts
 */
export function calculateTotalPayments(payments: number[]): number {
  const paymentsCents = payments.map(toCents);
  const totalCents = paymentsCents.reduce((sum, payment) => sum + payment, 0);
  return toDollars(totalCents);
}

/**
 * Validate if payment amounts equal total
 */
export function isPaymentComplete(total: number, payments: number[]): boolean {
  const totalCents = toCents(total);
  const paymentsCents = payments.map(toCents);
  const totalPaymentsCents = paymentsCents.reduce((sum, payment) => sum + payment, 0);
  return totalCents === totalPaymentsCents;
}

/**
 * Calculate change amount (overpayment)
 */
export function calculateChange(total: number, payments: number[]): number {
  const totalCents = toCents(total);
  const paymentsCents = payments.map(toCents);
  const totalPaymentsCents = paymentsCents.reduce((sum, payment) => sum + payment, 0);
  return toDollars(Math.max(0, totalPaymentsCents - totalCents));
}
