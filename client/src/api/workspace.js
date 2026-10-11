import { API_BASE, requestApi } from './auth.js';

export const workspaceApi = {
  getProfile: () => requestApi('/profiles/me'),
  updateProfile: (data) => requestApi('/profiles/me', { method: 'PATCH', body: JSON.stringify(data) }),
  updateStartup: (data) => requestApi('/profiles/me/startup', { method: 'PATCH', body: JSON.stringify(data) }),
  discoverInvestors: (params) => requestApi(`/profiles/investors?${params.toString()}`),
  discoverStartups: (params) => requestApi(`/startups?${params.toString()}`),
  getAdminOverview: () => requestApi('/admin/overview'),
  getAdminUsers: (params) => requestApi(`/admin/users?${params.toString()}`),
  updateAccountStatus: (id, status) => requestApi(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  }),
  uploadImage: async (purpose, file) => {
    const body = new FormData();
    body.append('file', file);
    let response;
    try {
      response = await fetch(`${API_BASE}/api/uploads/${purpose}`, { method: 'POST', credentials: 'include', body });
    } catch {
      throw new Error('The image could not be uploaded. Check your connection and try again.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || 'The image upload failed.');
    return result;
  },
};
