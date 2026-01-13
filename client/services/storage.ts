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

export const saveLastSync = (time: Date | null) => {
  if (time) {
    localStorage.setItem('ginvoice_last_sync_time', time.toISOString());
  } else {
    localStorage.removeItem('ginvoice_last_sync_time');
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

// Simplified pushToBackend - Send exactly what is passed.
export const pushToBackend = async (payload: any) => {
  try {
    const res = await syncState(payload);
    return res;
  } catch (err) {
    console.error('Push failed', err);
    throw err;
  }
};
