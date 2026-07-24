const fs = require('fs');
const file = 'client/components/GuidesScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `export const INVENTORY_HOTSPOTS: Hotspot[] = [
  { id: 'categories', title: 'Categories', description: 'Organize your products into categories for easier navigation.' },
  { id: 'verify-stock', title: 'Verify Stock', description: 'Reconcile your physical inventory with digital records.' },
  { id: 'import-csv', title: 'Import Data', description: 'Upload multiple products at once using a CSV file.' },
  { id: 'add-product', title: 'Add New Products', description: 'Register new items, set prices and stock levels.' },
  { id: 'search', title: 'Search & Filters', description: 'Quickly find products by name or SKU.' },
  { id: 'stock-status', title: 'Stock Indicators', description: 'A red dot indicates the item needs restocking.' },
  { id: 'quick-edit', title: 'Quick Edit', description: 'Edit product details quickly without leaving this page.' }
];

export const SALES_HOTSPOTS: Hotspot[] = [
  { id: 'search', title: 'Find Products', description: 'Search items to add to the bill.' },
  { id: 'filter', title: 'Filter Categories', description: 'Filter products by their category.' },
  { id: 'product-click', title: 'Add to Cart', description: 'Tap a product to instantly add it.' }
];

export const CART_HOTSPOTS: Hotspot[] = [
  { id: 'customer-name', title: 'Customer Details', description: 'Link this sale to a new or existing customer.' },
  { id: 'cart-item', title: 'Adjust Quantities', description: 'Increase or decrease item quantities directly.' },
  { id: 'discount', title: 'Global Discount', description: 'Apply a percentage or flat discount to the entire bill.' },
  { id: 'payment-methods', title: 'Payment Method', description: 'Select how the customer is paying for this order.' },
  { id: 'checkout', title: 'Confirm & Pay', description: 'Complete the sale to process payment.' }
];

export const HISTORY_HOTSPOTS: Hotspot[] = [
  { id: 'search', title: 'Search Sales', description: 'Find past sales by receipt number or customer.' },
  { id: 'transaction-card', title: 'View Details', description: 'Click any receipt to reprint or refund.' }
];

export const EXPENDITURE_HOTSPOTS: Hotspot[] = [
  { id: 'add-expense', title: 'Record Expense', description: 'Log money leaving your business.' },
  { id: 'categories', title: 'Expense Categories', description: 'Manage categories for your expenses.' },
  { id: 'search-filter', title: 'Search & Filter', description: 'Filter expenses by date range and search terms.' }
];

export const SETTINGS_HOTSPOTS: Hotspot[] = [
  { id: 'receipt-settings', title: 'Receipt Customization', description: 'Add your logo and custom footer text.' },
  { id: 'network-settings', title: 'Network Settings', description: 'Configure online and offline modes for sales.' },
  { id: 'staff-management', title: 'Staff Roles', description: 'Control what your cashiers can see and do.' },
  { id: 'discount-codes', title: 'Discount Codes', description: 'Create and manage promotional discount codes.' }
];`;

const startIdx = content.indexOf('export const INVENTORY_HOTSPOTS: Hotspot[] = [');
const endIdx = content.indexOf('interface GuidesScreenProps', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + replacement + '\n\n' + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Successfully updated hotspots in GuidesScreen.tsx');
} else {
  console.log('Could not find hotspots definition in GuidesScreen.tsx');
}
