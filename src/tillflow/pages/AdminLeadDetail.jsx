import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TillFlowApiError } from '../api/errors';
import {
  convertLeadToCustomerRequest,
  getLeadRequest,
  listLeadProposalsRequest
} from '../api/leads';
import { useAuth } from '../auth/AuthContext';

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

export default function AdminLeadDetail() {
  const { leadId } = useParams();
  const { token, hasPermission } = useAuth();

  const [lead, setLead] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState('');
  const [pageError, setPageError] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertMessage, setConvertMessage] = useState('');
  const [convertError, setConvertError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const canConvert =
    Boolean(token) && hasPermission('sales.leads.manage') && hasPermission('sales.customers.manage');
  const canSeeProposals = Boolean(token) && hasPermission('sales.proposals.view');
  const canOpenProposalEdit = Boolean(token) && hasPermission('sales.proposals.manage');

  const load = useCallback(async () => {
    if (!token || !leadId) return;
    setPageError('');
    setProposalsError('');
    setSuccessBanner('');
    setLoading(true);
    try {
      const data = await getLeadRequest(token, leadId);
      setLead(data?.lead ?? null);
    } catch (e) {
      setLead(null);
      if (e instanceof TillFlowApiError) {
        setPageError(e.message);
      } else {
        setPageError('Could not load lead.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, leadId]);

  const loadProposals = useCallback(async () => {
    if (!token || !leadId || !canSeeProposals) {
      setProposals([]);
      return;
    }
    try {
      const data = await listLeadProposalsRequest(token, leadId);
      setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
    } catch (e) {
      setProposals([]);
      if (e instanceof TillFlowApiError) {
        setProposalsError(e.message);
      } else {
        setProposalsError('Could not load proposals for this lead.');
      }
    }
  }, [token, leadId, canSeeProposals]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadProposals();
  }, [loadProposals]);

  const onConvert = async () => {
    if (!token || !leadId || !canConvert) return;
    setConvertError('');
    setConvertMessage('');
    setConvertSubmitting(true);
    try {
      const data = await convertLeadToCustomerRequest(token, leadId, {});
      const c = data?.customer;
      if (data?.lead) {
        setLead(data.lead);
      } else {
        await load();
      }
      if (c?.code) {
        const msg =
          String(data?.message ?? '').toLowerCase().includes('already')
            ? `Linked to customer ${c.code}.`
            : `Customer ${c.code} created and linked.`;
        setConvertMessage(msg);
        setSuccessBanner(msg);
      } else {
        const msg = data?.message || 'Done.';
        setConvertMessage(msg);
        setSuccessBanner(msg);
      }
    } catch (e) {
      setConvertError(e instanceof TillFlowApiError ? e.message : 'Could not convert lead.');
    } finally {
      setConvertSubmitting(false);
    }
  };

  if (!leadId) {
    return null;
  }

  return (
    <div className="page-wrapper quotation-list-page">
      <div className="content">
        <div className="page-header">
          <div className="page-title">
            <h4>Lead {lead?.code ?? ''}</h4>
            <h6>{lead?.name ?? '—'}</h6>
          </div>
          <div className="page-btn d-flex flex-wrap gap-2">
            <Link to="/admin/leads" className="btn btn-outline-secondary">
              Back to leads
            </Link>
            {lead?.id ? (
              <Link
                to={`/admin/proposals/new?leadId=${encodeURIComponent(String(lead.id))}`}
                className="btn btn-primary">
                New Proposal
              </Link>
            ) : null}
          </div>
        </div>

        {pageError ? <div className="alert alert-danger">{pageError}</div> : null}
        {successBanner ? (
          <div className="alert alert-success alert-dismissible" role="status">
            {successBanner}
            <button
              type="button"
              className="btn-close"
              aria-label="Dismiss"
              onClick={() => setSuccessBanner('')}
            />
          </div>
        ) : null}

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : lead ? (
          <>
            <div className="card mb-3">
              <div className="card-header fw-semibold">Details</div>
              <div className="card-body">
                <div className="row g-4 small">
                  <div className="col-12 col-lg-3">
                    <div className="small fw-semibold text-uppercase text-muted mb-3 pb-2 border-bottom border-light">
                      Contact
                    </div>
                    <dl className="mb-0">
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Code</dt>
                        <dd className="mb-0 fw-medium">{lead.code ?? '—'}</dd>
                      </div>
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Name</dt>
                        <dd className="mb-0">{lead.name ?? '—'}</dd>
                      </div>
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Phone</dt>
                        <dd className="mb-0">{lead.phone ?? '—'}</dd>
                      </div>
                      <div className="mb-0">
                        <dt className="text-muted fw-normal mb-1">Email</dt>
                        <dd className="mb-0 text-break">{lead.email?.trim() ? lead.email : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="small fw-semibold text-uppercase text-muted mb-3 pb-2 border-bottom border-light">
                      Company
                    </div>
                    <dl className="mb-0">
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Company</dt>
                        <dd className="mb-0">{lead.company?.trim() ? lead.company : '—'}</dd>
                      </div>
                      <div className="mb-0">
                        <dt className="text-muted fw-normal mb-1">Location</dt>
                        <dd className="mb-0">{lead.location?.trim() ? lead.location : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="small fw-semibold text-uppercase text-muted mb-3 pb-2 border-bottom border-light">
                      Pipeline
                    </div>
                    <dl className="mb-0">
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Source</dt>
                        <dd className="mb-0">{lead.source?.trim() ? lead.source : '—'}</dd>
                      </div>
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Status</dt>
                        <dd className="mb-0">
                          <span className="badge bg-light text-dark">{lead.status ?? '—'}</span>
                        </dd>
                      </div>
                      <div className="mb-0">
                        <dt className="text-muted fw-normal mb-1">Lead value</dt>
                        <dd className="mb-0 tabular-nums">{formatMoney(lead.lead_value)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="col-12 col-lg-3">
                    <div className="small fw-semibold text-uppercase text-muted mb-3 pb-2 border-bottom border-light">
                      Activity
                    </div>
                    <dl className="mb-0">
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Last contacted</dt>
                        <dd className="mb-0 text-muted">{formatListDate(lead.last_contacted_at)}</dd>
                      </div>
                      <div className="mb-3">
                        <dt className="text-muted fw-normal mb-1">Created</dt>
                        <dd className="mb-0 text-muted">{formatListDate(lead.created_at)}</dd>
                      </div>
                      {lead.converted_customer_id ? (
                        <div className="mb-0">
                          <dt className="text-muted fw-normal mb-1">Customer</dt>
                          <dd className="mb-0">
                            <span className="badge bg-success me-2">Converted</span>
                            <Link to="/admin/customers" className="small">
                              View customers
                            </Link>
                            <span className="text-muted small ms-1">(#{lead.converted_customer_id})</span>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {!lead.converted_customer_id && canConvert ? (
              <div className="card mb-3">
                <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div>
                    <div className="fw-semibold mb-1">Convert to customer</div>
                    <p className="text-muted small mb-0">
                      Creates an active customer from this lead&apos;s contact details, or returns the existing link if
                      already converted.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={convertSubmitting}
                    onClick={() => void onConvert()}>
                    {convertSubmitting ? 'Working…' : 'Convert to customer'}
                  </button>
                </div>
                {convertError ? <div className="alert alert-danger mt-3 mb-0 py-2 small">{convertError}</div> : null}
                {convertMessage ? (
                  <div className="alert alert-success mt-3 mb-0 py-2 small" role="status">
                    {convertMessage}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!lead.converted_customer_id && !canConvert ? (
              <div className="alert alert-light border text-muted small mb-3">
                Converting to a customer requires <strong>leads</strong> and <strong>customers</strong> manage
                permissions.
              </div>
            ) : null}

            {canSeeProposals ? (
              <div className="card">
                <div className="card-header fw-semibold">Proposals for this lead</div>
                <div className="card-body p-0">
                  {proposalsError ? <div className="alert alert-warning m-3 mb-0 py-2 small">{proposalsError}</div> : null}
                  {proposals.length === 0 && !proposalsError ? (
                    <p className="text-muted small p-3 mb-0">No proposals yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Title</th>
                            <th>Status</th>
                            <th className="text-end">Total</th>
                            <th>Proposed</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {proposals.map((p) => (
                            <tr key={p.id}>
                              <td className="fw-medium">{p.proposal_ref}</td>
                              <td>{p.proposal_title?.trim() ? p.proposal_title : '—'}</td>
                              <td>
                                <span className="badge bg-light text-dark">{p.status}</span>
                              </td>
                              <td className="text-end tabular-nums">{formatMoney(p.total_amount)}</td>
                              <td className="small text-muted">{p.proposed_at ?? '—'}</td>
                              <td className="text-end text-nowrap">
                                {canOpenProposalEdit ? (
                                  <Link
                                    to={`/admin/proposals/${encodeURIComponent(String(p.id))}/edit`}
                                    className="btn btn-sm btn-outline-primary">
                                    Open
                                  </Link>
                                ) : (
                                  <Link
                                    to={`/admin/proposals/${encodeURIComponent(String(p.id))}`}
                                    className="btn btn-sm btn-outline-secondary">
                                    View
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="alert alert-light border text-muted small">
                Proposal history is hidden without <strong>proposals</strong> view permission.
              </div>
            )}
          </>
        ) : (
          !pageError && <p className="text-muted">Lead not found.</p>
        )}
      </div>
    </div>
  );
}
