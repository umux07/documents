const API_BASE = '/api';
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export const checkHealth = () => request('/health');
export const registerAccount = values => request('/auth/register', { method: 'POST', body: JSON.stringify(values) });
export const loginAccount = values => request('/auth/login', { method: 'POST', body: JSON.stringify(values) });
export const getCurrentUser = () => request('/auth/me');
export const logoutAccount = () => request('/auth/logout', { method: 'POST', body: '{}' });
export const updateProfile = values => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(values) });
export const sendMessage = (message, conversationId, provider) => request('/chat', { method: 'POST', body: JSON.stringify({ message, conversationId, provider }) });
export const listConversations = () => request('/conversations');
export const getMessages = id => request(`/conversations/${id}/messages`);
export const deleteConversation = id => request(`/conversations/${id}`, { method: 'DELETE' });
export const renameConversation = (id, title) => request(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
export const adminOverview = () => request('/admin/overview');
export const adminUsers = q => request(`/admin/users?q=${encodeURIComponent(q || '')}`);
export const setUserRole = (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const deleteUser = id => request(`/admin/users/${id}`, { method: 'DELETE' });
export const adminDirectives = () => request('/admin/directives');
export const addDirective = directive => request('/admin/directives', { method: 'POST', body: JSON.stringify({ directive }) });
export const toggleDirective = (id, enabled) => request(`/admin/directives/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
export const removeDirective = id => request(`/admin/directives/${id}`, { method: 'DELETE' });
export const adminFeatures = () => request('/admin/features');
export const toggleFeature = (id, enabled) => request(`/admin/features/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
export const adminActivity = () => request('/admin/activity');
export const adminAIConfig = () => request('/admin/ai-config');
export const saveAIConfig = provider => request('/admin/ai-config', { method: 'PUT', body: JSON.stringify({ provider }) });
