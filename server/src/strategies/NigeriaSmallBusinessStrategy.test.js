const strategy = require('./NigeriaSmallBusinessStrategy');

describe('NigeriaSmallBusinessStrategy (CRA 20% Rule)', () => {
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
    const expenses = [];
    // Assessable Profit = 150m. Tax = 30% of 150m = 45m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.estimatedTax).toBe(45000000);
    expect(result.taxBand).toBe('LARGE_COMPANY');
  });

  it('should deduct strictly business expenses', () => {
    const revenue = 100000000; // Tier 2 (25%)
    const expenses = [
      { category: 'Utilities', amount: 10000000, expenseType: 'business' },
      { category: 'Personal Stuff', amount: 5000000, expenseType: 'personal' } // Should be ignored
    ];
    // Assessable Profit = 100m - 10m = 90m.
    // Tax = 25% of 90m = 22.5m.
    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.assessableProfit).toBe(90000000);
    expect(result.estimatedTax).toBe(22500000);
  });

  it('should handle Personal Rent with CRA 20% Cap (Rent > Cap)', () => {
    // Revenue = 100m. Cap = 20m.
    // Rent = 25m.
    // Allowed = 20m.
    // Business Exp = 10m.
    // Assessable = 100m - 10m - 20m = 70m.
    // Tax (25%) = 17.5m.
    const revenue = 100000000;
    const expenses = [
      { category: 'Rent', amount: 25000000, expenseType: 'personal' },
      { category: 'Salaries', amount: 10000000, expenseType: 'business' }
    ];

    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.personalRent).toBe(25000000);
    expect(result.personalTip.reliefAmount).toBe(20000000); // Capped
    expect(result.breakdown.assessableProfit).toBe(70000000);
    expect(result.estimatedTax).toBe(17500000);
  });

  it('should handle Personal Rent with CRA 20% Cap (Rent < Cap)', () => {
    // Revenue = 100m. Cap = 20m.
    // Rent = 5m.
    // Allowed = 5m.
    // Assessable = 100m - 5m = 95m.
    // Tax (25%) = 23.75m.
    const revenue = 100000000;
    const expenses = [
      { category: 'Rent', amount: 5000000, expenseType: 'personal' }
    ];

    const result = strategy.calculate(revenue, expenses, {});

    expect(result.personalTip.reliefAmount).toBe(5000000); // Full amount
    expect(result.breakdown.assessableProfit).toBe(95000000);
    expect(result.estimatedTax).toBe(23750000);
  });

  it('should deduct WHT from FINAL Tax, not Profit', () => {
    // Revenue = 100m.
    // WHT = 2m.
    // Assessable = 100m.
    // Estimated Tax = 25m.
    // Final Tax = 25m - 2m = 23m.
    const revenue = 100000000;
    const expenses = [
      { category: 'Withholding Tax (WHT)', amount: 2000000, expenseType: 'business' }
    ];

    const result = strategy.calculate(revenue, expenses, {});

    expect(result.breakdown.assessableProfit).toBe(100000000);
    expect(result.estimatedTax).toBe(23000000);
  });
});
