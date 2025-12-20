import { InventoryState, BusinessProfile } from '../types';

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
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || 'Request failed';
    const err = new Error(message) as Error & { status?: number; data?: any };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

export const login = async (email: string, pin: string) => {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, pin })
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
