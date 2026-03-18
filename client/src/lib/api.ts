import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name?: string) =>
    api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
};

// Leads
export const leadsApi = {
  list: (params?: Record<string, unknown>) => api.get('/leads', { params }),
  get: (id: string) => api.get(`/leads/${id}`),
  create: (data: Record<string, unknown>) => api.post('/leads', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leads/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/leads/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/leads/${id}`),
  bulkDelete: (ids: string[]) => api.delete('/leads', { data: { ids } }),
  addNote: (id: string, content: string) =>
    api.post(`/leads/${id}/notes`, { content }),
  enrich: (id: string) => api.post(`/leads/${id}/enrich`),
};

// Scraper
export const scraperApi = {
  search: (industry: string, location: string, maxResults?: number) =>
    api.post('/scraper/search', { industry, location, maxResults }),
  save: (leads: unknown[]) => api.post('/scraper/save', { leads }),
};

// Emails
export const emailsApi = {
  list: (params?: Record<string, unknown>) => api.get('/emails', { params }),
  generate: (leadIds: string[], tone?: string) =>
    api.post('/emails/generate', { leadIds, tone }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/emails/${id}`, data),
  schedule: (id: string, scheduledAt: string) =>
    api.post(`/emails/${id}/schedule`, { scheduledAt }),
  scheduleBatch: (emailIds: string[], startDate: string, sendPerDay: number) =>
    api.post('/emails/schedule-batch', { emailIds, startDate, sendPerDay }),
  sendNow: (id: string) => api.post(`/emails/${id}/send-now`),
  delete: (id: string) => api.delete(`/emails/${id}`),
};

// Templates
export const templatesApi = {
  list: () => api.get('/templates'),
  create: (data: Record<string, unknown>) => api.post('/templates', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

// Demos
export const demosApi = {
  list: () => api.get('/demos'),
  create: (data: Record<string, unknown>) => api.post('/demos', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/demos/${id}`, data),
  delete: (id: string) => api.delete(`/demos/${id}`),
};

// Analytics
export const analyticsApi = {
  get: () => api.get('/analytics'),
  charts: () => api.get('/analytics/charts'),
};

// Revenue
export const revenueApi = {
  list: () => api.get('/revenue'),
  create: (data: Record<string, unknown>) => api.post('/revenue', data),
  delete: (id: string) => api.delete(`/revenue/${id}`),
};

// Prebuilt Templates
export const prebuiltTemplatesApi = {
  list: () => api.get('/templates/prebuilt'),
  industries: () => api.get('/templates/prebuilt/industries'),
  copyToMine: (data: Record<string, unknown>) => api.post('/templates', data),
};

// WhatsApp
export const whatsAppApi = {
  send: (leadId: string, message: string) =>
    api.post('/whatsapp/send', { leadId, message }),
  generate: (leadId: string) =>
    api.post('/whatsapp/generate', { leadId }),
  messages: (leadId: string) =>
    api.get('/whatsapp/messages', { params: { leadId } }),
};

// Settings
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: Record<string, unknown>) => api.put('/settings', data),
};
