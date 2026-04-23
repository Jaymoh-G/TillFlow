import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Form, Modal, Spinner } from 'react-bootstrap';
import CommonFooter from '../../components/footer/commonFooter';
import RefreshIcon from '../../components/tooltip-content/refresh';
import CollapesIcon from '../../components/tooltip-content/collapes';
import SettingsSideBar from '../../feature-module/settings/settingssidebar';
import {
  createTenantContact,
  deleteTenantContact,
  fetchTenantContacts,
  updateTenantContact
} from '../api/tenantContacts';
import { TillFlowApiError } from '../api/errors';

const emptyCreate = {
  first_name: '',
  last_name: '',
  position: '',
  email: '',
  phone: '',
  password: '',
  send_password_setup_email: false,
  is_primary: false
};

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export default function TenantCompanyContacts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [billing, setBilling] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createAvatar, setCreateAvatar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    position: '',
    email: '',
    phone: '',
    is_primary: false
  });
  const [editAvatar, setEditAvatar] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await fetchTenantContacts();
      setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
      setBilling(data?.billing ?? null);
    } catch (e) {
      setContacts([]);
      setBilling(null);
      setError(e instanceof TillFlowApiError ? e.message : 'Could not load contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async (e) => {
    e.preventDefault();
    const email = normalizeEmail(createForm.email);
    if (createForm.is_primary && !email) {
      window.alert('Primary contacts need an email (billing correspondence).');
      return;
    }
    const wantsLogin =
      createForm.send_password_setup_email ||
      (String(createForm.password ?? '').trim().length > 0);
    if (wantsLogin && !email) {
      window.alert('Email is required for an invitation or login.');
      return;
    }
    if (
      wantsLogin &&
      !createForm.send_password_setup_email &&
      String(createForm.password ?? '').trim().length < 8
    ) {
      window.alert('Use at least 8 characters for the password, or enable “Send set-password email”.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', createForm.first_name.trim());
      fd.append('last_name', createForm.last_name.trim());
      if (createForm.position?.trim()) {
        fd.append('position', createForm.position.trim());
      }
      if (email) {
        fd.append('email', email);
      }
      if (createForm.phone?.trim()) {
        fd.append('phone', createForm.phone.trim());
      }
      fd.append('is_primary', createForm.is_primary ? '1' : '0');
      fd.append('send_password_setup_email', createForm.send_password_setup_email ? '1' : '0');
      if (!createForm.send_password_setup_email && createForm.password?.trim()) {
        fd.append('password', createForm.password.trim());
      }
      if (createAvatar) {
        fd.append('avatar', createAvatar);
      }
      await createTenantContact(fd);
      setShowCreate(false);
      setCreateForm(emptyCreate);
      setCreateAvatar(null);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not create contact.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c) => {
    setEditRow(c);
    setEditForm({
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      position: c.position ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      is_primary: Boolean(c.is_primary)
    });
    setEditAvatar(null);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editRow) {
      return;
    }
    const email = normalizeEmail(editForm.email);
    if (editForm.is_primary && !email) {
      window.alert('Primary contacts need an email.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', editForm.first_name.trim());
      fd.append('last_name', editForm.last_name.trim());
      fd.append('position', editForm.position?.trim() ?? '');
      fd.append('email', email);
      fd.append('phone', editForm.phone?.trim() ?? '');
      fd.append('is_primary', editForm.is_primary ? '1' : '0');
      if (editAvatar) {
        fd.append('avatar', editAvatar);
      }
      await updateTenantContact(editRow.id, fd);
      setEditRow(null);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not update contact.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) {
      return;
    }
    setSaving(true);
    try {
      await deleteTenantContact(deleteRow.id);
      setDeleteRow(null);
      await load();
    } catch (err) {
      window.alert(err instanceof TillFlowApiError ? err.message : 'Could not delete contact.');
    } finally {
      setSaving(false);
    }
  };

  const showTillflowBackLink =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/');

  return (
    <>
      <div className="page-wrapper">
        <div className="content settings-content">
          <div className="page-header settings-pg-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Settings</h4>
                <h6>Company contacts and billing recipients</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>
          <div className="row">
            <div className="col-xl-12">
              <div className="settings-wrapper d-flex">
                <SettingsSideBar />
                <div className="card flex-fill mb-0">
                  <div className="card-header d-flex flex-wrap align-items-start justify-content-between gap-2">
                    <div>
                      <h4 className="fs-18 fw-bold mb-1">Company contacts</h4>
                      <p className="text-muted small mb-0">
                        Billing email and phone follow the{' '}
                        <strong>primary</strong> contact. Optional login via invite or password when creating a
                        contact.
                      </p>
                      {billing?.billing_email || billing?.billing_phone ? (
                        <p className="small mb-0 mt-2">
                          <span className="text-muted">Billing To: </span>
                          {billing.billing_email ? (
                            <a href={`mailto:${billing.billing_email}`}>{billing.billing_email}</a>
                          ) : (
                            '—'
                          )}
                          {billing.billing_phone ? (
                            <span className="ms-2">{billing.billing_phone}</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    <div className="d-flex gap-2 flex-shrink-0">
                      {showTillflowBackLink ? (
                        <Link to="/admin" className="btn btn-outline-secondary btn-sm">
                          Back to admin
                        </Link>
                      ) : null}
                      <Button size="sm" onClick={() => void load()}>
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setCreateForm(emptyCreate);
                          setCreateAvatar(null);
                          setShowCreate(true);
                        }}>
                        Add contact
                      </Button>
                    </div>
                  </div>
                  <div className="card-body">
                    {error ? (
                      <div className="alert alert-danger py-2" role="alert">
                        {error}
                      </div>
                    ) : null}
                    {loading ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" />
                      </div>
                    ) : contacts.length === 0 ? (
                      <p className="text-muted mb-0">No contacts yet. Add a primary contact for billing email.</p>
                    ) : (
                      <div className="table-responsive border rounded">
                        <table className="table table-hover mb-0 align-middle">
                          <thead className="table-light">
                            <tr>
                              <th />
                              <th>Name</th>
                              <th>Position</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th />
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.map((c) => (
                              <tr key={String(c.id)}>
                                <td style={{ width: 56 }}>
                                  {c.avatar_url ? (
                                    <img
                                      src={c.avatar_url}
                                      alt=""
                                      className="rounded-circle"
                                      style={{ width: 40, height: 40, objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <span className="text-muted small">—</span>
                                  )}
                                </td>
                                <td>
                                  {c.display_name ? String(c.display_name) : '—'}
                                  {c.is_primary ? (
                                    <span className="badge bg-secondary ms-1">Primary</span>
                                  ) : null}
                                  {c.user ? (
                                    <span className="badge bg-light text-dark border ms-1">Login</span>
                                  ) : null}
                                </td>
                                <td>{c.position ? String(c.position) : '—'}</td>
                                <td>
                                  {c.email ? (
                                    <a href={`mailto:${String(c.email)}`}>{String(c.email)}</a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td>{c.phone ? String(c.phone) : '—'}</td>
                                <td className="text-end">
                                  <Button variant="outline-primary" size="sm" onClick={() => openEdit(c)}>
                                    Edit
                                  </Button>
                                </td>
                                <td className="text-end">
                                  <Button variant="outline-danger" size="sm" onClick={() => setDeleteRow(c)}>
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered>
        <Form onSubmit={submitCreate}>
          <Modal.Header closeButton>
            <Modal.Title>Add contact</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-12">
                <Form.Label>Profile image</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCreateAvatar(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>First name *</Form.Label>
                <Form.Control
                  required
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Last name *</Form.Label>
                <Form.Control
                  required
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <Form.Label>Position</Form.Label>
                <Form.Control
                  value={createForm.position}
                  onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <Form.Check
                  type="checkbox"
                  checked={createForm.is_primary}
                  onChange={(e) => setCreateForm((f) => ({ ...f, is_primary: e.target.checked }))}
                  label="Primary contact"
                />
              </div>
              <div className="col-12">
                <Form.Check
                  type="checkbox"
                  checked={createForm.send_password_setup_email}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setCreateForm((f) => ({
                      ...f,
                      send_password_setup_email: v,
                      ...(v ? { password: '' } : {})
                    }));
                  }}
                  label="Email a link to set their password (invitation)"
                />
                <div className="form-text">
                  When checked, TillFlow emails the <strong>address above</strong> a secure link to choose a password and
                  activate login. The password field below is not used for invitations.
                </div>
              </div>
              <div className="col-12">
                <Form.Label>
                  {createForm.send_password_setup_email
                    ? 'Password (not used — they set it via the email link)'
                    : 'Password'}
                </Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="new-password"
                  disabled={createForm.send_password_setup_email}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(editRow)} onHide={() => setEditRow(null)} size="lg" centered>
        <Form onSubmit={submitEdit}>
          <Modal.Header closeButton>
            <Modal.Title>Edit contact</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-12">
                <Form.Label>New profile image</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditAvatar(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>First name *</Form.Label>
                <Form.Control
                  required
                  value={editForm.first_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Last name *</Form.Label>
                <Form.Control
                  required
                  value={editForm.last_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <Form.Label>Position</Form.Label>
                <Form.Control
                  value={editForm.position}
                  onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <Form.Check
                  type="checkbox"
                  checked={editForm.is_primary}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_primary: e.target.checked }))}
                  label="Primary contact"
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(deleteRow)} onHide={() => setDeleteRow(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete contact</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteRow ? (
            <p className="mb-0">
              Remove <strong>{deleteRow.display_name ?? 'this contact'}</strong> from your company?
            </p>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteRow(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={saving} onClick={() => void confirmDelete()}>
            {saving ? '…' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
