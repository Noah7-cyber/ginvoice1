import Decimal from 'decimal.js';

export const safeCalculate = (price: number, quantity: number): number => {
  return new Decimal(price || 0).times(new Decimal(quantity || 0)).toNumber();
};

export const safeSum = (items: any[], key: string): number => {
  return items.reduce((sum, item) => {
    return sum.plus(new Decimal(item[key] || 0));
  }, new Decimal(0)).toNumber();
};
