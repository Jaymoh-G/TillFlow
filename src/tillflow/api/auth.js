import { tillflowFetch, tillflowUpload } from './client';

export function loginRequest(payload) {
  return tillflowFetch('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

/** @param {{ email: string }} body */
export function forgotPasswordRequest(body) {
  return tillflowFetch('/auth/forgot-password', { method: 'POST', body });
}

/**
 * @param {{ email: string, token: string, password: string, password_confirmation: string }} body
 */
export function resetPasswordRequest(body) {
  return tillflowFetch('/auth/reset-password', { method: 'POST', body });
}

export function meRequest(token) {
  return tillflowFetch('/auth/me', { token });
}

export function logoutRequest(token) {
  return tillflowFetch('/auth/logout', { method: 'POST', token });
}

/** @param {{ current_password: string, password: string, password_confirmation: string }} body */
export function changePasswordRequest(token, body) {
  return tillflowFetch('/auth/password', { method: 'POST', body, token });
}

export function listSessionsRequest(token) {
  return tillflowFetch('/auth/sessions', { token });
}

export function revokeSessionRequest(token, sessionId) {
  return tillflowFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE', token });
}

/** @param {Record<string, unknown>} body */
export function updateProfileRequest(token, body) {
  return tillflowFetch('/auth/profile', { method: 'PATCH', body, token });
}

/**
 * Profile update with optional new avatar (multipart). Use when `avatarFile` is set
 * (Laravel stores the file and sets `user.avatar_url`).
 *
 * @param {Record<string, string | null | undefined>} body
 * @param {File} [avatarFile]
 */
export function updateProfileWithAvatarRequest(token, body, avatarFile) {
  const fd = new FormData();
  fd.append('name', String(body.name ?? ''));
  fd.append('email', String(body.email ?? ''));
  fd.append('phone', body.phone != null && String(body.phone).trim() !== '' ? String(body.phone).trim() : '');
  fd.append(
    'address_line',
    body.address_line != null && String(body.address_line).trim() !== '' ? String(body.address_line).trim() : ''
  );
  fd.append(
    'location',
    body.location != null && String(body.location).trim() !== '' ? String(body.location).trim() : ''
  );
  if (avatarFile instanceof File) {
    fd.append('avatar', avatarFile);
  }
  return tillflowUpload('/auth/profile', { method: 'PATCH', formData: fd, token });
}
