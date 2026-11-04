import { User, Group, RequestLog, PlaybackTarget, PlaybackIdMapping, SyncResult, SamlApp, SamlAppInput, SamlSignIn, SamlPost } from '../types/scim';

async function request<T>(path: string, options: RequestInit = {}): Promise<{ data: T }> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw error;
  }

  if (response.status === 204) {
    return { data: {} as T };
  }

  const data = await response.json();
  return { data };
}

export const adminApi = {
  reset: () => request('/admin/reset', { method: 'POST' }),
  getToken: () => request<{ token: string }>('/admin/token'),
  generateToken: (description?: string) => request<{ token: string }>('/admin/token/generate', {
    method: 'POST',
    body: JSON.stringify({ description }),
  }),
  getUsers: () => request<User[]>('/admin/users'),
  getGroups: () => request<Group[]>('/admin/groups'),
  getUserLogs: (id: string) => request<RequestLog[]>(`/admin/users/${id}/logs`),
  getGroupLogs: (id: string) => request<RequestLog[]>(`/admin/groups/${id}/logs`),
  createUser: (body: any) => request('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: any) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setUserGroups: (id: string, groupIds: string[]) =>
    request<{ changed: string[] }>(`/admin/users/${id}/groups`, { method: 'PUT', body: JSON.stringify({ groupIds }) }),
  createGroup: (body: any) => request('/admin/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateGroup: (id: string, body: any) => request(`/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  deleteGroup: (id: string) => request(`/admin/groups/${id}`, { method: 'DELETE' }),
};

export const logsApi = {
  getLogs: (filters?: {
    method?: string;
    status?: number;
    path?: string;
    direction?: string;
    target_id?: number;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    const queryString = params.toString();
    return request<{ logs: RequestLog[], total: number, limit: number, offset: number }>(`/logs${queryString ? `?${queryString}` : ''}`);
  },
  getLog: (id: number) => request<RequestLog>(`/logs/${id}`),
};

export const playbackApi = {
  getTargets: () => request<PlaybackTarget[]>('/playback/targets'),
  createTarget: (data: { name: string, url: string, token?: string }) => request<PlaybackTarget>('/playback/targets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTarget: (id: number, data: { name: string, url: string, token?: string }) => request<PlaybackTarget>(`/playback/targets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTarget: (id: number) => request(`/playback/targets/${id}`, { method: 'DELETE' }),
  getMappings: (targetId: number) => request<PlaybackIdMapping[]>(`/playback/targets/${targetId}/mappings`),
  deleteMapping: (id: number) => request(`/playback/mappings/${id}`, { method: 'DELETE' }),
  getEntityMappings: (id: string) => request<PlaybackIdMapping[]>(`/playback/entity/${id}/mappings`),
  playbackLog: (logId: number, targetId: number) => request('/playback/playback-log', {
    method: 'POST',
    body: JSON.stringify({ logId, targetId }),
  }),
  sync: (targetId: number, method: 'PATCH' | 'PUT') => request<SyncResult[]>('/playback/sync', {
    method: 'POST',
    body: JSON.stringify({ targetId, method }),
  }),
  playbackEntity: (entityType: 'User' | 'Group', scimitId: string, targetId: number) => request('/playback/playback-entity', {
    method: 'POST',
    body: JSON.stringify({ entityType, scimitId, targetId }),
  }),
};

export const samlApi = {
  getIdp: () => request<{ certificate: string; fingerprint: string }>('/saml/idp'),
  getApps: () => request<SamlApp[]>('/saml/apps'),
  createApp: (data: SamlAppInput) => request<SamlApp>('/saml/apps', { method: 'POST', body: JSON.stringify(data) }),
  updateApp: (id: string, data: SamlAppInput) => request<SamlApp>(`/saml/apps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteApp: (id: string) => request(`/saml/apps/${id}`, { method: 'DELETE' }),
  getSignIn: (id: string) => request<SamlSignIn>(`/saml/signins/${id}`),
  completeSignIn: (id: string, userId: string) =>
    request<SamlPost>(`/saml/signins/${id}/complete`, { method: 'POST', body: JSON.stringify({ userId }) }),
};

/** Hand the browser to the SP: auto-submits the SAML Response to its ACS URL (HTTP-POST binding) */
export function postToAcs({ acsUrl, SAMLResponse, RelayState }: SamlPost) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = acsUrl;
  for (const [name, value] of Object.entries({ SAMLResponse, RelayState })) {
    if (!value) continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
