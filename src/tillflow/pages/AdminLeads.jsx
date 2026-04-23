import { useCallback, useEffect, useMemo, useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import Modal from 'react-bootstrap/Modal';
import { Link } from 'react-router-dom';
import { TillFlowApiError } from '../api/errors';
import { createLeadRequest, deleteLeadRequest, listLeadsRequest, updateLeadRequest } from '../api/leads';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ImportRecordsModal from '../components/ImportRecordsModal';
import { downloadLeadsImportTemplate, parseLeadsImportFile } from '../utils/leadsImport';

const LEAD_STATUSES = [
  'NewLead',
  'Contacted',
  'Responded',
  'ProposalSent',
  'Negotiation',
  'OnHold',
  'ClosedWon',
  'ClosedLost'
];

/** Must match `Lead::SOURCES` in the API. */
const LEAD_SOURCES = [
  'Referral from Friends',
  'From Clients',
  'Website',
  'Facebook',
  'SMS Campaign'
];

function formatListDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `Ksh ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Digits only — avoids `type="number"` stripping leading zeros on phone values. */
function sanitizeLeadPhoneInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 20);
}

export default function AdminLeads() {
  const { token } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addCompany, setAddCompany] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addLocation, setAddLocation] = useState('');
  const [addSource, setAddSource] = useState('');
  const [addStatus, setAddStatus] = useState('NewLead');
  const [addLastContacted, setAddLastContacted] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editStatus, setEditStatus] = useState('NewLead');
  const [editLastContacted, setEditLastContacted] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setListError('');
    setLoading(true);
    try {
      const data = await listLeadsRequest(token);
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError('Could not load leads.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (r) =>
        String(r.name ?? '')
          .toLowerCase()
          .includes(q) ||
        String(r.code ?? '')
          .toLowerCase()
          .includes(q) ||
        String(r.phone ?? '')
          .toLowerCase()
          .includes(q)
    );
  }, [leads, searchQuery]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * rows;
    return filtered.slice(start, start + rows);
  }, [filtered, currentPage, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rows));

  const openAdd = () => {
    setAddError('');
    setAddName('');
    setAddEmail('');
    setAddCompany('');
    setAddPhone('');
    setAddLocation('');
    setAddSource('');
    setAddStatus('NewLead');
    setAddLastContacted('');
    setShowAdd(true);
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!token) return;
    setAddError('');
    setAddSubmitting(true);
    try {
      const phoneDigits = sanitizeLeadPhoneInput(addPhone);
      const body = {
        name: addName.trim(),
        phone: phoneDigits,
        source: addSource,
        status: addStatus
      };
      if (addEmail.trim()) body.email = addEmail.trim();
      if (addCompany.trim()) body.company = addCompany.trim();
      if (addLocation.trim()) body.location = addLocation.trim();
      if (addLastContacted.trim()) body.last_contacted_at = addLastContacted.trim();
      await createLeadRequest(token, body);
      setShowAdd(false);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setAddError(err.message);
      } else {
        setAddError('Could not create lead.');
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (row) => {
    setEditError('');
    setEditingId(row.id);
    setEditName(row.name ?? '');
    setEditEmail(row.email ?? '');
    setEditCompany(row.company ?? '');
    setEditPhone(sanitizeLeadPhoneInput(row.phone ?? ''));
    setEditLocation(row.location ?? '');
    setEditSource(row.source ?? '');
    setEditStatus(row.status ?? 'NewLead');
    setEditLastContacted(row.last_contacted_at ? String(row.last_contacted_at).slice(0, 16) : '');
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!token || !editingId) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      const body = {
        name: editName.trim(),
        phone: sanitizeLeadPhoneInput(editPhone),
        status: editStatus
      };
      body.email = editEmail.trim() || null;
      body.company = editCompany.trim() || null;
      body.location = editLocation.trim() || null;
      body.last_contacted_at = editLastContacted.trim() || null;
      body.source = editSource.trim() || null;
      await updateLeadRequest(token, editingId, body);
      setShowEdit(false);
      setEditingId(null);
      await load();
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setEditError(err.message);
      } else {
        setEditError('Could not update lead.');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await deleteLeadRequest(token, deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch {
      /* toast optional */
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const runImportLeads = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      try {
        await createLeadRequest(token, {
          name: row.name,
          phone: row.phone,
          source: row.source,
          status: row.status,
          email: row.email,
          company: row.company,
          location: row.location,
          last_contacted_at: row.last_contacted_at
        });
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(`Row ${row.sheetRow}: ${e instanceof TillFlowApiError ? e.message : 'Could not create lead.'}`);
      }
    }
    await load();
    setImportSummary({ created, skipped: 0, failed, details });
    setImporting(false);
  }, [token, importRows, load]);

  return (
    <div className="page-wrapper invoice-list-page">
      <div className="content">
        <div className="page-header">
          <div className="page-title">
            <h4>Leads</h4>
            <h6>Pipeline and contact tracking</h6>
          </div>
          <div className="page-btn">
            <button type="button" className="btn btn-outline-primary me-2" onClick={() => setShowImport(true)}>
              Import leads
            </button>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              Add lead
            </button>
          </div>
        </div>

        {listError ? <div className="alert alert-danger">{listError}</div> : null}

        <div className="card">
          <div className="card-body">
            <div className="row mb-3">
              <div className="col-md-6">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search name, code, phone…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="col-md-3 ms-auto text-md-end">
                <select className="form-select" value={rows} onChange={(e) => setRows(Number(e.target.value))}>
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th className="text-end">Lead value</th>
                    <th>Last contacted</th>
                    <th>Created</th>
                    <th className="text-end" style={{ width: '3rem' }}>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        Loading…
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        No leads.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.id}>
                        <td className="fw-medium">{r.code}</td>
                        <td>{r.name}</td>
                        <td>{r.phone}</td>
                        <td>
                          <span className="badge bg-light text-dark">{r.status}</span>
                        </td>
                        <td className="text-end tabular-nums">{formatMoney(r.lead_value)}</td>
                        <td className="small text-muted">{formatListDate(r.last_contacted_at)}</td>
                        <td className="small text-muted">{formatListDate(r.created_at)}</td>
                        <td className="text-end text-nowrap">
                          <div className="edit-delete-action d-flex align-items-center justify-content-end">
                            <Dropdown align="end" drop="down">
                              <Dropdown.Toggle
                                variant="light"
                                id={`lead-actions-${String(r.id)}`}
                                className="btn btn-light border rounded py-1 px-2 d-inline-flex align-items-center justify-content-center invoice-list__row-actions-toggle"
                                aria-label="Lead actions">
                                <i className="ti ti-dots-vertical" />
                              </Dropdown.Toggle>
                              <Dropdown.Menu popperConfig={{ strategy: 'fixed' }} renderOnMount>
                                <Dropdown.Item
                                  as={Link}
                                  to={`/admin/leads/${encodeURIComponent(String(r.id))}`}>
                                  <i className="ti ti-eye me-2 text-dark" aria-hidden />
                                  View
                                </Dropdown.Item>
                                <Dropdown.Item
                                  as={Link}
                                  to={`/admin/proposals/new?leadId=${encodeURIComponent(String(r.id))}`}>
                                  <i className="ti ti-file-text me-2 text-dark" aria-hidden />
                                  New Proposal
                                </Dropdown.Item>
                                <Dropdown.Item as="button" type="button" onClick={() => openEdit(r)}>
                                  <i className="ti ti-edit me-2 text-dark" aria-hidden />
                                  Edit
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item
                                  as="button"
                                  type="button"
                                  className="text-danger"
                                  onClick={() => setDeleteTarget(r)}>
                                  <i className="ti ti-trash me-2" aria-hidden />
                                  Delete
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted small">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add lead</Modal.Title>
        </Modal.Header>
        <form onSubmit={submitAdd}>
          <Modal.Body>
            {addError ? <div className="alert alert-danger py-2">{addError}</div> : null}
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input className="form-control" value={addName} onChange={(e) => setAddName(e.target.value)} required />
            </div>
            <div className="mb-2">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                title="Digits only"
                placeholder="Digits only"
                value={addPhone}
                onChange={(e) => setAddPhone(sanitizeLeadPhoneInput(e.target.value))}
                required
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Company</label>
              <input className="form-control" value={addCompany} onChange={(e) => setAddCompany(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Location</label>
              <input className="form-control" value={addLocation} onChange={(e) => setAddLocation(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Source</label>
              <select
                className="form-select"
                value={addSource}
                onChange={(e) => setAddSource(e.target.value)}
                required>
                <option value="" disabled>
                  Select source…
                </option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label">Status</label>
              <select className="form-select" value={addStatus} onChange={(e) => setAddStatus(e.target.value)}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-0">
              <label className="form-label">Last contacted</label>
              <input
                className="form-control"
                type="datetime-local"
                value={addLastContacted}
                onChange={(e) => setAddLastContacted(e.target.value)}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={addSubmitting}>
              {addSubmitting ? 'Saving…' : 'Save'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showEdit} onHide={() => setShowEdit(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit lead</Modal.Title>
        </Modal.Header>
        <form onSubmit={submitEdit}>
          <Modal.Body>
            {editError ? <div className="alert alert-danger py-2">{editError}</div> : null}
            <div className="mb-2">
              <label className="form-label">Name</label>
              <input className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="mb-2">
              <label className="form-label">Phone</label>
              <input
                className="form-control"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                title="Digits only"
                placeholder="Digits only"
                value={editPhone}
                onChange={(e) => setEditPhone(sanitizeLeadPhoneInput(e.target.value))}
                required
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Company</label>
              <input className="form-control" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Location</label>
              <input className="form-control" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label">Source</label>
              <select className="form-select" value={editSource} onChange={(e) => setEditSource(e.target.value)}>
                <option value="">— Not set —</option>
                {editSource && !LEAD_SOURCES.includes(editSource) ? (
                  <option value={editSource}>{editSource}</option>
                ) : null}
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label">Status</label>
              <select className="form-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-0">
              <label className="form-label">Last contacted</label>
              <input
                className="form-control"
                type="datetime-local"
                value={editLastContacted}
                onChange={(e) => setEditLastContacted(e.target.value)}
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEdit(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Save'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <DeleteConfirmModal
        show={Boolean(deleteTarget)}
        title="Delete lead?"
        body={deleteTarget ? `Delete ${deleteTarget.name} (${deleteTarget.code})?` : ''}
        confirmLabel="Delete"
        submitting={deleteSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <ImportRecordsModal
        show={showImport}
        title="Import leads"
        helpText="Upload .xlsx/.xls/.csv. Required columns: name, phone, source, status."
        previewColumns={[
          { key: 'sheetRow', label: 'Row', render: (r) => r.sheetRow },
          { key: 'name', label: 'Name', render: (r) => r.name },
          { key: 'phone', label: 'Phone', render: (r) => r.phone },
          { key: 'source', label: 'Source', render: (r) => r.source },
          { key: 'status', label: 'Status', render: (r) => r.status }
        ]}
        previewRows={importRows}
        parseErrors={importErrors}
        summary={importSummary}
        importing={importing}
        onClose={() => {
          if (!importing) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        onDownloadTemplate={() => void downloadLeadsImportTemplate()}
        onChooseFile={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          const parsed = await parseLeadsImportFile(file);
          setImportRows(parsed.rows);
          setImportErrors(parsed.errors);
          setImportSummary(null);
        }}
        onImport={() => void runImportLeads()}
      />
    </div>
  );
}
