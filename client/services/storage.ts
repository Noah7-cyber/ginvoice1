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
  const parsed = v ? parseFloat(v) : 0;
  return Number.isFinite(parsed) ? Number(parsed.toFixed(3)) : 0;
};

export const saveDataVersion = (version: number) => {
  const safe = Number.isFinite(version) ? Number(version.toFixed(3)) : 0;
  localStorage.setItem('ginvoice_data_version', safe.toString());
};

export const getLastSync = (): Date | null => {
  const t = localStorage.getItem('ginvoice_last_sync_time');
  return t ? new Date(t) : null;
};

export const clearLocalData = () => {
  try {
    localStorage.removeItem('ginvoice_v1_state');
    localStorage.removeItem('ginvoice_last_sync_time');
    localStorage.removeItem('ginvoice_data_version');
  } catch (err) {
    console.warn('clearLocalData failed', err);
  }
};

// --- THE CRITICAL EXPORT ---
// This was missing/renamed in snippets, causing frontend crash.
export const pushToBackend = async (payload: any) => {
  try {
    const lastSyncTime = getLastSync();
    const thresholdTime = lastSyncTime ? lastSyncTime.getTime() - 5 * 60 * 1000 : Date.now() - 24 * 60 * 60 * 1000;

    const isNewItem = (item: any) => String(item.id).includes('-');
    const isRecentlyUpdated = (item: any) => new Date(item.updatedAt).getTime() > thresholdTime;
    const shouldKeep = (item: any) => isNewItem(item) || isRecentlyUpdated(item);

    const deltaPayload = {
      ...payload,
      transactions: payload.transactions?.filter(shouldKeep) || [],
      products: payload.products?.filter(shouldKeep) || [],
      expenditures: payload.expenditures?.filter(shouldKeep) || [],
    };

    const res = await syncState(deltaPayload);
    return res;
  } catch (err) {
    console.error('Push failed', err);
    throw err;
  }
};
