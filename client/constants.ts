
import { Product } from './types';

export const CURRENCY = '₦';

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Dangote Cement 50kg', category: 'Building', costPrice: 9000, sellingPrice: 10500, currentStock: 45, unit: 'Bag' },
  { id: '2', name: 'Golden Penny Pasta', category: 'Food', costPrice: 450, sellingPrice: 600, currentStock: 120, unit: 'Pack' },
  { id: '3', name: 'Peak Milk Tin', category: 'Food', costPrice: 800, sellingPrice: 950, currentStock: 15, unit: 'Tin' },
  { id: '4', name: 'Milo Sachet 20g', category: 'Food', costPrice: 150, sellingPrice: 200, currentStock: 500, unit: 'Sachet' },
  { id: '5', name: 'Haier Thermocool Fridge', category: 'Electronics', costPrice: 240000, sellingPrice: 285000, currentStock: 3, unit: 'Unit' },
];

export const CATEGORIES = ['Food', 'Building', 'Electronics', 'Clothing', 'Household', 'Others'];

export const THEME_COLORS = [
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Slate', value: '#475569' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Sky Blue', value: '#0ea5e9' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Deep Orange', value: '#f97316' },
  { name: 'Fuchsia', value: '#d946ef' },
];

export const FONTS = [
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Cursive', value: "'Dancing Script', cursive" },
  { name: 'Geometric (Rigid)', value: "'Montserrat', sans-serif" },
  { name: 'System', value: "system-ui, sans-serif" },
];