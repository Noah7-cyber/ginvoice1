const cron = require('node-cron');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const { sendNativePush } = require('./pushService');

const initCronJobs = () => {
    // 6:00 AM - Morning Greeting
    cron.schedule('0 6 * * *', async () => {
        try {
            const businesses = await Business.find();
            for (const b of businesses) {
                await sendNativePush(b._id, 'Good Morning! ☀️', 'Ready for another day of sales? Open Ginvoice to get started!');
            }
        } catch (err) {
            console.error('[Cron] Morning Greeting failed:', err);
        }
    }, { timezone: 'Africa/Lagos' });

    // 10:00 AM - Low Stock Alert
    cron.schedule('0 10 * * *', async () => {
        try {
            const businesses = await Business.find();
            for (const b of businesses) {
                const threshold = b.settings?.lowStockThreshold || 10;
                // Only count physical products, not services
                const lowStockItems = await Product.find({ businessId: b._id, itemType: { $ne: 'SERVICE' }, stock: { $lt: threshold } }).limit(3).lean();
                
                if (lowStockItems.length > 0) {
                    const names = lowStockItems.map(p => p.name).join(', ');
                    await sendNativePush(b._id, '⚠️ Low Stock Alert', `Items running low: ${names}. Restock soon!`);
                }
            }
        } catch (err) {
            console.error('[Cron] Low Stock Alert failed:', err);
        }
    }, { timezone: 'Africa/Lagos' });

    // 7:00 PM - Daily Summary
    cron.schedule('0 19 * * *', async () => {
        try {
            const businesses = await Business.find();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            for (const b of businesses) {
                const txs = await Transaction.find({ businessId: b._id, transactionDate: { $gte: startOfDay } });
                const exps = await Expenditure.find({ business: b._id, date: { $gte: startOfDay } });
                
                const totalSales = txs.reduce((sum, tx) => sum + Number(tx.totalAmount || 0), 0);
                const totalExp = exps.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
                
                if (totalSales > 0 || totalExp > 0) {
                    const format = (n) => `₦${n.toLocaleString()}`;
                    await sendNativePush(b._id, '📊 Daily Summary', `Today's Sales: ${format(totalSales)} | Expenses: ${format(totalExp)}`);
                }
            }
        } catch (err) {
            console.error('[Cron] Daily Summary failed:', err);
        }
    }, { timezone: 'Africa/Lagos' });

    // 9:00 AM - Subscription Warning
    cron.schedule('0 9 * * *', async () => {
        try {
            const in3Days = new Date();
            in3Days.setDate(in3Days.getDate() + 3);
            
            const businesses = await Business.find({ 
                $or: [
                    { subscriptionExpiresAt: { $lte: in3Days, $gte: new Date() } },
                    { trialEndsAt: { $lte: in3Days, $gte: new Date() } }
                ]
            });
            
            for (const b of businesses) {
                await sendNativePush(b._id, '⚠️ Subscription Expiring Soon', 'Your subscription or trial expires in less than 3 days. Please renew to keep your store running!');
            }
        } catch (err) {
            console.error('[Cron] Subscription Warning failed:', err);
        }
    }, { timezone: 'Africa/Lagos' });

    console.log('[Cron] Scheduled jobs initialized successfully.');
};

module.exports = { initCronJobs };
