const strategy = require('../strategies/NigeriaSmallBusinessStrategy');

// Mock data
const business = { taxSettings: { isEnabled: true } };

console.log("Testing NigeriaSmallBusinessStrategy...");

// Test Case 1: Exempt (< 25m)
const rev1 = 20000000;
const exp1 = [{ amount: 5000000, taxCategory: 'OPERATING_EXPENSE' }];
const res1 = strategy.calculate(rev1, exp1, business);

if (res1.taxBand !== 'EXEMPT') throw new Error("Test 1 Failed: Should be EXEMPT");
if (res1.estimatedTax !== 0) throw new Error("Test 1 Failed: Tax should be 0");
console.log("Test 1 Passed (Exempt)");

// Test Case 2: Medium (25m - 100m) -> 20%
const rev2 = 50000000;
const exp2 = [
    { amount: 10000000, taxCategory: 'OPERATING_EXPENSE' },
    { amount: 4000000, taxCategory: 'CAPITAL_ASSET' } // Allowance = 1m (25%)
];
// Assessable = 50m - (10m + 1m) = 39m
// Tax = 39m * 0.20 = 7.8m
const res2 = strategy.calculate(rev2, exp2, business);

if (res2.taxBand !== 'MEDIUM_COMPANY') throw new Error("Test 2 Failed: Should be MEDIUM");
if (Math.abs(res2.estimatedTax - 7800000) > 1) throw new Error(`Test 2 Failed: Expected 7.8m, got ${res2.estimatedTax}`);
console.log("Test 2 Passed (Medium)");

// Test Case 3: Large (> 100m) -> 30%
const rev3 = 150000000;
const exp3 = [{ amount: 50000000, taxCategory: 'OPERATING_EXPENSE' }];
// Assessable = 100m
// Tax = 100m * 0.30 = 30m
const res3 = strategy.calculate(rev3, exp3, business);

if (res3.taxBand !== 'LARGE_COMPANY') throw new Error("Test 3 Failed: Should be LARGE");
if (Math.abs(res3.estimatedTax - 30000000) > 1) throw new Error(`Test 3 Failed: Expected 30m, got ${res3.estimatedTax}`);
console.log("Test 3 Passed (Large)");

console.log("All Strategy Tests Passed!");
