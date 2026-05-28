// The "Safe Math" Helper to prevent floating point errors

// Central constant for currency scaling
const SCALE = 1000;

export const safeCalculate = (price: number, quantity: number): number => {
  // 1. Convert to cents (integers) to avoid float errors
  // We round the price * SCALE first to handle any minor pre-existing float noise
  const safePrice = Math.round(price * SCALE);
  const safeQty = quantity;
  // 2. Calculate
  const totalCents = safePrice * safeQty;
  // 3. Convert back to dollars (or main currency unit)
  return totalCents / SCALE;
};

export const safeSum = (items: any[], key: string): number => {
  const totalCents = items.reduce((sum, item) => {
    // If the key is 'total' or 'totalAmount', it might already be calculated safely.
    // However, if we are summing potentially float values, we assume they are currency-like.
    // We treat 'key' value as main currency unit.
    return sum + Math.round((item[key] || 0) * SCALE);
  }, 0);
  return totalCents / SCALE;
};
