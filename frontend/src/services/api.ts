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

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface ApiFolder {
  id: string;
  name: string;
  type: 'carrera' | 'licencia';
  parentId: string | null;
  createdAt: string;
}

export const foldersApi = {
  getAll: () => apiFetch<ApiFolder[]>('/api/folders'),
  create: (data: { name: string; type: 'carrera' | 'licencia'; parentId?: string | null }) =>
    apiFetch<ApiFolder>('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; parentId?: string | null }) =>
    apiFetch<ApiFolder>(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/folders/${id}`, { method: 'DELETE' }),
};

// ─── Courses ─────────────────────────────────────────────────────────────────

export interface ApiCourse {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: string;
}

export const coursesApi = {
  getAll: () => apiFetch<ApiCourse[]>('/api/courses'),
  create: (data: { name: string; folderId?: string | null }) =>
    apiFetch<ApiCourse>('/api/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; folderId?: string | null }) =>
    apiFetch<ApiCourse>(`/api/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/courses/${id}`, { method: 'DELETE' }),
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

export interface ApiRow {
  id: string;
  courseId: string;
  sortOrder: number;
  materia: string;
  modulo: string;
  descripcion: string;
  formato: string;
  links: string;
  fileName: string | null;
  fileType: string | null;
  fileUrl: string | null;
  estado: string;
  videoDrive: string;
  videoVimeo: string;
  videoSubtitulos: string;
  geniallyUrl: string;
  geniallyLinkStatus: string;
  geniallyTextoStatus: string;
  geniallyDisenoStatus: string;
  estadoMultimedia: string;
  aprobacionContenido: string;
  aprobacionMultimedia: string;
  comentariosRevisor: string;
  estadoFinal: string;
}

export const rowsApi = {
  getAll: (courseId: string) =>
    apiFetch<ApiRow[]>(`/api/courses/${courseId}/rows`),
  create: (courseId: string, data: Partial<ApiRow>) =>
    apiFetch<ApiRow>(`/api/courses/${courseId}/rows`, { method: 'POST', body: JSON.stringify(data) }),
  update: (courseId: string, rowId: string, data: Partial<ApiRow>) =>
    apiFetch<ApiRow>(`/api/courses/${courseId}/rows/${rowId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (courseId: string, rowId: string) =>
    apiFetch<{ message: string }>(`/api/courses/${courseId}/rows/${rowId}`, { method: 'DELETE' }),
  reorder: (courseId: string, orderedIds: string[]) =>
    apiFetch<{ message: string }>(`/api/courses/${courseId}/rows/reorder`, { method: 'PATCH', body: JSON.stringify({ orderedIds }) }),
  renameMateria: (courseId: string, oldName: string, newName: string) =>
    apiFetch<{ message: string }>(`/api/courses/${courseId}/materia`, { method: 'PATCH', body: JSON.stringify({ oldName, newName }) }),
  renameModulo: (courseId: string, oldName: string, newName: string) =>
    apiFetch<{ message: string }>(`/api/courses/${courseId}/modulo`, { method: 'PATCH', body: JSON.stringify({ oldName, newName }) }),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface ApiTask {
  id: string;
  title: string;
  description: string;
  courseId: string | null;
  courseName: string | null;
  rowId: string | null;
  rowNro: string | null;
  rowModulo: string | null;
  panelName: string;
  createdBy: string;
  createdByName: string;
  assignedTo: string;
  assignedToName: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

export const tasksApi = {
  getAll: () => apiFetch<ApiTask[]>('/api/tasks'),
  create: (data: {
    title: string;
    description?: string;
    courseId?: string | null;
    courseName?: string | null;
    rowId?: string | null;
    rowNro?: string | null;
    rowModulo?: string | null;
    panelName: string;
    createdByName?: string;
    assignedTo: string;
    assignedToName: string;
    dueDate?: string | null;
  }) => apiFetch<ApiTask>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ApiTask>) =>
    apiFetch<ApiTask>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cycleStatus: (id: string) =>
    apiFetch<ApiTask>(`/api/tasks/${id}/status`, { method: 'PATCH' }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

// ─── Library ──────────────────────────────────────────────────────────────────

export interface ApiLibraryItem {
  id: string;
  descripcion: string;
  formato: string;
  links: string;
  fileName: string | null;
  fileType: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export const libraryApi = {
  getAll: () => apiFetch<ApiLibraryItem[]>('/api/library'),
  create: (data: {
    descripcion: string;
    formato: string;
    links?: string;
    fileName?: string | null;
    fileType?: string | null;
    fileUrl?: string | null;
  }) => apiFetch<ApiLibraryItem>('/api/library', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/library/${id}`, { method: 'DELETE' }),
  assign: (id: string, data: { courseId: string; materia: string; modulo: string }) =>
    apiFetch<ApiRow>(`/api/library/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
};
