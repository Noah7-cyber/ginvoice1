// The "Safe Math" Helper to prevent floating point errors
export const safeCalculate = (price: number, quantity: number): number => {
  // 1. Convert to cents (integers) to avoid float errors
  // We round the price * 100 first to handle any minor pre-existing float noise
  const safePrice = Math.round(price * 100);
  const safeQty = quantity;
  // 2. Calculate
  const totalCents = safePrice * safeQty;
  // 3. Convert back to dollars (or main currency unit)
  return totalCents / 100;
};

export const safeSum = (items: any[], key: string): number => {
  const totalCents = items.reduce((sum, item) => {
    // If the key is 'total' or 'totalAmount', it might already be calculated safely.
    // However, if we are summing potentially float values, we assume they are currency-like.
    // We treat 'key' value as main currency unit.
    return sum + Math.round((item[key] || 0) * 100);
  }, 0);
  return totalCents / 100;
};
