import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
  login: (email: string, password: string, totpCode?: string) =>
    api.post('/auth/login', { email, password, totpCode }),
  register: (email: string, password: string, name?: string) =>
    api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Leads
export const leadsApi = {
  list: (params?: Record<string, unknown>) => api.get('/leads', { params }),
  getIndustries: () => api.get('/leads/industries'),
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
  generate: (leadIds: string[], tone?: string, demoLinkId?: string) =>
    api.post('/emails/generate', { leadIds, tone, demoLinkId }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/emails/${id}`, data),
  schedule: (id: string, scheduledAt: string) =>
    api.post(`/emails/${id}/schedule`, { scheduledAt }),
  scheduleBatch: (emailIds: string[], startDate: string, sendPerDay: number, minutesBetween?: number) =>
    api.post('/emails/schedule-batch', { emailIds, startDate, sendPerDay, minutesBetween }),
  sendNow: (id: string) => api.post(`/emails/${id}/send-now`),
  testSend: (to: string, subject: string, body: string) =>
    api.post('/emails/test-send', { to, subject, body }),
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

// GoHighLevel
export const ghlApi = {
  sync: (leadIds: string[]) => api.post('/ghl/sync', { leadIds }),
  message: (leadId: string, message: string, type: 'WhatsApp' | 'Email' | 'SMS', subject?: string) =>
    api.post('/ghl/message', { leadId, message, type, subject }),
  conversations: (leadId: string) => api.get(`/ghl/conversations/${leadId}`),
  status: () => api.get('/ghl/status'),
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

// Team (admin only)
export const teamApi = {
  list: () => api.get('/team'),
  create: (data: Record<string, unknown>) => api.post('/team', data),
  setRole: (id: string, role: 'ADMIN' | 'MEMBER') => api.patch(`/team/${id}/role`, { role }),
  remove: (id: string) => api.delete(`/team/${id}`),
  unlock: (id: string) => api.post(`/team/${id}/unlock`),
};

// Activity Log (admin only)
export const activityLogApi = {
  list: (params?: Record<string, unknown>) => api.get('/activity-log', { params }),
  actions: () => api.get('/activity-log/actions'),
};

// Sessions
export const sessionsApi = {
  list: () => api.get('/sessions'),
  revoke: (id: string) => api.delete(`/sessions/${id}`),
  revokeAll: (all?: boolean) => api.delete('/sessions', { data: { all } }),
  listAll: () => api.get('/sessions/all'),
  forceLogout: (userId: string) => api.delete(`/sessions/user/${userId}`),
};

// 2FA
export const twoFactorApi = {
  setup: () => api.post('/2fa/setup'),
  verify: (code: string) => api.post('/2fa/verify', { code }),
  disable: (code: string) => api.post('/2fa/disable', { code }),
};
