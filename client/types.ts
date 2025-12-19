
export type UserRole = 'owner' | 'staff';

export type TabId = 'sales' | 'inventory' | 'history' | 'dashboard' | 'settings';

export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  email?: string;
  theme: {
    primaryColor: string;
    fontFamily: string;
  };
  staffPermissions: TabId[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
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

export interface InventoryState {
  products: Product[];
  transactions: Transaction[];
  role: UserRole;
  isLoggedIn: boolean;
  isRegistered: boolean;
  business: BusinessProfile;
  lastSyncedAt?: string;
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
