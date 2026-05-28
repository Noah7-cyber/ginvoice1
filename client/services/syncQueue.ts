const DB_NAME = 'ginvoice-sync-queue';
const STORE_NAME = 'jobs';
const DB_VERSION = 1;

export interface SyncJob {
  id?: number;
  payload: any;
  createdAt: string;
  retryCount: number;
}

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await fn(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
};

const requestToPromise = <T = any>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const enqueueSyncJob = async (payload: any) => {
  const job: SyncJob = {
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0
  };
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.add(job));
  });
};

export const getSyncJobs = async (): Promise<SyncJob[]> => {
  return withStore('readonly', async (store) => {
    const all = await requestToPromise<SyncJob[]>(store.getAll());
    return (all || []).sort((a, b) => (a.id || 0) - (b.id || 0));
  });
};

export const removeSyncJob = async (id: number) => {
  return withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });
};

export const incrementRetryCount = async (id: number, retryCount: number) => {
  return withStore('readwrite', async (store) => {
    const current = await requestToPromise<any>(store.get(id));
    if (!current) return;
    current.retryCount = retryCount + 1;
    await requestToPromise(store.put(current));
  });
};
