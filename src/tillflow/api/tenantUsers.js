import { tillflowFetch } from './client';

/** @param {string|null} token */
export function listTenantUsers(token) {
  return tillflowFetch('/users', { token });
}

/**
 * @param {string|null} token
 * @param {number} userId
 * @param {number[]} roleIds
 */
export function syncUserRoles(token, userId, roleIds) {
  return tillflowFetch(`/users/${userId}/roles`, {
    method: 'PATCH',
    body: { role_ids: roleIds },
    token,
  });
}

/**
 * @param {string|null} token
 * @param {{ name: string, email: string, role_ids?: number[] }} body
 */
export function inviteTenantUser(token, body) {
  return tillflowFetch('/users', {
    method: 'POST',
    body,
    token,
  });
}
