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
    return JSON.parse(raw) as InventoryState;
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
    const payload = {
      p: state.products,        // keep keys short on server; client sends full product objects
      t: state.transactions,
      e: state.expenditures || [],
      b: state.business,
      lastSyncedAt: state.lastSyncedAt || null
    };
    const res = await syncState(payload as any); // server expects the compact payload
    // server returns maybe { lastSyncedAt, products, transactions, expenditures }
    if (res && res.lastSyncedAt) return res.lastSyncedAt;
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