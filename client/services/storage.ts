
import { InventoryState } from '../types';
import { syncState, loadAuthToken } from './api';

const STORAGE_KEY = 'ginvoice_data_v1';

export const saveState = (state: InventoryState) => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
    
    // Auto-sync attempt if online happens in App.tsx via useEffect or network listeners
  } catch (err) {
    console.error('Could not save state', err);
  }
};

export const loadState = (): InventoryState | undefined => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      return undefined;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    console.error('Could not load state', err);
    return undefined;
  }
};

/**
 * Triggers a full sync of local data to the backend.
 * Returns the timestamp of successful sync.
 */
export const syncWithBackend = async (state: InventoryState): Promise<string | null> => {
  if (!navigator.onLine) return null;
  if (!loadAuthToken()) return null;

  try {
    console.log('📡 ', {
      business: state.business.name,
      transactions: state.transactions.length,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Push full offline state to backend
    await syncState(state);
    
    return new Date().toISOString();
  } catch (e) {
    console.error('Sync failed', e);
    return null;
  }
};
