/**
 * Currency math utilities to handle floating point precision issues
 * All amounts are treated as cents to avoid floating point errors
 */

/**
 * Convert dollars to cents (multiply by 100)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars (divide by 100)
 */
export function toDollars(cents: number): number {
  return cents / 100;
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
 * Round currency amount to 2 decimal places
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Format currency amount to 2 decimal places string
 */
export function formatCurrencyAmount(amount: number): string {
  return roundCurrency(amount).toFixed(2);
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
