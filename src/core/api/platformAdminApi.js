import { tillflowFetch } from '../../tillflow/api/client';

function token() {
  return localStorage.getItem('tillflow_sanctum_token');
}

export async function fetchPlatformMeta() {
  return tillflowFetch('/platform/meta', { token: token() });
}

export async function fetchPlatformPlans() {
  return tillflowFetch('/platform/plans', { token: token() });
}

export async function createPlatformPlan(body) {
  return tillflowFetch('/platform/plans', { method: 'POST', body, token: token() });
}

export async function updatePlatformPlan(id, body) {
  return tillflowFetch(`/platform/plans/${id}`, { method: 'PATCH', body, token: token() });
}

export async function deletePlatformPlan(id) {
  return tillflowFetch(`/platform/plans/${id}`, { method: 'DELETE', token: token() });
}

export async function fetchPlatformSubscriptions(query = {}) {
  const q = new URLSearchParams(query).toString();

  return tillflowFetch(`/platform/subscriptions${q ? `?${q}` : ''}`, { token: token() });
}

export async function fetchPlatformDashboard() {
  return tillflowFetch('/platform/dashboard', { token: token() });
}
