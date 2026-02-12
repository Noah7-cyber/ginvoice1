const strategy = require('./NigeriaSmallBusinessStrategy');

describe('NigeriaSmallBusinessStrategy (NG CIT ruleset governance)', () => {
  it('returns ruleset version for auditability', () => {
    const result = strategy.calculate(80000000, [], {});
    expect(result.rulesetVersion).toBe('ng-cit-v1.0');
  });

  it('exempts companies with revenue <= 50m', () => {
    const result = strategy.calculate(45000000, [], {});
    expect(result.estimatedTax).toBe(0);
    expect(result.taxBand).toBe('EXEMPT');
  });

  it('applies 25% rate for revenue between 50m and 100m on taxable income after CRA', () => {
    const revenue = 80000000;
    const cra = 200000 + revenue * 0.2; // 16.2m
    const taxableIncome = revenue - cra; // 63.8m
    const result = strategy.calculate(revenue, [], {});

    expect(result.taxBand).toBe('MEDIUM_COMPANY');
    expect(result.taxableIncome).toBe(taxableIncome);
    expect(result.estimatedTax).toBe(taxableIncome * 0.25);
  });

  it('applies 30% rate for revenue above 100m on taxable income after CRA', () => {
    const revenue = 150000000;
    const cra = 200000 + revenue * 0.2; // 30.2m
    const taxableIncome = revenue - cra; // 119.8m
    const result = strategy.calculate(revenue, [], {});

    expect(result.taxBand).toBe('LARGE_COMPANY');
    expect(result.taxableIncome).toBe(taxableIncome);
    expect(result.estimatedTax).toBe(taxableIncome * 0.30);
  });

  it('deducts business expenses and ignores personal/non-deductible from deductibleExpenses', () => {
    const revenue = 100000000;
    const expenses = [
      { amount: 10000000, expenseType: 'business', flowType: 'out', taxCategory: 'OPERATING_EXPENSE' },
      { amount: 5000000, expenseType: 'personal', flowType: 'out', taxCategory: 'NON_DEDUCTIBLE' }
    ];

    const result = strategy.calculate(revenue, expenses, {});
    expect(result.deductibleExpenses).toBe(10000000);
    expect(result.breakdown.assessableProfit).toBe(90000000);
  });

  it('handles money-in entries by reducing expense totals and preserving cash safety math', () => {
    const revenue = 60000000;
    const expenses = [
      { amount: 4000000, expenseType: 'business', flowType: 'out', taxCategory: 'OPERATING_EXPENSE' },
      { amount: 1000000, expenseType: 'business', flowType: 'in', taxCategory: 'OPERATING_EXPENSE' }
    ];

    const result = strategy.calculate(revenue, expenses, {});
    expect(result.deductibleExpenses).toBe(3000000);
    expect(result.safeToSpend).toBeGreaterThan(0);
  });
});
