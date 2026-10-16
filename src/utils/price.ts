/**
 * Utility functions for pricing and currency calculations
 */

/**
 * Calculates the final price of an item after applying a percentage discount.
 * Ensures the price does not drop below 0 and caps the discount between 0 and 100%.
 */
export function calculateFinalPrice(price: number, discount: number = 0): number {
  if (!discount || discount <= 0) {
    return Math.max(0, Math.round(price));
  }
  const effectiveDiscount = Math.min(100, Math.max(0, discount));
  return Math.max(0, Math.round(price - (price * effectiveDiscount) / 100));
}

/**
 * Formats a numeric price into Indian Rupee currency format (e.g. ₹1,299).
 */
export function formatPrice(amount: number): string {
  if (Number.isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
