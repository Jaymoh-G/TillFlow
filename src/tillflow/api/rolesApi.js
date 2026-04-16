import { tillflowFetch } from './client';

/** @param {string|null} token */
export function listPermissions(token) {
  return tillflowFetch('/permissions', { token });
}

/** @param {string|null} token */
export function listRoles(token) {
  return tillflowFetch('/roles', { token });
}

/**
 * @param {string|null} token
 * @param {number} roleId
 * @param {number[]} permissionIds
 */
export function updateRolePermissions(token, roleId, permissionIds) {
  return tillflowFetch(`/roles/${roleId}`, {
    method: 'PATCH',
    body: { permission_ids: permissionIds },
    token,
  });
}
