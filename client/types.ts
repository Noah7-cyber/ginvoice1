/* Updated: added 'expenditure' to TabId, and Expenditure type + expenditures array on InventoryState */
export type UserRole = 'owner' | 'staff';

export type TabId = 'sales' | 'inventory' | 'history' | 'dashboard' | 'settings' | 'expenditure';

export interface BusinessProfile {
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
  // staffPermissions may include tab ids and special permissions like 'stock-management'
  staffPermissions: (TabId | 'stock-management')[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;     // NOTE: client uses integers (kobo) when interacting with server
  sellingPrice: number;  // stored as integer kobo values when synced
  currentStock: number;
  unit: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'credit';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
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
}

/* New: Expenditure item stored locally */
export interface Expenditure {
  id: string;
  date: string;        // ISO string
  amount: number;      // in main currency units on client (e.g., Naira) but server expects integer kobo
  category?: string;
  note?: string;
  createdBy?: string;  // staff id or 'owner'
}

export interface InventoryState {
  products: Product[];
  transactions: Transaction[];
  role: UserRole;
  isLoggedIn: boolean;
  isRegistered: boolean;
  business: BusinessProfile;
  lastSyncedAt?: string;
  expenditures?: Expenditure[]; // added optional to preserve backwards compatibility
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