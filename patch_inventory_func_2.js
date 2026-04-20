const fs = require('fs');
const file = 'client/components/InventoryScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const generateStockAdjTx = `
const generateStockAdjustmentTransaction = (productId: string, productName: string, delta: number, shopId?: string) => {
    return {
        id: \`adj_\${productId}_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
        transactionId: \`adj_\${productId}_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
        idempotencyKey: \`adj_\${productId}_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`,
        inventoryEffect: delta > 0 ? 'restock' : 'sale',
        customerName: 'Stock Adjustment',
        paymentStatus: 'paid',
        transactionDate: new Date().toISOString(),
        shopId: shopId || '',
        items: [{
            productId: productId,
            productName: productName || 'Unknown',
            quantity: Math.abs(delta),
            multiplier: 1,
            unitPrice: 0,
            discount: 0,
            total: 0
        }],
        subtotal: 0,
        globalDiscount: 0,
        totalAmount: 0,
        amountPaid: 0,
        balance: 0,
        paymentMethod: 'cash',
        staffId: 'System'
    };
};
`;

content = content.replace(/const InventoryScreen: React\.FC<InventoryScreenProps> = \(\{/, generateStockAdjTx + '\nconst InventoryScreen: React.FC<InventoryScreenProps> = ({');

fs.writeFileSync(file, content);
