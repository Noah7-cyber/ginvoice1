class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile, categories = []) {
    let personalRentSum = 0;
    let whtCreditSum = 0;
    let operatingExpenses = 0;

    // 1. Category Mapping
    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount.toString());
      const categoryName = exp.category; // String from frontend

      // Check Tax Category (if present) - Prioritize explicit tax logic
      const taxCat = exp.taxCategory;
      if (taxCat === 'NON_DEDUCTIBLE' || taxCat === 'CAPITAL_ASSET') {
          return;
      }

      // Special Handling for WHT
      if (categoryName === 'Withholding Tax (WHT)' || taxCat === 'WHT_CREDIT') {
        whtCreditSum += amount;
        return;
      }

      // Determine Type (Personal vs Business)
      // Use the transaction-level flag if available, fallback to legacy checks
      let type = exp.expenseType || 'business';

      // Legacy Fallback for 'Personal Home Rent' if expenseType wasn't set
      if (!exp.expenseType && categoryName === 'Personal Home Rent') type = 'personal';

      if (type === 'personal') {
          // It is a personal expense, so it is NOT deductible
          if (categoryName.toLowerCase().includes('rent')) {
              personalRentSum += amount;
          }
      }
      else {
        // Business Operating Expense
        operatingExpenses += amount;
      }
    });

    // 2. Tax Calculation (New 2026 Law)
    // CRA 20% Rule: Allowed Personal Rent Deduction = Min(Actual Rent, 20% of Revenue)
    const rentCap = revenue * 0.20;
    const allowedRentDeduction = Math.min(personalRentSum, rentCap);

    // Assessable Profit = Revenue - Business Expenses - Allowed Rent Deduction
    const assessableProfit = Math.max(0, revenue - operatingExpenses - allowedRentDeduction);

    let estimatedTax = 0;
    let taxBand = 'EXEMPT'; // Default
    let message = 'Small Company Exempt (Turnover <= ₦50m)';

    // Tier 1 (Small): Revenue <= 50m -> 0% Tax
    // UPDATED CHECK: User specifically mentioned 50m.
    if (revenue <= 50000000) {
      estimatedTax = 0;
      taxBand = 'EXEMPT';
      message = 'Small Company Exempt (Turnover <= ₦50m)';
    }
    // Tier 2 (Medium): 50m < Revenue <= 100m -> 25% Tax
    else if (revenue <= 100000000) {
      estimatedTax = assessableProfit * 0.25;
      taxBand = 'MEDIUM_COMPANY';
      message = 'Medium Company CIT Rate (25%)';
    }
    // Tier 3 (Large): Revenue > 100m -> 30% Tax
    else {
      estimatedTax = assessableProfit * 0.30;
      taxBand = 'LARGE_COMPANY';
      message = 'Large Company CIT Rate (30%)';
    }

    // 3. Final Tax Bill
    // Final Tax Payable = Estimated Tax - whtCreditSum.
    const finalTaxPayable = Math.max(0, estimatedTax - whtCreditSum);

    // 4. Personal Hint
    const personalTip = {
      reliefAmount: allowedRentDeduction,
      message: `You claimed ₦${allowedRentDeduction.toLocaleString()} as tax relief on your personal rent (Capped at 20% of Revenue).`
    };

    const totalExpenses = operatingExpenses + personalRentSum + whtCreditSum;
    const realNetProfit = revenue - totalExpenses;
    const safeToSpend = Math.max(0, realNetProfit - finalTaxPayable);

    return {
      estimatedTax: finalTaxPayable,
      taxBand,
      message,
      safeToSpend,
      breakdown: {
        revenue,
        assessableProfit,
        totalDeductible: operatingExpenses + allowedRentDeduction, // Include Rent Relief in total deductible
        whtCredit: whtCreditSum,
        personalRent: personalRentSum,
        taxRate: revenue > 100000000 ? '30%' : (revenue > 50000000 ? '25%' : '0%')
      },
      personalTip
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
