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
    // Prepare a minimal sync payload to reduce payload size
    // Corrected to use full keys as expected by the server
    const payload = {
      products: state.products,
      transactions: state.transactions,
      expenditures: state.expenditures || [],
      business: state.business,
      lastSyncedAt: state.lastSyncedAt || null
    };
    const res = await syncState(payload as any);
    // server returns { syncedAt, products, transactions, expenditures }
    // We standardize on 'lastSyncedAt' for the frontend state key, but server sends 'syncedAt'
    if (res && res.syncedAt) {
      return {
        lastSyncedAt: res.syncedAt,
        products: res.products,
        transactions: res.transactions,
        expenditures: res.expenditures
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
