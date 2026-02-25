import axios from 'axios';
import { User, Group, RequestLog } from '../types/scim';

const api = axios.create({
  baseURL: '/api'
});

export const adminApi = {
  reset: () => api.post('/admin/reset'),
  getToken: () => api.get<{ token: string }>('/admin/token'),
  generateToken: (description?: string) => api.post<{ token: string }>('/admin/token/generate', { description }),
  getUsers: () => api.get<User[]>('/admin/users'),
  getGroups: () => api.get<Group[]>('/admin/groups'),
};

export const logsApi = {
  getLogs: (filters?: {
    method?: string;
    status?: number;
    path?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ logs: RequestLog[], total: number, limit: number, offset: number }>('/logs', { params: filters }),
  getLog: (id: number) => api.get<RequestLog>(`/logs/${id}`),
};

export default api;
