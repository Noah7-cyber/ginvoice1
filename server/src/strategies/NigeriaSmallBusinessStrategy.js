const RULESET_VERSION = 'ng-cit-v1.0';
const Decimal = require('decimal.js');

class NigeriaSmallBusinessStrategy {
  calculate(revenue, expenses, businessProfile, categories = []) {
    // 1. Calculate Business Expenses (100% Deductible)
    let businessExpenses = new Decimal(0);
    let totalCashExpenses = new Decimal(0);
    const rev = new Decimal(revenue);

    expenses.forEach(exp => {
      const amount = new Decimal(exp.amount.toString()).abs();
      const flow = exp.flowType || 'out'; // 'out' or 'in'
      const type = exp.expenseType || 'business';
      const taxCat = exp.taxCategory;

      if (flow === 'in') {
        // MONEY IN: Reduces the total expenses (like a refund)
        // Effectively, it increases profit, so we reduce the expense sum
        totalCashExpenses = totalCashExpenses.minus(amount);

        if (type === 'business' && taxCat !== 'NON_DEDUCTIBLE') {
           businessExpenses = businessExpenses.minus(amount);
        }

      } else {
        // MONEY OUT: Increases expenses
        totalCashExpenses = totalCashExpenses.plus(amount);

        // Skip explicitly non-deductible items from business expenses
        if (taxCat === 'NON_DEDUCTIBLE') return;

        if (type === 'business') {
            businessExpenses = businessExpenses.plus(amount);
        }
      }
    });

    // 2. Consolidated Relief Allowance (CRA)
    // Formula: 200,000 + (Revenue * 0.20)
    const cra = rev.times(0.20).plus(200000);

    // 3. Threshold Check (The "Stop" Sign)
    // Prevents app from running PIT bands on exempt revenue
    if (rev.lte(50000000)) {
        return {
            rulesetVersion: RULESET_VERSION,
            revenue: rev.toNumber(),
            deductibleExpenses: businessExpenses.toNumber(),
            personalRelief: cra.toNumber(),
            taxableIncome: 0, // Force 0
            taxPayable: 0,    // Force 0

            // Widget Compatibility Fields
            estimatedTax: 0,
            taxBand: 'EXEMPT',
            message: 'Small Company Exempt (Turnover <= ₦50m)',
            status: 'Small Company (Tax Exempt)',
            currency: 'NGN',
            safeToSpend: Decimal.max(0, rev.minus(totalCashExpenses)).toNumber(),
            breakdown: {
                revenue: rev.toNumber(),
                assessableProfit: Decimal.max(0, rev.minus(businessExpenses)).toNumber(),
                totalDeductible: businessExpenses.toNumber(),
                personalRelief: cra.toNumber(),
                taxRate: '0%'
            }
        };
    }

    // 4. Taxable Income
    // AssessableProfit = Revenue - BusinessExpenses
    const assessableProfit = Decimal.max(0, rev.minus(businessExpenses));

    // FinalTaxable = AssessableProfit - CRA
    const finalTaxable = Decimal.max(0, assessableProfit.minus(cra));

    // 5. Calculate Tax & Status
    let estimatedTax = new Decimal(0);
    let taxBand = 'EXEMPT';
    let message = 'Small Company Exempt (Turnover <= ₦50m)';
    let status = 'Small Company (Exempt)';

    status = 'Taxable';
    // Apply CIT rates to Final Taxable Income
    if (rev.lte(100000000)) {
      estimatedTax = finalTaxable.times(0.25);
      taxBand = 'MEDIUM_COMPANY';
      message = 'Medium Company CIT Rate (25%) on Taxable Income';
    } else {
      estimatedTax = finalTaxable.times(0.30);
      taxBand = 'LARGE_COMPANY';
      message = 'Large Company CIT Rate (30%) on Taxable Income';
    }

    // 6. Safe to Spend
    // Cash Flow: Revenue - Total Actual Expenses - Tax
    const safeToSpend = Decimal.max(0, rev.minus(totalCashExpenses).minus(estimatedTax));

    return {
      rulesetVersion: RULESET_VERSION,
      revenue: rev.toNumber(),
      deductibleExpenses: businessExpenses.toNumber(),
      personalRelief: cra.toNumber(),
      taxableIncome: finalTaxable.toNumber(),
      status,
      currency: 'NGN',

      // Widget Compatibility Fields
      estimatedTax: estimatedTax.toNumber(),
      taxBand,
      message,
      safeToSpend: safeToSpend.toNumber(),
      breakdown: {
        revenue: rev.toNumber(),
        assessableProfit: assessableProfit.toNumber(),
        totalDeductible: businessExpenses.toNumber(),
        personalRelief: cra.toNumber(),
        taxRate: rev.gt(100000000) ? '30%' : (rev.gt(50000000) ? '25%' : '0%')
      }
    };
  }
}

module.exports = new NigeriaSmallBusinessStrategy();
