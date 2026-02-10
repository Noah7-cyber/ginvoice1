import { InventoryState, BusinessProfile, Product, Category, DiscountCode } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
const TOKEN_KEY = 'ginvoice_auth_token_v1';
const ADMIN_TOKEN_KEY = 'ginvoice_admin_token_v1';

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

// Admin Token Helpers
export const saveAdminToken = (token: string) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
};

export const loadAdminToken = (): string | null => {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
};

export const clearAdminToken = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
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

    // Global Handling for Permission/Auth Issues
    if (res.status === 401 || res.status === 403) {
       if (message.includes('Permissions updated') || message.includes('Session expired')) {
           window.dispatchEvent(new CustomEvent('auth:force-reload', { detail: { message } }));
       }
    }

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

// NEW: Verify OTP
export const verifyEmailCode = async (email: string, code: string) => {
  return request('/api/auth/verify-email-code', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  });
};

export const resetPassword = async (email: string, code: string, newOwnerPin: string) => {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newOwnerPin })
  });
};

// NEW: Resend Verification Email
export const resendVerification = async (email: string) => {
  return request('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
};

// NEW: Check Verification Status
export const checkVerificationStatus = async (email: string) => {
  return request('/api/auth/verification-status', {
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

// Updated: supports forceFull mode to ignore versions and get full state
export const fetchRemoteState = async (forceFull = false) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  // If forceFull is true, send NO query params to trigger server legacy fallback
  const query = forceFull ? '' : new URLSearchParams({
    version: '0',
    lastSync: ''
  }).toString();

  const url = buildUrl(`/api/sync${query ? `?${query}` : ''}`);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 204) {
        // Should not happen with forceFull=true as server always returns data
        return { status: 204 };
    }

    if (!res.ok) {
        throw new Error('Sync failed');
    }

    const data = await res.json();
    return { status: 200, data };
  } catch (err) {
    console.error('Fetch remote state error', err);
    throw err;
  }
};

export const updateSettings = async (settings: Partial<BusinessProfile['settings']>, staffPermissions?: Partial<BusinessProfile['staffPermissions']>) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settings, staffPermissions })
  });
};

export const updateBusinessProfile = async (profile: Partial<BusinessProfile>) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile)
  });
};

export const generateDiscountCode = async (payload: { type: 'fixed' | 'percent', value: number, scope: 'global' | 'product', productId?: string, expiryDate?: string }) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/discounts/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
};

export const validateDiscountCode = async (code: string, cartItems: any[]) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/discounts/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, cartItems })
  });
};

export const getCategories = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/categories', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const createCategory = async (category: Partial<Category>) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(category)
  });
};

export const updateCategory = async (id: string, category: Partial<Category>) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/categories/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(category)
  });
};

export const deleteCategory = async (id: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
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

export const sendChat = async (message: string, history: any[]) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/support/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message, history })
  });
};

// Admin API
export const adminLogin = async (email: string, password: string) => {
    return request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
};

export const getAdminStats = async () => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request('/api/admin/stats', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const getAdminUsers = async (page = 1, search = '') => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request(`/api/admin/users?page=${page}&search=${search}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const getAdminUserDetails = async (id: string) => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request(`/api/admin/users/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const updateUserAdmin = async (id: string, data: any) => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
};

export const deleteUserAdmin = async (id: string) => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const grantSubscriptionAdmin = async (id: string, days: number) => {
  const token = loadAdminToken();
  if (!token) throw new Error('Missing admin token');
  return request(`/api/admin/users/${id}/grant-subscription`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ days })
  });
};

export const cancelSubscription = async (reason: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/payments/subscription/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason })
  });
};

export const pauseSubscription = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/payments/subscription/pause', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const resumeSubscription = async () => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/payments/subscription/resume', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const settleTransaction = async (id: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/transactions/${id}/settle`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const getBusinessCount = async () => {
  return request('/api/stats/business-count', {
    method: 'GET'
  });
};

export const contactSupport = async (message: string, email: string, businessName: string) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request('/api/support/contact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ message, email, businessName })
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
  },

  put: async (url: string, body: any) => {
    const token = loadAuthToken();
    return request(`/api${url}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },

  delete: async (url: string) => {
    const token = loadAuthToken();
    return request(`/api${url}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
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

export const deleteTransaction = async (id: string, restock: boolean) => {
  const token = loadAuthToken();
  if (!token) throw new Error('Missing auth token');

  return request(`/api/sync/transactions/${id}?restock=${restock}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};
