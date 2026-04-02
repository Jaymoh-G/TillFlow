import { tillflowFetch } from './client';

export function loginRequest(payload) {
  return tillflowFetch('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function meRequest(token) {
  return tillflowFetch('/auth/me', { token });
}

export function logoutRequest(token) {
  return tillflowFetch('/auth/logout', { method: 'POST', token });
}
