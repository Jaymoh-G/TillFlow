import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TillFlowApiError } from '../api/errors';
import { listPermissions, listRoles, updateRolePermissions } from '../api/rolesApi';
import { inviteTenantUser, listTenantUsers, syncUserRoles } from '../api/tenantUsers';
import { useAuth } from '../auth/AuthContext';
import { buildPermissionGroups } from '../utils/permissionGroups';
import Forbidden from './Forbidden';

/** Permission matrix columns (left → right). Must match API role slugs. */
const PERMISSION_MATRIX_SLUGS = ['cashier', 'manager', 'tenant', 'owner', 'admin'];

function titleForMatrixSlug(slug) {
  return String(slug ?? '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Column order for the Users-by-role board (unknown slugs sort after these). */
const ROLE_COLUMN_SLUG_ORDER = ['cashier', 'manager', 'tenant', 'owner', 'admin'];

function sortRolesForUserColumns(roles) {
  const rank = (slug) => {
    const i = ROLE_COLUMN_SLUG_ORDER.indexOf(String(slug ?? ''));
    return i === -1 ? ROLE_COLUMN_SLUG_ORDER.length : i;
  };
  return [...roles].sort((a, b) => {
    const d = rank(a.slug) - rank(b.slug);
    if (d !== 0) {
      return d;
    }
    return String(a.name).localeCompare(String(b.name));
  });
}

/** First row: Tenant, Users, Reports, Catalog; rest below — CSS uses fluid auto-fit columns to fill width. */
const FIRST_ROW_PERM_IDS = ['tenant', 'users', 'reports', 'catalog'];

function PermissionGroupDetails({ group, role, roleEdits, togglePermission }) {
  return (
    <details className="tf-perm-group" data-group-id={group.id} open>
      <summary className="tf-perm-group__summary">{group.title}</summary>
      <div className="tf-perm-group__body">
        {group.rows.map((row) => {
          if (!row.view && !row.manage) {
            return null;
          }
          return (
            <div key={row.moduleKey} className="tf-perm-row">
              <span className="tf-perm-row__label">{row.label}</span>
              <div className="tf-perm-row__checks">
                {row.view ? (
                  <label className="tf-perm-row__check">
                    <input
                      type="checkbox"
                      checked={(roleEdits[role.id] ?? []).includes(row.view.id)}
                      aria-label={`${role.name} — ${row.view.slug}`}
                      onChange={(ev) => togglePermission(role.id, row.view.id, ev.target.checked)}
                    />
                    <span>View</span>
                  </label>
                ) : null}
                {row.manage ? (
                  <label className="tf-perm-row__check">
                    <input
                      type="checkbox"
                      checked={(roleEdits[role.id] ?? []).includes(row.manage.id)}
                      aria-label={`${role.name} — ${row.manage.slug}`}
                      onChange={(ev) => togglePermission(role.id, row.manage.id, ev.target.checked)}
                    />
                    <span>Manage</span>
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default function AdminRoles() {
  const { token, user, hasPermission } = useAuth();
  const canManage = hasPermission('users.manage');

  const [busy, setBusy] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleEdits, setRoleEdits] = useState({});
  const [userEdits, setUserEdits] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [savingUsersBulk, setSavingUsersBulk] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleIds, setInviteRoleIds] = useState([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const feedbackToastTimerRef = useRef(null);

  const dismissFeedbackToast = useCallback(() => {
    if (feedbackToastTimerRef.current != null) {
      window.clearTimeout(feedbackToastTimerRef.current);
      feedbackToastTimerRef.current = null;
    }
    setFeedbackToast(null);
  }, []);

  const showFeedbackToast = useCallback(
    (variant, message) => {
      if (feedbackToastTimerRef.current != null) {
        window.clearTimeout(feedbackToastTimerRef.current);
        feedbackToastTimerRef.current = null;
      }
      setFeedbackToast({ variant, message });
      const ms = variant === 'success' ? 4500 : 7000;
      feedbackToastTimerRef.current = window.setTimeout(() => {
        feedbackToastTimerRef.current = null;
        setFeedbackToast(null);
      }, ms);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (feedbackToastTimerRef.current != null) {
        window.clearTimeout(feedbackToastTimerRef.current);
      }
    };
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      return false;
    }
    setBusy(true);
    dismissFeedbackToast();
    try {
      const [permRes, roleRes, userRes] = await Promise.all([
        listPermissions(token),
        listRoles(token),
        listTenantUsers(token),
      ]);
      const permRows = permRes?.permissions ?? [];
      const roleRows = roleRes?.roles ?? [];
      const userRows = userRes?.users ?? [];
      setPermissions(permRows);
      setRoles(roleRows);
      setUsers(userRows);
      const nextEdits = {};
      for (const r of roleRows) {
        nextEdits[r.id] = (r.permissions ?? []).map((p) => p.id);
      }
      setRoleEdits(nextEdits);
      const uEdits = {};
      for (const u of userRows) {
        uEdits[u.id] = (u.roles ?? []).map((r) => r.id);
      }
      setUserEdits(uEdits);
      return true;
    } catch (e) {
      const msg = e instanceof TillFlowApiError ? e.message : 'Could not load roles.';
      showFeedbackToast('danger', msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [token, dismissFeedbackToast, showFeedbackToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleRowsSorted = useMemo(
    () => [...roles].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [roles]
  );

  const rolesColumnOrder = useMemo(() => sortRolesForUserColumns(roles), [roles]);

  const dirtyUsers = useMemo(() => {
    return users.filter((u) => {
      const cur = new Set(userEdits[u.id] ?? []);
      const orig = new Set((u.roles ?? []).map((r) => r.id));
      if (cur.size !== orig.size) {
        return true;
      }
      for (const id of cur) {
        if (!orig.has(id)) {
          return true;
        }
      }
      return false;
    });
  }, [users, userEdits]);

  const permissionGroups = useMemo(() => buildPermissionGroups(permissions), [permissions]);

  const { firstRowPermissionGroups, restPermissionGroups } = useMemo(() => {
    const set = new Set(FIRST_ROW_PERM_IDS);
    const first = FIRST_ROW_PERM_IDS.map((id) => permissionGroups.find((g) => g.id === id)).filter(Boolean);
    const rest = permissionGroups.filter((g) => !set.has(g.id));
    return { firstRowPermissionGroups: first, restPermissionGroups: rest };
  }, [permissionGroups]);

  const otherRoles = useMemo(
    () =>
      [...roles]
        .filter((r) => !PERMISSION_MATRIX_SLUGS.includes(r.slug))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [roles]
  );

  async function saveRole(roleId) {
    if (!token) {
      return;
    }
    setSavingRoleId(roleId);
    try {
      const ids = roleEdits[roleId] ?? [];
      await updateRolePermissions(token, roleId, ids);
      const refreshed = await load();
      if (refreshed) {
        showFeedbackToast('success', 'Permissions saved.');
      }
    } catch (e) {
      const msg = e instanceof TillFlowApiError ? e.message : 'Save failed.';
      showFeedbackToast('danger', msg);
    } finally {
      setSavingRoleId(null);
    }
  }

  function togglePermission(roleId, permissionId, checked) {
    setRoleEdits((prev) => {
      const cur = new Set(prev[roleId] ?? []);
      if (checked) {
        cur.add(permissionId);
      } else {
        cur.delete(permissionId);
      }
      return { ...prev, [roleId]: [...cur] };
    });
  }

  function toggleUserRole(userId, roleId, checked) {
    setUserEdits((prev) => {
      const cur = new Set(prev[userId] ?? []);
      if (checked) {
        cur.add(roleId);
      } else {
        cur.delete(roleId);
      }
      return { ...prev, [userId]: [...cur] };
    });
  }

  function openInviteModal() {
    dismissFeedbackToast();
    setInviteName('');
    setInviteEmail('');
    setInviteRoleIds([]);
    setInviteOpen(true);
  }

  function toggleInviteRole(roleId, checked) {
    setInviteRoleIds((prev) => {
      const cur = new Set(prev);
      if (checked) {
        cur.add(roleId);
      } else {
        cur.delete(roleId);
      }
      return [...cur];
    });
  }

  async function submitInvite() {
    if (!token) {
      return;
    }
    setInviteSubmitting(true);
    try {
      await inviteTenantUser(token, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role_ids: inviteRoleIds,
      });
      setInviteOpen(false);
      const refreshed = await load();
      if (refreshed) {
        showFeedbackToast(
          'success',
          'Invitation sent. The user will receive an email with a link to set their password.'
        );
      }
    } catch (e) {
      const msg = e instanceof TillFlowApiError ? e.message : 'Could not send invitation.';
      showFeedbackToast('danger', msg);
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function saveAllUserRoleChanges() {
    if (!token || !dirtyUsers.length) {
      return;
    }
    setSavingUsersBulk(true);
    try {
      for (const u of dirtyUsers) {
        await syncUserRoles(token, u.id, userEdits[u.id] ?? []);
      }
      const refreshed = await load();
      if (refreshed) {
        showFeedbackToast('success', 'User role changes saved.');
      }
    } catch (e) {
      const msg = e instanceof TillFlowApiError ? e.message : 'Save failed.';
      showFeedbackToast('danger', msg);
    } finally {
      setSavingUsersBulk(false);
    }
  }

  if (!canManage) {
    return <Forbidden title="No permission" detail="Managing roles requires the users.manage permission." />;
  }

  if (busy && !roles.length) {
    return (
      <div className="tf-card tf-card--pad">
        <p className="tf-muted">Loading roles…</p>
      </div>
    );
  }

  return (
    <div className="tf-admin-roles">
      {feedbackToast ? (
        <div
          className="position-fixed top-0 end-0 p-3 tf-admin-roles__feedback-popover"
          style={{ zIndex: 4000, minWidth: 280, maxWidth: 440 }}
          role="alert">
          <div
            className={`alert shadow-sm mb-0 d-flex align-items-start justify-content-between gap-2 ${
              feedbackToast.variant === 'success' ? 'alert-success' : 'alert-danger'
            }`}>
            <span className="flex-grow-1">{feedbackToast.message}</span>
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={dismissFeedbackToast} />
          </div>
        </div>
      ) : null}

      <h1 className="tf-admin__topbar-title" style={{ marginBottom: '0.5rem' }}>
        Roles & permissions
      </h1>
      <p className="tf-muted" style={{ marginBottom: '1.25rem' }}>
        Changes apply to your tenant only. Users need to sign in again for some changes to take effect in other
        sessions.
      </p>

      <section className="tf-admin-roles__section">
        <h2 className="tf-admin__topbar-title tf-admin-roles__section-title">Role permissions</h2>
        <div className="tf-role-permission-matrix">
          {PERMISSION_MATRIX_SLUGS.map((slug) => {
            const role = roles.find((r) => r.slug === slug);
            if (!role) {
              return (
                <div key={slug} className="tf-role-matrix-slot tf-card tf-card--pad">
                  <div className="tf-role-matrix-slot__head">
                    <h3 className="tf-role-card__name">{titleForMatrixSlug(slug)}</h3>
                    <div className="tf-muted tf-role-card__slug">{slug}</div>
                  </div>
                  <p className="tf-muted tf-role-matrix-slot__missing">
                    No role with this slug exists for your tenant yet (e.g. run migrations/seeds or add the role in the
                    database).
                  </p>
                </div>
              );
            }
            return (
              <div key={role.id} className="tf-role-matrix-slot tf-card tf-card--pad">
                <div className="tf-role-card__header">
                  <div>
                    <h3 className="tf-role-card__name">{role.name}</h3>
                    <div className="tf-muted tf-role-card__slug">{role.slug}</div>
                  </div>
                  <button
                    type="button"
                    className="tf-btn tf-btn--primary tf-btn--sm"
                    disabled={savingRoleId === role.id}
                    onClick={() => void saveRole(role.id)}>
                    {savingRoleId === role.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
                <div className="tf-role-card__groups tf-role-matrix-slot__scroll">
                  {firstRowPermissionGroups.length > 0 ? (
                    <div className="tf-perm-first-row">
                      {firstRowPermissionGroups.map((g) => (
                        <PermissionGroupDetails
                          key={g.id}
                          group={g}
                          role={role}
                          roleEdits={roleEdits}
                          togglePermission={togglePermission}
                        />
                      ))}
                    </div>
                  ) : null}
                  {restPermissionGroups.length > 0 ? (
                    <div className="tf-perm-groups-grid">
                      {restPermissionGroups.map((g) => (
                        <PermissionGroupDetails
                          key={g.id}
                          group={g}
                          role={role}
                          roleEdits={roleEdits}
                          togglePermission={togglePermission}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {otherRoles.length ? (
          <>
            <h3 className="tf-admin-roles__subsection-title">Other roles</h3>
            <p className="tf-muted" style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
              Additional roles defined for your tenant are edited below.
            </p>
            <div className="tf-admin-roles__role-list">
              {otherRoles.map((role) => (
                <div key={role.id} className="tf-role-card tf-card tf-card--pad">
                  <div className="tf-role-card__header">
                    <div>
                      <h3 className="tf-role-card__name">{role.name}</h3>
                      <div className="tf-muted tf-role-card__slug">{role.slug}</div>
                    </div>
                    <button
                      type="button"
                      className="tf-btn tf-btn--primary tf-btn--sm"
                      disabled={savingRoleId === role.id}
                      onClick={() => void saveRole(role.id)}>
                      {savingRoleId === role.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <div className="tf-role-card__groups">
                    {firstRowPermissionGroups.length > 0 ? (
                      <div className="tf-perm-first-row">
                        {firstRowPermissionGroups.map((g) => (
                          <PermissionGroupDetails
                            key={g.id}
                            group={g}
                            role={role}
                            roleEdits={roleEdits}
                            togglePermission={togglePermission}
                          />
                        ))}
                      </div>
                    ) : null}
                    {restPermissionGroups.length > 0 ? (
                      <div className="tf-perm-groups-grid">
                        {restPermissionGroups.map((g) => (
                          <PermissionGroupDetails
                            key={g.id}
                            group={g}
                            role={role}
                            roleEdits={roleEdits}
                            togglePermission={togglePermission}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="tf-admin-roles__section">
        <div className="tf-admin-roles__users-head">
          <h2 className="tf-admin__topbar-title tf-admin-roles__section-title tf-admin-roles__section-title--inline">
            Users by role
          </h2>
          <div className="tf-admin-roles__users-actions">
            <button
              type="button"
              className="tf-btn tf-btn--primary tf-btn--sm"
              disabled={savingUsersBulk || !dirtyUsers.length}
              onClick={() => void saveAllUserRoleChanges()}>
              {savingUsersBulk
                ? 'Saving…'
                : dirtyUsers.length > 0
                  ? `Save changes (${dirtyUsers.length})`
                  : 'Save changes'}
            </button>
            <button type="button" className="tf-btn tf-btn--primary tf-btn--sm" onClick={openInviteModal}>
              Add user
            </button>
          </div>
        </div>
        <p className="tf-muted" style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
          Each person can appear under more than one role. Use “Add to this role” to assign, or remove to drop that role
          only.
        </p>
        <div className="tf-user-roles-columns">
          {rolesColumnOrder.map((r) => {
            const inRole = users.filter((u) => (userEdits[u.id] ?? []).includes(r.id));
            const canAdd = users.filter((u) => !(userEdits[u.id] ?? []).includes(r.id));
            return (
              <div key={r.id} className="tf-user-role-column tf-card tf-card--pad">
                <div className="tf-user-role-column__head">
                  <h3 className="tf-user-role-column__title">{r.name}</h3>
                  <div className="tf-muted tf-user-role-column__slug">{r.slug}</div>
                </div>
                <ul className="tf-user-role-column__list">
                  {inRole.map((u) => (
                    <li key={u.id} className="tf-user-role-column__item">
                      <div className="tf-user-role-column__item-text">
                        <strong className="tf-user-role-column__name">{u.name || u.email}</strong>
                        <div className="tf-muted tf-user-role-column__email">{u.email}</div>
                        {user && Number(user.id) === Number(u.id) ? (
                          <span className="tf-user-role-column__you">You</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="tf-btn tf-btn--sm tf-user-role-column__remove"
                        title={`Remove ${u.name || u.email} from ${r.name}`}
                        aria-label={`Remove ${u.name || u.email} from ${r.name}`}
                        onClick={() => toggleUserRole(u.id, r.id, false)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                {users.length === 0 ? (
                  <p className="tf-muted tf-user-role-column__empty-note">No users yet — use Add user to invite.</p>
                ) : canAdd.length ? (
                  <label className="tf-user-role-column__add-label">
                    <span className="visually-hidden">Add user to {r.name}</span>
                    <select
                      className="tf-input tf-user-role-column__add-select"
                      defaultValue=""
                      onChange={(ev) => {
                        const v = ev.target.value;
                        if (!v) {
                          return;
                        }
                        toggleUserRole(Number(v), r.id, true);
                        ev.target.value = '';
                      }}
                      aria-label={`Add user to ${r.name}`}>
                      <option value="">Add to this role…</option>
                      {canAdd.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="tf-muted tf-user-role-column__empty-note">Everyone is in this role</p>
                )}
              </div>
            );
          })}
        </div>
        {users.some((u) => (userEdits[u.id] ?? []).length === 0) ? (
          <div className="tf-user-role-unassigned tf-card tf-card--pad" style={{ marginTop: '1rem' }}>
            <h3 className="tf-user-role-column__title">No role assigned</h3>
            <ul className="tf-user-role-column__list">
              {users
                .filter((u) => (userEdits[u.id] ?? []).length === 0)
                .map((u) => (
                  <li key={u.id} className="tf-user-role-column__item tf-user-role-column__item--bare">
                    <strong className="tf-user-role-column__name">{u.name || u.email}</strong>
                    <div className="tf-muted tf-user-role-column__email">{u.email}</div>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>

      {inviteOpen ? (
        <div
          className="tf-invite-backdrop"
          role="presentation"
          onClick={() => !inviteSubmitting && setInviteOpen(false)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape' && !inviteSubmitting) {
              setInviteOpen(false);
            }
          }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tf-invite-title"
            className="tf-card tf-card--pad"
            style={{ maxWidth: 440, width: '100%' }}
            onClick={(ev) => ev.stopPropagation()}>
            <h2 id="tf-invite-title" className="tf-admin__topbar-title" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Invite user
            </h2>
            <p className="tf-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              We will email them a link to set their password. No password is shared in this form.
            </p>
            <div className="tf-form" style={{ maxWidth: 'none' }}>
              <label className="tf-label">
                Name
                <input
                  className="tf-input"
                  value={inviteName}
                  onChange={(ev) => setInviteName(ev.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="tf-label">
                Email
                <input
                  className="tf-input"
                  type="email"
                  value={inviteEmail}
                  onChange={(ev) => setInviteEmail(ev.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="tf-label" style={{ marginBottom: '0.35rem' }}>
                  Roles
                </legend>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {roleRowsSorted.map((r) => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={inviteRoleIds.includes(r.id)}
                        onChange={(ev) => toggleInviteRole(r.id, ev.target.checked)}
                      />
                      <span>
                        {r.name} <span className="tf-muted">({r.slug})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="tf-btn tf-btn--sm"
                  disabled={inviteSubmitting}
                  onClick={() => setInviteOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="tf-btn tf-btn--primary tf-btn--sm"
                  disabled={inviteSubmitting || !inviteName.trim() || !inviteEmail.trim()}
                  onClick={() => void submitInvite()}>
                  {inviteSubmitting ? 'Sending…' : 'Send invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
