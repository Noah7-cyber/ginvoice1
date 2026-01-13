/* Updated: added 'expenditure' to TabId, and Expenditure type + expenditures array on InventoryState */
export type UserRole = 'owner' | 'staff';

export type TabId = 'sales' | 'inventory' | 'history' | 'dashboard' | 'settings' | 'expenditure';

export interface BusinessProfile {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  logo?: string; // Base64 encoded image
  ownerPassword?: string;
  staffPassword?: string;
  trialEndsAt?: string;
  theme: {
    primaryColor: string;
    fontFamily: string;
  };
  // New Permissions Object
  staffPermissions: {
    canGiveDiscount: boolean;
    canViewInventory: boolean;  // Replaces canManageStock
    canEditInventory: boolean;
    canViewHistory: boolean;
    canEditHistory: boolean;
    canViewExpenditure: boolean;
    canViewDashboard: boolean;
  };

  settings: {
    currency: string;
    taxRate: number;
    lowStockThreshold: number;
    enableSound: boolean;
    printReceipts: boolean;
    footerText: string;
  };
}

export interface DiscountCode {
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  isUsed: boolean;
  expiryDate?: string;
  scope: 'global' | 'product';
  productId?: string;
}

export interface ProductUnit {
  name: string;
  multiplier: number;
  sellingPrice: number;
  costPrice?: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;     // NOTE: client uses integers (kobo) when interacting with server
  sellingPrice: number;  // stored as integer kobo values when synced
  currentStock: number;
  baseUnit: string;      // Renamed from 'unit'
  units: ProductUnit[];  // Alternative units (e.g., Packs)
  isManualUpdate?: boolean; // Flag to indicate if stock was manually adjusted
}

export type PaymentMethod = 'cash' | 'transfer' | 'credit';

export interface SaleItem {
  cartId: string; // Unique ID for cart management
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  selectedUnit?: ProductUnit; // Track which unit was sold
}

export interface Transaction {
  id: string;
  transactionDate: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  globalDiscount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  balance: number;
  signature?: string;
  isSignatureLocked?: boolean;
  staffId: string;
  createdAt?: string;
  updatedAt?: string;
}

/* New: Expenditure item stored locally */
export interface Expenditure {
  id: string;
  date: string;        // ISO string
  amount: number;      // in main currency units on client (e.g., Naira) but server expects integer kobo
  category?: string;
  title?: string;
  description?: string;
  paymentMethod?: string;
  note?: string;
  createdBy?: string;  // staff id or 'owner'
  updatedAt?: string;
  createdAt?: string;
}

export interface InventoryState {
  products: Product[];
  transactions: Transaction[];
  categories?: Category[]; // Added for sync
  role: UserRole;
  isLoggedIn: boolean;
  isRegistered: boolean;
  business: BusinessProfile;
  lastSyncedAt?: string;
  expenditures?: Expenditure[]; // added optional to preserve backwards compatibility
}

export interface Category {
  id: string; // MongoDB _id
  name: string;
  defaultSellingPrice: number;
  defaultCostPrice: number;
}

export interface CartState {
  items: SaleItem[];
  customerName: string;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  globalDiscount: number;
  isGlobalDiscountPercent: boolean;
  signature: string;
  isLocked: boolean;
}
