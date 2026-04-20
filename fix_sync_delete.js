const fs = require('fs');

const filepath = 'server/src/routes/sync.js';
let content = fs.readFileSync(filepath, 'utf8');

// The initial replace didn't work properly because of the multiline regex, so I will do it with index substring
const postStartIdx = content.indexOf('// 3. DELETE Routes (Missing in original sync)');

if (postStartIdx !== -1) {
  const newDeleteRoutes = `// 3. DELETE Routes (Missing in original sync)
router.delete('/products/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = String(req.businessId).trim();

    const result = await Product.deleteOne({ businessId: { $in: [businessId, new mongoose.Types.ObjectId(businessId)] }, id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Product not found for hard delete' });

    await Notification.create({
      businessId,
      title: 'Product Deleted',
      message: \`Product deleted: \${id}\`,
      body: 'Owner deleted an item from inventory.',
      amount: 0,
      performedBy: req.userRole === 'owner' ? 'Owner' : 'Staff',
      type: 'deletion',
      payload: { productId: id }
    });

    res.json({ success: true, id, hard: true });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/transactions/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = new mongoose.Types.ObjectId(req.businessId); // Transactions use ObjectId

    const transaction = await Transaction.findOne({ businessId, id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (req.query.restock === 'true' && transaction.items) {
        for (const item of transaction.items) {
             const multiplier = item.multiplier || 1;
             await restoreStock({ businessId: req.businessId, productId: item.productId, qty: item.quantity * multiplier });
        }
    }

    const performerName = req.userRole === 'owner' ? 'Owner' : 'Staff';
    await Notification.create({
        businessId: req.businessId,
        message: \`Sale to \${transaction.customerName || 'Customer'} deleted\`,
        amount: transaction.totalAmount || 0,
        performedBy: performerName,
        type: 'deletion',
        payload: { transactionId: transaction.id }
    });

    await Transaction.deleteOne({ businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

router.delete('/expenditures/:id', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    await Expenditure.deleteOne({ business: businessId, id });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;
`;
  content = content.substring(0, postStartIdx) + newDeleteRoutes;
  fs.writeFileSync(filepath, content, 'utf8');
}
