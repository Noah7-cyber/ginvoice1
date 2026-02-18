
const assert = require('assert');

// This script simulates the backend logic for PATCH /settle with partial payment support
// to verify the logic before implementation.

async function testPatchLogic() {
    // Mock Transaction
    let transaction = {
        id: 'tx-123',
        totalAmount: 1000,
        amountPaid: 0,
        balance: 1000,
        paymentStatus: 'credit',
        save: async function() { console.log('Saved:', this); }
    };

    // Simulate Request Body (Partial Payment)
    const reqBody = { amountPaid: 500 }; // Paying 500 total (so balance becomes 500)

    console.log('Original Transaction:', { ...transaction });

    // Logic to be implemented in route
    if (reqBody.amountPaid !== undefined) {
        // Validate
        const newAmountPaid = Number(reqBody.amountPaid);
        if (isNaN(newAmountPaid) || newAmountPaid < 0) {
             console.error('Invalid amountPaid');
             return;
        }

        // Apply Update
        transaction.amountPaid = newAmountPaid;

        // Recalculate Balance
        transaction.balance = Math.max(0, transaction.totalAmount - transaction.amountPaid);

        // Update Status
        if (transaction.balance <= 0) {
            transaction.paymentStatus = 'paid';
        } else {
            transaction.paymentStatus = 'credit';
        }
    } else {
        // Default Behavior (Full Settle)
        transaction.amountPaid = transaction.totalAmount;
        transaction.balance = 0;
        transaction.paymentStatus = 'paid';
    }

    console.log('Updated Transaction:', { ...transaction });

    // Assertions
    if (transaction.amountPaid !== 500) { console.error('FAIL: amountPaid should be 500'); process.exit(1); }
    if (transaction.balance !== 500) { console.error('FAIL: balance should be 500'); process.exit(1); }
    if (transaction.paymentStatus !== 'credit') { console.error('FAIL: status should be credit'); process.exit(1); }

    console.log('Test Passed!');
}

testPatchLogic();
