import { InventoryState, BusinessProfile, Product } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
const TOKEN_KEY = 'ginvoice_auth_token_v1';

const buildUrl = (path: string) => {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

export const saveAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const loadAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

const request = async (path: string, options: RequestInit = {}) => {
  let res;
  try {
    res = await fetch(buildUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (networkErr) {
    console.error('[API] Network request failed:', networkErr);
    throw networkErr;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[API] Request returned error status:', res.status, data);
    const message = data?.message || 'Request failed';
    const err = new Error(message) as Error & { status?: number; data?: any };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

export const login = async (email: string, pin: string, role?: string) => {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, pin, role })
  });
};

export const registerBusiness = async (payload: {
  name: string;
  email?: string;
  phone: string;
  address: string;
  ownerPassword: string;
  staffPassword: string;
  logo?: string;
  theme: BusinessProfile['theme'];
}) => {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const requestPasswordReset = async (email: string) => {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
};

export const resetPassword = async (email: string, code: string, newOwnerPin: string) => {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newOwnerPin })
  });
};

export const syncState = async (state: InventoryState) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(state)
  });
};

export const fetchRemoteState = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/sync', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const uploadFile = async (file: File): Promise<string> => {
  const token = loadAuthToken();
  if (!token) throw new Error('No auth token');

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(buildUrl('/api/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // Don't set Content-Type for FormData
    body: formData
  });

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.url;
};

export const deleteAccount = async (businessName: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/auth/delete-account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ businessName })
  });
};

export const deleteExpenditure = async (id: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/sync/expenditures/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const updateExpenditure = async (expenditure: any) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/expenditures/${expenditure.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(expenditure)
  });
};

// NEW: Helper for creating a single product via Sync
export const createProduct = async (product: Product) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ products: [product] })
  });
};

// NEW: Helper for updating a single product via Sync
export const updateProduct = async (product: Product) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ products: [product] })
  });
};

const api = {
  get: async (url: string) => {
    const token = loadAuthToken();
    return request(`/api${url}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  post: async (url: string, body: any) => {
    const token = loadAuthToken();
    return request(`/api${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  }
};

export default api;

export const checkSyncAccess = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/sync/check', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const changeBusinessPins = async (currentOwnerPin: string, newStaffPin?: string, newOwnerPin?: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/auth/change-pins', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ currentOwnerPin, newStaffPin, newOwnerPin })
  });
};

export const getAnalytics = async (range?: '7d' | '30d' | '1y') => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  const query = range ? `?range=${range}` : '';
  return request(`/api/analytics${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const getEntitlements = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/entitlements', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const verifyPayment = async (reference: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/payments/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reference })
  });
};

export const initializePayment = async (amount: number, email: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token. Please login again.');

  try {
    return await request('/api/payments/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ amount, email })
    });
  } catch (err: any) {
    if (err.status === 401) {
      throw new Error('Session expired. Please login again.');
    }
    throw err;
  }
};

export const deleteProduct = async (id: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/sync/products/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const deleteTransaction = async (id: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/sync/transactions/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};
