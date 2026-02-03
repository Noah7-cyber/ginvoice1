class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile, categories = []) {
    // 1. Calculate Business Expenses (100% Deductible)
    let businessExpenses = 0;
    let totalCashExpenses = 0;

    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount.toString());
      totalCashExpenses += amount;

      const type = exp.expenseType || 'business';
      const taxCat = exp.taxCategory;

      // Skip explicitly non-deductible items from business expenses
      // (Though user said "Sum of all expenditures where expenseType === 'business'")
      // I'll assume standard 'business' expenses are deductible.
      if (taxCat === 'NON_DEDUCTIBLE') return;

      if (type === 'business') {
        businessExpenses += amount;
      }
    });

    // 2. Consolidated Relief Allowance (CRA)
    // Formula: 200,000 + (Revenue * 0.20)
    const cra = 200000 + (revenue * 0.20);

    // 3. Threshold Check (The "Stop" Sign)
    // Prevents app from running PIT bands on exempt revenue
    if (revenue <= 50000000) {
        return {
            revenue,
            deductibleExpenses: businessExpenses,
            personalRelief: cra,
            taxableIncome: 0, // Force 0
            taxPayable: 0,    // Force 0

            // Widget Compatibility Fields
            estimatedTax: 0,
            taxBand: 'EXEMPT',
            message: 'Small Company Exempt (Turnover <= ₦50m)',
            status: 'Small Company (Tax Exempt)',
            currency: 'NGN',
            safeToSpend: Math.max(0, revenue - totalCashExpenses),
            breakdown: {
                revenue,
                assessableProfit: Math.max(0, revenue - businessExpenses),
                totalDeductible: businessExpenses,
                personalRelief: cra,
                taxRate: '0%'
            }
        };
    }

    // 4. Taxable Income
    // AssessableProfit = Revenue - BusinessExpenses
    const assessableProfit = Math.max(0, revenue - businessExpenses);

    // FinalTaxable = AssessableProfit - CRA
    const finalTaxable = Math.max(0, assessableProfit - cra);

    // 5. Calculate Tax & Status
    let estimatedTax = 0;
    let taxBand = 'EXEMPT';
    let message = 'Small Company Exempt (Turnover <= ₦50m)';
    let status = 'Small Company (Exempt)';

    status = 'Taxable';
    // Apply CIT rates to Final Taxable Income
    if (revenue <= 100000000) {
      estimatedTax = finalTaxable * 0.25;
      taxBand = 'MEDIUM_COMPANY';
      message = 'Medium Company CIT Rate (25%) on Taxable Income';
    } else {
      estimatedTax = finalTaxable * 0.30;
      taxBand = 'LARGE_COMPANY';
      message = 'Large Company CIT Rate (30%) on Taxable Income';
    }

    // 6. Safe to Spend
    // Cash Flow: Revenue - Total Actual Expenses - Tax
    const safeToSpend = Math.max(0, revenue - totalCashExpenses - estimatedTax);

    return {
      revenue,
      deductibleExpenses: businessExpenses,
      personalRelief: cra,
      taxableIncome: finalTaxable,
      status,
      currency: 'NGN',

      // Widget Compatibility Fields
      estimatedTax,
      taxBand,
      message,
      safeToSpend,
      breakdown: {
        revenue,
        assessableProfit,
        totalDeductible: businessExpenses,
        personalRelief: cra,
        taxRate: revenue > 100000000 ? '30%' : (revenue > 50000000 ? '25%' : '0%')
      }
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
