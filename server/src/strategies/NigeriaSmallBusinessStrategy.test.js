const strategy = require('./NigeriaSmallBusinessStrategy');

describe('NigeriaSmallBusinessStrategy', () => {
  it('should exempt companies with revenue <= 50m (Tier 1)', () => {
    const revenue = 45000000;
    const expenses = [];
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.estimatedTax).toBe(0);
    expect(result.taxBand).toBe('EXEMPT');
  });

  it('should tax companies with revenue between 50m and 100m at 25% (Tier 2)', () => {
    // Revenue = 80m. Operating Expenses = 0.
    // Assessable Profit = 80m.
    // Tax = 25% of 80m = 20m.
    const revenue = 80000000;
    const expenses = [];
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.estimatedTax).toBe(20000000);
    expect(result.taxBand).toBe('MEDIUM_COMPANY');
  });

  it('should tax companies with revenue > 100m at 30% (Tier 3)', () => {
    const revenue = 150000000;
    const expenses = []; // No expenses
    // Assessable Profit = 150m. Tax = 30% of 150m = 45m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.estimatedTax).toBe(45000000);
    expect(result.taxBand).toBe('LARGE_COMPANY');
  });

  it('should deduct operating expenses before tax', () => {
    const revenue = 200000000;
    const expenses = [
      { category: 'Utilities', amount: 50000000 }
    ];
    // Assessable Profit = 200m - 50m = 150m.
    // Tax = 30% of 150m = 45m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.assessableProfit).toBe(150000000);
    expect(result.estimatedTax).toBe(45000000);
  });

  it('should NOT deduct Personal Home Rent from Assessable Profit, but calculate tip', () => {
    const revenue = 200000000;
    const expenses = [
      { category: 'Personal Home Rent', amount: 1000000 }
    ];
    // Assessable Profit = 200m - 0 = 200m.
    // Tax = 30% of 200m = 60m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.assessableProfit).toBe(200000000);
    expect(result.estimatedTax).toBe(60000000);

    // Tip: min(1m * 0.20, 500k) = min(200k, 500k) = 200k.
    expect(result.personalTip.reliefAmount).toBe(200000);
  });

  it('should NOT deduct WHT Credit from Assessable Profit, but deduct from Final Tax', () => {
    const revenue = 200000000;
    const expenses = [
      { category: 'Withholding Tax (WHT)', amount: 5000000 }
    ];
    // Assessable Profit = 200m.
    // Estimated Tax = 60m.
    // Final Tax = 60m - 5m = 55m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.assessableProfit).toBe(200000000);
    expect(result.estimatedTax).toBe(55000000);
  });
});
