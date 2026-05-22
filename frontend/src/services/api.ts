const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const getToken = () => localStorage.getItem('cf_token');
const setToken = (t: string) => localStorage.setItem('cf_token', t);
export const clearToken = () => localStorage.removeItem('cf_token');

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error ${res.status}`);
  }
  return res.json();
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
  },

  async changePassword(newPassword: string) {
    const data = await apiFetch<{ token: string }>('/api/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    });
    setToken(data.token);
  },

  logout() {
    clearToken();
  },
};

export const usersApi = {
  getAll: () => apiFetch<ApiUser[]>('/api/users'),
  create: (data: { email: string; name: string; role: string; isAdmin: boolean; allowedPanels: number[] }) =>
    apiFetch<ApiUser>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; role?: string; isAdmin?: boolean; allowedPanels?: number[] }) =>
    apiFetch<ApiUser>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string) =>
    apiFetch<{ message: string }>(`/api/users/${id}/reset-password`, { method: 'PATCH' }),
};

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  allowedPanels: number[];
  mustChangePassword: boolean;
}
