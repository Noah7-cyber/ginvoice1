class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile) {
    let personalRentSum = 0;
    let whtCreditSum = 0;
    let operatingExpenses = 0;

    // 1. Category Mapping
    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount.toString());
      const category = exp.category; // String from frontend

      if (category === 'Personal Home Rent') {
        personalRentSum += amount;
      } else if (category === 'Withholding Tax (WHT)') {
        whtCreditSum += amount;
      } else {
        // Treat as standard deductible Operating Expenses
        operatingExpenses += amount;
      }
    });

    // 2. Tax Calculation (New 2026 Law)
    // Assessable Profit = Revenue - Deductible Operating Expenses.
    const assessableProfit = Math.max(0, revenue - operatingExpenses);

    let estimatedTax = 0;
    let taxBand = 'EXEMPT'; // Default
    let message = 'Small Company Exempt (Turnover <= ₦100m)';

    // IF Revenue <= 100,000,000: Tax is 0% (Small Company Exempt).
    if (revenue <= 100000000) {
      estimatedTax = 0;
      taxBand = 'EXEMPT';
      message = 'Small Company Exempt (Turnover <= ₦100m)';
    } else {
      // IF Revenue > 100,000,000: Tax is 30% of Assessable Profit.
      estimatedTax = assessableProfit * 0.30;
      taxBand = 'LARGE_COMPANY';
      message = 'Large Company CIT Rate (30%)';
    }

    // 3. Final Tax Bill
    // Final Tax Payable = Estimated Tax - whtCreditSum.
    const finalTaxPayable = Math.max(0, estimatedTax - whtCreditSum);

    // 4. Personal Hint
    // Return a personalTip object that calculates min(personalRentSum * 0.20, 500000)
    const personalRelief = Math.min(personalRentSum * 0.20, 500000);
    const personalTip = {
      reliefAmount: personalRelief,
      message: `You can claim up to ₦${personalRelief.toLocaleString()} as tax relief on your personal rent.`
    };

    // Safe to Spend (Net Profit - Final Tax)
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
        totalDeductible: operatingExpenses,
        whtCredit: whtCreditSum,
        personalRent: personalRentSum,
        taxRate: revenue > 100000000 ? '30%' : '0%'
      },
      personalTip
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
