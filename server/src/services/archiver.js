const mongoose = require('mongoose');
const Business = require('../models/Business');
const Expenditure = require('../models/Expenditure');
const Transaction = require('../models/Transaction');
const MonthlySummary = require('../models/MonthlySummary');

const ARCHIVE_INACTIVITY_DAYS = 60;

const archiveInactiveBusinesses = async () => {
  console.log('Starting daily archival check for inactive businesses...');
  const sixtyDaysAgo = new Date(Date.now() - ARCHIVE_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

  try {
    const inactiveBusinesses = await Business.find({
      lastActiveAt: { $lt: sixtyDaysAgo }
    }).select('_id').lean();

    if (inactiveBusinesses.length === 0) {
      console.log('No inactive businesses found to archive.');
      return;
    }

    const businessIds = inactiveBusinesses.map(b => b._id);
    console.log(`Found ${businessIds.length} inactive business(es) to process.`);

    for (const businessId of businessIds) {
      // Archive expenditures
      const expenditures = await Expenditure.find({
        business: businessId, // Updated to use 'business' ObjectId
        date: { $lt: sixtyDaysAgo }
      });

      const expenditureSummaryOps = expenditures.reduce((acc, exp) => {
        const year = exp.date.getFullYear();
        const month = exp.date.getMonth() + 1;
        const key = `${year}-${month}`;
        if (!acc[key]) {
          acc[key] = { totalExpenditure: 0 };
        }
        acc[key].totalExpenditure += parseFloat(exp.amount.toString());
        return acc;
      }, {});

      // Archive transactions
      const transactions = await Transaction.find({
        businessId,
        transactionDate: { $lt: sixtyDaysAgo }
      });

      const transactionSummaryOps = transactions.reduce((acc, tx) => {
        const year = tx.transactionDate.getFullYear();
        const month = tx.transactionDate.getMonth() + 1;
        const key = `${year}-${month}`;
        if (!acc[key]) {
          acc[key] = { totalTransactions: 0, totalRevenue: 0 };
        }
        acc[key].totalTransactions += 1;
        acc[key].totalRevenue += parseFloat(tx.totalAmount.toString());
        return acc;
      }, {});

      // Combine summaries and save
      const combinedSummary = {};
      Object.keys(expenditureSummaryOps).forEach(key => {
        combinedSummary[key] = { ...combinedSummary[key], ...expenditureSummaryOps[key] };
      });
      Object.keys(transactionSummaryOps).forEach(key => {
        combinedSummary[key] = { ...combinedSummary[key], ...transactionSummaryOps[key] };
      });

      const bulkOps = Object.keys(combinedSummary).map(key => {
        const [year, month] = key.split('-').map(Number);
        const data = combinedSummary[key];
        return {
          updateOne: {
            filter: { businessId, year, month },
            update: {
              $inc: {
                totalExpenditure: data.totalExpenditure || 0,
                totalTransactions: data.totalTransactions || 0,
                totalRevenue: data.totalRevenue || 0
              },
              $set: { archivedAt: new Date() }
            },
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        await MonthlySummary.bulkWrite(bulkOps);
        console.log(`Saved ${bulkOps.length} monthly summaries for business ${businessId}.`);

        // Clean up archived records
        const expenditureIds = expenditures.map(e => e._id);
        if (expenditureIds.length > 0) {
          await Expenditure.deleteMany({ _id: { $in: expenditureIds } });
        }

        const transactionIds = transactions.map(t => t._id);
        if (transactionIds.length > 0) {
          await Transaction.deleteMany({ _id: { $in: transactionIds } });
        }
        console.log(`Cleaned up archived records for business ${businessId}.`);
      }
    }
  } catch (error) {
    console.error('An error occurred during the archival process:', error);
  }
};

module.exports = { archiveInactiveBusinesses };
