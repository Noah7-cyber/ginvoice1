import { InventoryState } from '../types';
import { syncState } from './api';

const STORAGE_KEY = 'ginvoice_v1_state';

// --- Local Storage Helpers (Keep for UI State) ---
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
    // Sanitization
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

export const saveLastSync = (time: Date | null) => {
  if (time) localStorage.setItem('ginvoice_last_sync_time', time.toISOString());
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

// --- THE CRITICAL EXPORT ---
// This was missing/renamed in snippets, causing frontend crash.
export const pushToBackend = async (payload: any) => {
  try {
    const res = await syncState(payload);
    return res;
  } catch (err) {
    console.error('Push failed', err);
    throw err;
  }
};
