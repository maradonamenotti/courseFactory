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
  async getMe() {
    return apiFetch<ApiUser>('/api/auth/me');
  },

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

  async googleLogin(idToken?: string, accessToken?: string) {
    const data = await apiFetch<{ token: string; user: ApiUser }>('/api/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({ idToken, accessToken }),
    });
    setToken(data.token);
    return data.user;
  },

  logout() {
    clearToken();
  },
};

export const usersApi = {
  getAll: () => apiFetch<ApiUser[]>('/api/users'),
  create: (data: { email: string; name: string; role: string; isAdmin: boolean; canEdit: boolean; canDelete: boolean; allowedPanels: number[] }) =>
    apiFetch<ApiUser>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; role?: string; isAdmin?: boolean; canEdit?: boolean; canDelete?: boolean; allowedPanels?: number[] }) =>
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
  canEdit: boolean;
  canDelete: boolean;
  allowedPanels: number[];
  mustChangePassword: boolean;
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface ApiFolder {
  id: string;
  name: string;
  type: 'carrera' | 'licencia';
  parentId: string | null;
  year: string | null;
  isOfficial: boolean | null;
  color: string | null;
  createdAt: string;
}

export const foldersApi = {
  getAll: () => apiFetch<ApiFolder[]>('/api/folders'),
  create: (data: { name: string; type: 'carrera' | 'licencia'; parentId?: string | null; year?: string | null; isOfficial?: boolean | null; color?: string | null }) =>
    apiFetch<ApiFolder>('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; parentId?: string | null; year?: string | null; isOfficial?: boolean | null; color?: string | null }) =>
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
  languages?: string;
}

export const coursesApi = {
  getAll: () => apiFetch<ApiCourse[]>('/api/courses'),
  create: (data: { name: string; folderId?: string | null }) =>
    apiFetch<ApiCourse>('/api/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; folderId?: string | null; languages?: string }) =>
    apiFetch<ApiCourse>(`/api/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/courses/${id}`, { method: 'DELETE' }),

  // Descarga el CSV del curso directamente en el browser
  async exportCsv(courseId: string, courseName: string) {
    const token = getToken();
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await fetch(`${BASE}/api/courses/${courseId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Error ${res.status} al exportar el curso`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${courseName}_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ─── Rows ─────────────────────────────────────────────────────────────────────

export interface ApiRow {
  id: string;
  courseId: string;
  sortOrder: number;
  materia: string;
  modulo: string;
  moduloNumero: string | null;
  descripcion: string;
  formato: string;
  links: string;
  fileName: string | null;
  fileType: string | null;
  fileUrl: string | null;
  htmlContent: string | null;
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
  generatedHtml: string | null;
  aprobacionDiseno: string;
  aprobacionTraduccion: string;
  googleFileId: string | null;
  googleLastSyncedAt: string | null;
  googleModifiedTime: string | null;
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
  setModuloNumero: (courseId: string, moduloName: string, numero: string | null) =>
    apiFetch<{ message: string }>(`/api/courses/${courseId}/modulo-numero`, { method: 'PATCH', body: JSON.stringify({ moduloName, numero }) }),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

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
  getPaginated: (params?: {
    page?: number;
    limit?: number;
    courseId?: string;
    assignedTo?: string;
    status?: string;
    panelName?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.courseId) q.set('courseId', params.courseId);
    if (params?.assignedTo) q.set('assignedTo', params.assignedTo);
    if (params?.status) q.set('status', params.status);
    if (params?.panelName) q.set('panelName', params.panelName);
    return apiFetch<PaginatedResponse<ApiTask>>(`/api/tasks/paginated?${q.toString()}`);
  },
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
  videoDrive?: string | null;
  videoVimeo?: string | null;
  videoSubtitulos?: string | null;
  createdAt: string;
}

export const libraryApi = {
  getAll: () => apiFetch<ApiLibraryItem[]>('/api/library'),
  getPaginated: (params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return apiFetch<PaginatedResponse<ApiLibraryItem>>(`/api/library/paginated?${q.toString()}`);
  },
  create: (data: {
    descripcion: string;
    formato: string;
    links?: string;
    fileName?: string | null;
    fileType?: string | null;
    fileUrl?: string | null;
    videoDrive?: string | null;
    videoVimeo?: string | null;
    videoSubtitulos?: string | null;
  }) => apiFetch<ApiLibraryItem>('/api/library', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/library/${id}`, { method: 'DELETE' }),
  assign: (id: string, data: { courseId: string; materia: string; modulo: string }) =>
    apiFetch<ApiRow>(`/api/library/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Files (Cloudinary) ───────────────────────────────────────────────────────

export interface ApiUploadResult {
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
}

export interface ApiUploadDocxResult {
  htmlContent: string;
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
}

export interface ApiImportDriveResult {
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
  htmlContent: string | null;
  googleFileId: string;
  googleModifiedTime: string;
}

export const filesApi = {
  /**
   * Sube un archivo a Cloudinary vía el backend.
   * Usa FormData (multipart/form-data) — NO incluir Content-Type manual.
   */
  upload: async (file: File): Promise<ApiUploadResult> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE}/api/files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // NO Content-Type aquí — el browser lo pone automáticamente con el boundary
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Error ${res.status}`);
    }
    return res.json() as Promise<ApiUploadResult>;
  },

  uploadDocx: async (file: File): Promise<ApiUploadDocxResult> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE}/api/files/upload-docx`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Error ${res.status}`);
    }
    return res.json() as Promise<ApiUploadDocxResult>;
  },

  importDrive: async (fileId: string, oauthToken: string): Promise<ApiImportDriveResult> => {
    return apiFetch<ApiImportDriveResult>('/api/files/import-drive', {
      method: 'POST',
      body: JSON.stringify({ fileId, oauthToken }),
    });
  },

  delete: (publicId: string) =>
    apiFetch<{ message: string }>(`/api/files/${encodeURIComponent(publicId)}`, { method: 'DELETE' }),
};

// ─── Systems (Gemini AI) ──────────────────────────────────────────────────────

export const systemsApi = {
  /**
   * Genera HTML con Gemini AI delegando al backend.
   * La API key nunca sale del servidor.
   */
  generateHtml: (data: { moduleName: string; rows: any[]; template: any }) =>
    apiFetch<{ html: string }>('/api/systems/generate-html', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Publica el HTML en Moodle delegando al backend.
   */
  publishMoodle: (data: { html: string; courseName: string; courseCode: string }) =>
    apiFetch<{ success: boolean; moodleResponse?: any }>('/api/systems/publish-moodle', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─── Vimeo ────────────────────────────────────────────────────────────────────

export interface ApiVimeoUploadResult {
  videoId: string;
  uri: string;
  embedUrl: string;   // https://player.vimeo.com/video/123456
  link: string;       // https://vimeo.com/123456
  status: string;
}

export interface ApiVimeoStatus {
  videoId: string;
  status: string;     // 'complete' | 'in_progress' | 'error'
  link: string;
  embedUrl: string;
}

export const vimeoApi = {
  /**
   * Sube un archivo de video a Vimeo vía el backend.
   * El backend usa TUS protocol para el upload resumable.
   */
  upload: async (file: File, name?: string, description?: string): Promise<ApiVimeoUploadResult> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('video', file);
    if (name) formData.append('name', name);
    if (description) formData.append('description', description);

    const res = await fetch(`${BASE}/api/vimeo/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || `Error ${res.status}`);
    }
    return res.json() as Promise<ApiVimeoUploadResult>;
  },

  getStatus: (videoId: string) =>
    apiFetch<ApiVimeoStatus>(`/api/vimeo/status/${videoId}`),
};

// ─── History API ─────────────────────────────────────────────────────────────

export interface ApiRowHistory {
  id: string;
  rowId: string;
  courseId: string;
  userId: string;
  userName: string;
  changedFields: string[];
  description: string;
  panel: number;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export const historyApi = {
  getRowHistory: (courseId: string, rowId: string) =>
    apiFetch<ApiRowHistory[]>(`/api/courses/${courseId}/rows/${rowId}/history`),

  getCourseHistory: (courseId: string) =>
    apiFetch<ApiRowHistory[]>(`/api/courses/${courseId}/history`),

  restore: (courseId: string, rowId: string, historyId: string) =>
    apiFetch<unknown>(`/api/courses/${courseId}/rows/${rowId}/history/${historyId}/restore`, {
      method: 'POST',
    }),
};

export const reportsApi = {
  getDashboard: () => apiFetch<any>('/api/reports/dashboard'),
};



