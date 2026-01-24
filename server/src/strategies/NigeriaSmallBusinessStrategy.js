class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile) {

    // 1. Filter Deductible Expenses
    let operatingExpenses = 0;
    let salaryPension = 0;
    let capitalAssets = 0;
    let nonDeductible = 0;

    expenses.forEach(exp => {
      // Handle legacy expenses (default to OPERATING_EXPENSE if no taxCategory)
      const category = exp.taxCategory || 'OPERATING_EXPENSE';

      const amount = parseFloat(exp.amount.toString());

      switch (category) {
        case 'OPERATING_EXPENSE':
        case 'COST_OF_GOODS':
          operatingExpenses += amount;
          break;
        case 'SALARY_PENSION':
          salaryPension += amount;
          break;
        case 'CAPITAL_ASSET':
          capitalAssets += amount;
          break;
        case 'NON_DEDUCTIBLE':
          nonDeductible += amount;
          break;
        default:
          operatingExpenses += amount; // Fallback
      }
    });

    // 2. Calculate Allowances
    // Simplified Capital Allowance: 25% of Capital Assets per year
    // Note: In reality, this depends on asset type and years held.
    // This is an ESTIMATE as per "Compliance Shield" rules.
    const capitalAllowance = capitalAssets * 0.25;

    const totalDeductible = operatingExpenses + salaryPension + capitalAllowance;

    // 3. Assessable Profit
    const assessableProfit = Math.max(0, revenue - totalDeductible);

    // 4. Determine Tax Band & Rate
    let taxRate = 0;
    let taxBand = 'EXEMPT';
    let message = 'Small Company Exemption (Turnover < ₦25m)';

    if (revenue >= 100000000) { // 100m+
      taxRate = 0.30;
      taxBand = 'LARGE_COMPANY';
      message = 'Large Company CIT Rate (30%)';
    } else if (revenue >= 25000000) { // 25m - 100m
      taxRate = 0.20;
      taxBand = 'MEDIUM_COMPANY';
      message = 'Medium Company CIT Rate (20%)';
    }

    // 5. Calculate Tax
    const estimatedTax = assessableProfit * taxRate;

    // 6. Safe to Spend (Net Profit after Tax Estimate)
    // Real Net Profit = Revenue - All Expenses (including non-deductible) - Tax
    const realTotalExpenses = operatingExpenses + salaryPension + capitalAssets + nonDeductible;
    const realNetProfit = revenue - realTotalExpenses;
    const safeToSpend = Math.max(0, realNetProfit - estimatedTax);

    return {
      estimatedTax,
      taxBand,
      message,
      safeToSpend,
      breakdown: {
        revenue,
        assessableProfit,
        totalDeductible,
        capitalAllowance,
        taxRate: `${taxRate * 100}%`
      }
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
