const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

const parseRestockFlag = (restockQueryValue) => restockQueryValue !== 'false';

const getItemMultiplier = (item) => item.multiplier || (item.selectedUnit ? item.selectedUnit.multiplier : 1);

const deleteTransactionForBusiness = async ({ transactionId, businessId, userRole, shouldRestock }) => {
  const transaction = await Transaction.findOne({ id: transactionId, businessId });
  if (!transaction) {
    return { notFound: true };
  }

  if (shouldRestock && Array.isArray(transaction.items) && transaction.items.length > 0) {
    const restockOps = transaction.items.map((item) => ({
      updateOne: {
        filter: { id: item.productId, businessId },
        update: { $inc: { stock: item.quantity * getItemMultiplier(item) } }
      }
    }));

    if (restockOps.length > 0) {
      await Product.bulkWrite(restockOps);
    }
  }

  await Notification.create({
    businessId,
    message: `Sale to ${transaction.customerName || 'Customer'} deleted`,
    amount: transaction.totalAmount || 0,
    performedBy: userRole === 'owner' ? 'Owner' : 'Staff',
    type: 'deletion'
  });

  await Transaction.deleteOne({ id: transactionId, businessId });

  return {
    notFound: false,
    transactionId,
    restocked: shouldRestock
  };
};

module.exports = {
  deleteTransactionForBusiness,
  parseRestockFlag
};
