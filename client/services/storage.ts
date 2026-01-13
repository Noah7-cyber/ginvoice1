// storage.ts - local persistence and syncWithBackend
import { InventoryState } from '../types';
import { syncState } from './api';

// Use localStorage for simplicity; can upgrade to IndexedDB for larger data sets.
const STORAGE_KEY = 'ginvoice_v1_state';

export const saveState = (state: InventoryState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('saveState failed', err);
  }
};

export const getDataVersion = (): number => {
  const v = localStorage.getItem('ginvoice_data_version');
  return v ? parseInt(v) : 0;
};

export const saveDataVersion = (version: number) => {
  localStorage.setItem('ginvoice_data_version', version.toString());
};

export const getLastSync = (): Date | null => {
  const t = localStorage.getItem('ginvoice_last_sync_time');
  return t ? new Date(t) : null;
};

export const saveLastSync = (time: Date) => {
  localStorage.setItem('ginvoice_last_sync_time', time.toISOString());
};

export const loadState = (): InventoryState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as InventoryState;

    // Data Sanitization: Ensure products have valid numeric fields
    if (state.products) {
      state.products = state.products.map(p => ({
        ...p,
        sellingPrice: typeof p.sellingPrice === 'number' ? p.sellingPrice : 0,
        costPrice: typeof p.costPrice === 'number' ? p.costPrice : 0,
        currentStock: typeof p.currentStock === 'number' ? p.currentStock : 0
      }));
    }

    return state;
  } catch (err) {
    console.warn('loadState failed', err);
    return null;
  }
};

/*
 syncWithBackend(state)
 - Posts local state to server /api/sync
 - Server returns merged state (or partial update); we return lastSyncedAt value or null.
 - We include expenditures in the sync payload.
*/
export const syncWithBackend = async (state: InventoryState) => {
  try {
    const lastSyncedAt = state.lastSyncedAt ? new Date(state.lastSyncedAt) : null;

    // Filter payload: Only send items modified after lastSyncedAt
    const products = lastSyncedAt
      ? state.products.filter(p => !p.updatedAt || new Date(p.updatedAt) > lastSyncedAt)
      : state.products;

    const transactions = lastSyncedAt
      ? state.transactions.filter(t => !t.createdAt || new Date(t.createdAt) > lastSyncedAt)
      : state.transactions;

    const expenditures = lastSyncedAt
      ? (state.expenditures || []).filter(e => !e.updatedAt || new Date(e.updatedAt) > lastSyncedAt) // Assuming expenditures have updatedAt locally? If not, send all or check logic
      : (state.expenditures || []);

    // Prepare a minimal sync payload to reduce payload size
    // Corrected to use full keys as expected by the server
    const payload = {
      products,
      transactions,
      expenditures,
      business: state.business,
      lastSyncedAt: state.lastSyncedAt || null
    };
    const res = await syncState(payload as any);
    // server returns { syncedAt, products, transactions, expenditures, business }
    // We standardize on 'lastSyncedAt' for the frontend state key, but server sends 'syncedAt'
    if (res && res.syncedAt) {
      const nextBusiness = res.business ? {
        ...state.business,
        ...res.business, // Only updates Name, Email, Phone, Address
        // CRITICAL: Preserve local Theme, Logo, and Permissions
        theme: state.business.theme,
        logo: state.business.logo,
        staffPermissions: state.business.staffPermissions
      } : state.business;

      return {
        lastSyncedAt: res.syncedAt,
        products: res.products,
        transactions: res.transactions,
        expenditures: res.expenditures,
        business: nextBusiness
      };
    }
    return null;
  } catch (err) {
    console.warn('syncWithBackend failed', err);
    return null;
  }
};

/*
  We intentionally do not auto-sync on every local change while online.
  The App now triggers sync only on offline->online transitions.
  The client can still call syncWithBackend manually (e.g., owner clicks sync).
*/
