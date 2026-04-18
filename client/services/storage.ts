import { InventoryState } from '../types';
import { syncState } from './api';
import { enqueueSyncJob, getSyncJobs, incrementRetryCount, removeSyncJob } from './syncQueue';

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

export type SyncDomainVersions = {
  transactions: number;
  products: number;
  expenditures: number;
  categories: number;
};

const DOMAIN_VERSION_KEY = 'ginvoice_domain_versions';

export const getDomainVersions = (): SyncDomainVersions => {
  try {
    const raw = localStorage.getItem(DOMAIN_VERSION_KEY);
    if (!raw) return { transactions: 0, products: 0, expenditures: 0, categories: 0 };
    const parsed = JSON.parse(raw);
    return {
      transactions: Number.isFinite(Number(parsed?.transactions)) ? Number(parsed.transactions) : 0,
      products: Number.isFinite(Number(parsed?.products)) ? Number(parsed.products) : 0,
      expenditures: Number.isFinite(Number(parsed?.expenditures)) ? Number(parsed.expenditures) : 0,
      categories: Number.isFinite(Number(parsed?.categories)) ? Number(parsed.categories) : 0
    };
  } catch (err) {
    return { transactions: 0, products: 0, expenditures: 0, categories: 0 };
  }
};

export const saveDomainVersions = (versions: Partial<SyncDomainVersions>) => {
  const current = getDomainVersions();
  const next: SyncDomainVersions = {
    transactions: Number.isFinite(Number(versions.transactions)) ? Number(versions.transactions) : current.transactions,
    products: Number.isFinite(Number(versions.products)) ? Number(versions.products) : current.products,
    expenditures: Number.isFinite(Number(versions.expenditures)) ? Number(versions.expenditures) : current.expenditures,
    categories: Number.isFinite(Number(versions.categories)) ? Number(versions.categories) : current.categories
  };
  localStorage.setItem(DOMAIN_VERSION_KEY, JSON.stringify(next));
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
    localStorage.removeItem(DOMAIN_VERSION_KEY);
  } catch (err) {
    console.warn('clearLocalData failed', err);
  }
};

let flushInFlight: Promise<void> | null = null;

export const flushPendingSyncQueue = async () => {
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const jobs = await getSyncJobs();
    for (const job of jobs) {
      if (!job.id) continue;
      try {
        await syncState(job.payload);
        await removeSyncJob(job.id);
      } catch (err: any) {
        await incrementRetryCount(job.id, Number(job.retryCount || 0));
        throw err;
      }
    }
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
};

export const hasPendingSyncJobs = async (): Promise<boolean> => {
  const jobs = await getSyncJobs();
  return jobs.length > 0;
};

export type PendingSyncJobView = {
  id: number;
  createdAt: string;
  retryCount: number;
  transactionId?: string;
  totalAmount?: number;
};

export const listPendingSyncJobs = async (): Promise<PendingSyncJobView[]> => {
  const jobs = await getSyncJobs();
  return jobs
    .filter((job) => Boolean(job.id))
    .map((job) => ({
      id: Number(job.id),
      createdAt: job.createdAt,
      retryCount: Number(job.retryCount || 0),
      transactionId: job.payload?.transactions?.[0]?.id || job.payload?.transactions?.[0]?.transactionId,
      totalAmount: Number(job.payload?.transactions?.[0]?.totalAmount || 0)
    }));
};

export const getPendingTransactionIds = async (): Promise<Set<string>> => {
  const jobs = await getSyncJobs();
  const ids = new Set<string>();
  for (const job of jobs) {
    const txs = Array.isArray(job?.payload?.transactions) ? job.payload.transactions : [];
    for (const tx of txs) {
      const id = String(tx?.transactionId || tx?.id || '').trim();
      if (id) ids.add(id);
    }
  }
  return ids;
};

export const syncPendingJobsWithProgress = async (
  onProgress?: (info: { total: number; processed: number; succeeded: number; failed: number; currentJobId?: number }) => void
) => {
  const jobs = await getSyncJobs();
  const total = jobs.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const failedJobIds: number[] = [];

  for (const job of jobs) {
    const jobId = Number(job.id || 0);
    try {
      await syncState(job.payload);
      if (jobId) await removeSyncJob(jobId);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      if (jobId) {
        await incrementRetryCount(jobId, Number(job.retryCount || 0));
        failedJobIds.push(jobId);
      }
    } finally {
      processed += 1;
      onProgress?.({ total, processed, succeeded, failed, currentJobId: jobId || undefined });
    }
  }

  return { total, processed, succeeded, failed, failedJobIds };
};

// --- THE CRITICAL EXPORT ---
// This was missing/renamed in snippets, causing frontend crash.
export const pushToBackend = async (payload: any) => {
  try {
    await flushPendingSyncQueue();
    const res = await syncState(payload);
    return res;
  } catch (err) {
    try {
      await enqueueSyncJob(payload);
    } catch (queueErr) {
      console.error('Queue save failed', queueErr);
    }
    console.error('Push failed (queued for retry)', err);
    throw err;
  }
};
