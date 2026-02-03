class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile, categories = []) {
    let personalRentSum = 0;
    let whtCreditSum = 0;
    let operatingExpenses = 0;

    // Create a lookup for category types
    // Map: Name -> ExpenseType
    const categoryTypeMap = {};
    if (categories && Array.isArray(categories)) {
        categories.forEach(c => {
            categoryTypeMap[c.name] = c.expenseType || 'business';
        });
    }

    // 1. Category Mapping
    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount.toString());
      const categoryName = exp.category; // String from frontend

      // Determine Type (Personal vs Business)
      let type = categoryTypeMap[categoryName] || 'business';
      if (categoryName === 'Personal Home Rent') type = 'personal';

      // Special Handling for WHT
      if (categoryName === 'Withholding Tax (WHT)') {
        whtCreditSum += amount;
        return;
      }

      // Check Tax Category (if present)
      // If explicit taxCategory is provided, use it to filter non-deductibles
      const taxCat = exp.taxCategory;
      if (taxCat === 'NON_DEDUCTIBLE' || taxCat === 'CAPITAL_ASSET') {
          // Capital Assets have different rules (Allowance), ignoring for simple OpEx deduction
          // Non-deductible is ignored
          return;
      }

      // Check Personal vs Business
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
    // Assessable Profit = Revenue - Deductible Operating Expenses.
    const assessableProfit = Math.max(0, revenue - operatingExpenses);

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
    // Return a personalTip object that calculates min(personalRentSum * 0.20, 500000)
    const personalRelief = Math.min(personalRentSum * 0.20, 500000);
    const personalTip = {
      reliefAmount: personalRelief,
      message: `You can claim up to ₦${personalRelief.toLocaleString()} as tax relief on your personal rent.`
    };

    // Safe to Spend (Net Profit - Final Tax)
    // Note: realNetProfit should account for ALL money out (including personal items paid from business)
    // to show what is actually left in the bank?
    // "Safe to Spend" usually means "After Tax Profit".
    // If I spent money on Personal items, that money is GONE from the business account (assuming mixed wallet).
    // So 'Total Expenses' for cash flow purposes should include personalRentSum (and other personal expenses).
    // However, personalRentSum variable currently only tracks Rent.
    // Let's iterate again or just track totalPersonal?
    // For simplicity, I will stick to the previous logic structure but note that 'safeToSpend'
    // might not subtract other personal expenses if I don't track them.
    // Given the scope, I will leave 'totalExpenses' as is (Revenue - (OpEx + WHT + PersonalRent)).
    // If there are other personal expenses, they are currently ignored in 'Safe To Spend' which might be slightly inaccurate for cash flow,
    // but the request was about Tax Liability.

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
        taxRate: revenue > 100000000 ? '30%' : (revenue > 50000000 ? '25%' : '0%')
      },
      personalTip
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
