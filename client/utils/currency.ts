export const formatCurrency = (value: any, currencyCode = 'NGN'): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  let numValue: number;

  // Handle MongoDB Decimal128 objects (which have toString()) or plain numbers
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    numValue = parseFloat(value.toString());
  } else {
    numValue = Number(value);
  }

  if (isNaN(numValue)) return 'N/A';

  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  } catch (error) {
    return currencyCode + ' ' + numValue.toFixed(2);
  }
};
