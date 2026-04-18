import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { TillFlowApiError } from '../api/errors';
import { listBillersRequest } from '../api/billers';
import { listCustomersRequest } from '../api/customers';
import { listLeadsRequest } from '../api/leads';
import {
  acceptProposalRequest,
  createProposalRequest,
  deleteProposalRequest,
  getProposalRequest,
  listProposalsRequest,
  sendProposalToRecipientRequest,
  updateProposalRequest
} from '../api/proposals';
import { listSalesCatalogProductsRequest } from '../api/products';
import { useAuth } from '../auth/AuthContext';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import {
  apiFormSalesLineToPayload,
  displayLineAmount,
  emptyApiSalesLine,
  filterValidApiSalesLines,
  roundMoney
} from '../../utils/salesDocumentLineItems';
import { validityOneMonthAfter } from '../../utils/defaultDocumentValidity';

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `Ksh ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminProposals() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isNew = location.pathname.endsWith('/proposals/new');
  const editId = params.proposalId && location.pathname.includes('/edit') ? params.proposalId : null;

  const [proposals, setProposals] = useState([]);
  const [listLoading, setListLoading] = useState(!isNew && !editId);
  const [listError, setListError] = useState('');

  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [billers, setBillers] = useState([]);

  const [recipientKind, setRecipientKind] = useState('lead');
  const [leadId, setLeadId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [proposedAt, setProposedAt] = useState(() => todayISODate());
  const [expiresAt, setExpiresAt] = useState(() => validityOneMonthAfter(todayISODate()));
  const [proposalTitle, setProposalTitle] = useState('');
  const [billerId, setBillerId] = useState('');
  const [lines, setLines] = useState(() => [emptyApiSalesLine()]);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [loadedProposal, setLoadedProposal] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [sendModal, setSendModal] = useState(null);
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendSubmitting, setSendSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const [acceptModal, setAcceptModal] = useState(null);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [acceptPendingKind, setAcceptPendingKind] = useState(null);
  const [acceptError, setAcceptError] = useState('');
  const [acceptSuccess, setAcceptSuccess] = useState(null);

  const lineTotalSum = useMemo(
    () => roundMoney(lines.reduce((s, l) => s + displayLineAmount(l, catalogProducts, Boolean(token)), 0)),
    [lines, catalogProducts, token]
  );

  const loadLists = useCallback(async () => {
    if (!token) return;
    try {
      const [lp, lc, pr, bl] = await Promise.all([
        listLeadsRequest(token).catch(() => ({ leads: [] })),
        listCustomersRequest(token).catch(() => ({ customers: [] })),
        listSalesCatalogProductsRequest(token).catch(() => ({ data: [] })),
        listBillersRequest(token).catch(() => ({ billers: [] }))
      ]);
      setLeads(Array.isArray(lp?.leads) ? lp.leads : []);
      setCustomers(Array.isArray(lc?.customers) ? lc.customers : []);
      const pdata = pr?.products ?? [];
      setCatalogProducts(Array.isArray(pdata) ? pdata : []);
      setBillers(Array.isArray(bl?.billers) ? bl.billers : []);
    } catch {
      /* ignore */
    }
  }, [token]);

  const loadProposalList = useCallback(async () => {
    if (!token || isNew || editId) return;
    setListError('');
    setListLoading(true);
    try {
      const data = await listProposalsRequest(token);
      setProposals(Array.isArray(data?.proposals) ? data.proposals : []);
    } catch (e) {
      if (e instanceof TillFlowApiError) {
        setListError(e.message);
      } else {
        setListError('Could not load proposals.');
      }
    } finally {
      setListLoading(false);
    }
  }, [token, isNew, editId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadProposalList();
  }, [loadProposalList]);

  useEffect(() => {
    const qLead = searchParams.get('leadId');
    if (isNew && qLead) {
      setRecipientKind('lead');
      setLeadId(qLead);
    }
  }, [isNew, searchParams]);

  useEffect(() => {
    if (!token || !editId) return;
    let cancelled = false;
    (async () => {
      setFormError('');
      try {
        const data = await getProposalRequest(token, editId);
        const p = data?.proposal;
        if (!p || cancelled) return;
        setLoadedProposal(p);
        setRecipientKind(p.customer_id ? 'customer' : 'lead');
        setLeadId(p.lead_id ? String(p.lead_id) : '');
        setCustomerId(p.customer_id ? String(p.customer_id) : '');
        setProposedAt(p.proposed_at ? String(p.proposed_at).slice(0, 10) : todayISODate());
        setExpiresAt(p.expires_at ? String(p.expires_at).slice(0, 10) : '');
        setProposalTitle(p.proposal_title ?? '');
        setBillerId(p.biller_id ? String(p.biller_id) : '');
        if (Array.isArray(p.items) && p.items.length > 0) {
          setLines(
            p.items.map((it) => ({
              key: `line-${it.id}`,
              productId: it.product_id != null ? String(it.product_id) : '',
              quantity: String(it.quantity ?? '1'),
              unitPrice: it.unit_price != null ? String(it.unit_price) : '',
              taxPercent: String(it.tax_percent ?? '16'),
              customLabel: it.product_id ? '' : it.product_name ?? '',
              description: it.description ?? ''
            }))
          );
        } else {
          setLines([emptyApiSalesLine()]);
        }
      } catch (e) {
        if (!cancelled) {
          setFormError(e instanceof TillFlowApiError ? e.message : 'Could not load proposal.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, editId]);

  const buildPayload = () => {
    const validLines = filterValidApiSalesLines(lines);
    if (validLines.length === 0) {
      throw new Error('Add at least one line with a product or custom item name.');
    }
    const items = validLines.map((l) => apiFormSalesLineToPayload(l, catalogProducts));
    const body = {
      proposed_at: proposedAt,
      status: 'Draft',
      items
    };
    if (expiresAt.trim()) body.expires_at = expiresAt.trim();
    if (proposalTitle.trim()) body.proposal_title = proposalTitle.trim();
    if (billerId) body.biller_id = Number(billerId);
    if (recipientKind === 'lead') {
      if (!leadId) throw new Error('Choose a lead.');
      body.lead_id = Number(leadId);
    } else {
      if (!customerId) throw new Error('Choose a customer.');
      body.customer_id = Number(customerId);
    }
    return body;
  };

  const saveProposal = async () => {
    if (!token) return;
    setFormError('');
    setFormSaving(true);
    try {
      const body = buildPayload();
      if (isNew) {
        await createProposalRequest(token, body);
        navigate('/tillflow/admin/proposals');
      } else if (editId) {
        await updateProposalRequest(token, editId, body);
        navigate('/tillflow/admin/proposals');
      }
    } catch (e) {
      setFormError(e instanceof TillFlowApiError ? e.message : e?.message || 'Could not save proposal.');
    } finally {
      setFormSaving(false);
    }
  };

  const openSend = (p) => {
    setSendError('');
    setSendSuccess('');
    const def = p.customer_email || p.lead_email || '';
    setSendTo(def);
    setSendSubject(`Proposal ${p.proposal_ref}`);
    setSendMessage('');
    setSendModal(p);
  };

  const submitSend = async (e) => {
    e.preventDefault();
    if (!token || !sendModal) return;
    setSendError('');
    setSendSuccess('');
    setSendSubmitting(true);
    try {
      await sendProposalToRecipientRequest(token, sendModal.id, {
        to: sendTo.trim(),
        subject: sendSubject.trim() || undefined,
        message: sendMessage.trim() || undefined
      });
      setSendModal(null);
      await loadProposalList();
      setSendSuccess('Proposal email sent successfully.');
    } catch (err) {
      setSendError(err instanceof TillFlowApiError ? err.message : 'Send failed.');
    } finally {
      setSendSubmitting(false);
    }
  };

  const openAcceptModal = (p) => {
    setAcceptError('');
    setAcceptPendingKind(null);
    setAcceptModal(p);
  };

  const submitAccept = async (convertTo) => {
    if (!token || !acceptModal) return;
    setAcceptError('');
    setAcceptPendingKind(convertTo);
    setAcceptSubmitting(true);
    try {
      const data = await acceptProposalRequest(token, acceptModal.id, { convert_to: convertTo });
      const q = data?.quotation;
      const inv = data?.invoice;
      setAcceptModal(null);
      await loadProposalList();
      const qid = q?.id ?? null;
      const invId = inv?.id ?? null;
      if (convertTo === 'quotation' && qid != null) {
        setAcceptSuccess(null);
        window.setTimeout(() => {
          navigate(`/tillflow/admin/quotations/${encodeURIComponent(String(qid))}/edit`);
        }, 100);
      } else if (convertTo === 'invoice' && invId != null) {
        setAcceptSuccess(null);
        window.setTimeout(() => {
          navigate(`/tillflow/admin/invoices/${encodeURIComponent(String(invId))}/edit`);
        }, 100);
      } else {
        setAcceptSuccess({
          quotationId: qid,
          quoteRef: q?.quote_ref || '—',
          invoiceId: invId,
          invoiceRef: inv?.invoice_ref ?? null
        });
      }
    } catch (e) {
      setAcceptError(e instanceof TillFlowApiError ? e.message : 'Could not convert this proposal.');
    } finally {
      setAcceptSubmitting(false);
      setAcceptPendingKind(null);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await deleteProposalRequest(token, deleteTarget.id);
      setDeleteTarget(null);
      await loadProposalList();
    } catch {
      /* */
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (isNew || editId) {
    return (
      <div className="page-wrapper quotation-list-page">
        <div className="content">
          <div className="page-header">
            <div className="page-title">
              <h4>{isNew ? 'New proposal' : `Edit proposal ${loadedProposal?.proposal_ref ?? ''}`}</h4>
              <h6>Lines and totals match quotations</h6>
            </div>
            <div className="page-btn">
              <Link to="/tillflow/admin/proposals" className="btn btn-outline-secondary">
                Back to list
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              {formError ? <div className="alert alert-danger">{formError}</div> : null}
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Recipient</label>
                  <select
                    className="form-select mb-2"
                    value={recipientKind}
                    onChange={(e) => setRecipientKind(e.target.value)}
                    disabled={Boolean(editId)}>
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                  </select>
                  {recipientKind === 'lead' ? (
                    <select className="form-select" value={leadId} onChange={(e) => setLeadId(e.target.value)} required disabled={Boolean(editId)}>
                      <option value="">Select lead…</option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      className="form-select"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      required
                      disabled={Boolean(editId)}>
                      <option value="">Select customer…</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label">Proposed date</label>
                  <input type="date" className="form-control" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Valid until</label>
                  <input type="date" className="form-control" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title (optional)</label>
                  <input className="form-control" value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Biller (optional)</label>
                  <select className="form-select" value={billerId} onChange={(e) => setBillerId(e.target.value)}>
                    <option value="">—</option>
                    {billers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <h6 className="mb-2">Line items</h6>
              <div className="table-responsive mb-2">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Custom item</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Tax %</th>
                      <th className="text-end">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line.key}>
                        <td style={{ minWidth: 140 }}>
                          <select
                            className="form-select form-select-sm"
                            value={line.productId}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, productId: v, customLabel: v ? '' : x.customLabel } : x))
                              );
                            }}>
                            <option value="">—</option>
                            {catalogProducts.slice(0, 500).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            disabled={Boolean(line.productId)}
                            value={line.customLabel}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, customLabel: v } : x)));
                            }}
                          />
                        </td>
                        <td style={{ width: 90 }}>
                          <input
                            className="form-control form-control-sm"
                            value={line.quantity}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)));
                            }}
                          />
                        </td>
                        <td style={{ width: 100 }}>
                          <input
                            className="form-control form-control-sm"
                            value={line.unitPrice}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unitPrice: v } : x)));
                            }}
                          />
                        </td>
                        <td style={{ width: 80 }}>
                          <input
                            className="form-control form-control-sm"
                            value={line.taxPercent}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, taxPercent: v } : x)));
                            }}
                          />
                        </td>
                        <td className="text-end tabular-nums">
                          {formatMoney(displayLineAmount(line, catalogProducts, Boolean(token)))}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={lines.length <= 1}
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-sm btn-outline-primary mb-3" onClick={() => setLines((p) => [...p, emptyApiSalesLine()])}>
                Add line
              </button>

              <div className="d-flex justify-content-between align-items-center">
                <strong>Total (excl. header discount)</strong>
                <strong className="tabular-nums">{formatMoney(lineTotalSum)}</strong>
              </div>
              <p className="text-muted small mt-2 mb-0">Server recalculates totals from lines on save.</p>

              <div className="mt-4">
                <button type="button" className="btn btn-primary me-2" disabled={formSaving} onClick={() => void saveProposal()}>
                  {formSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper quotation-list-page">
      <div className="content">
        <div className="page-header">
          <div className="page-title">
            <h4>Proposals</h4>
            <h6>Send to leads or customers; convert to quotation or invoice</h6>
          </div>
          <div className="page-btn">
            <Link to="/tillflow/admin/proposals/new" className="btn btn-primary">
              New Proposal
            </Link>
          </div>
        </div>

        {listError ? <div className="alert alert-danger">{listError}</div> : null}
        {sendSuccess && !listError ? (
          <div className="alert alert-success" role="status">
            {sendSuccess}
          </div>
        ) : null}

        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Recipient</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-end">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        Loading…
                      </td>
                    </tr>
                  ) : proposals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No proposals.
                      </td>
                    </tr>
                  ) : (
                    proposals.map((p) => (
                      <tr key={p.id}>
                        <td className="fw-medium">{p.proposal_ref}</td>
                        <td>{p.recipient_name}</td>
                        <td className="small">{p.proposed_at}</td>
                        <td>
                          <span
                            className={p.status === 'Accepted' ? 'badge bg-success' : 'badge bg-light text-dark'}>
                            {p.status === 'Accepted' ? 'Accepted' : p.status}
                          </span>
                        </td>
                        <td className="text-end tabular-nums">{formatMoney(p.total_amount)}</td>
                        <td className="text-end text-nowrap">
                          <Link to={`/tillflow/admin/proposals/${p.id}/edit`} className="btn btn-sm btn-outline-secondary me-1">
                            Edit
                          </Link>
                          {p.status !== 'Accepted' ? (
                            <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openSend(p)}>
                              Send
                            </button>
                          ) : null}
                          {p.status === 'Accepted' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-success me-1"
                              disabled
                              title="This proposal has been converted">
                              Accepted
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline-success me-1" onClick={() => openAcceptModal(p)}>
                              Convert
                            </button>
                          )}
                          {p.status !== 'Accepted' ? (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(p)}>
                              Delete
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal show={Boolean(sendModal)} onHide={() => setSendModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Send proposal</Modal.Title>
        </Modal.Header>
        <form onSubmit={submitSend}>
          <Modal.Body>
            {sendError ? <div className="alert alert-danger py-2">{sendError}</div> : null}
            <div className="mb-2">
              <label className="form-label">To</label>
              <input className="form-control" type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} required />
            </div>
            <div className="mb-2">
              <label className="form-label">Subject</label>
              <input className="form-control" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
            </div>
            <div className="mb-0">
              <label className="form-label">Message</label>
              <textarea className="form-control" rows={4} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setSendModal(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={sendSubmitting}>
              {sendSubmitting ? 'Sending…' : 'Send'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={Boolean(acceptModal)} onHide={() => !acceptSubmitting && setAcceptModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Convert</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {acceptError ? <div className="alert alert-danger py-2 mb-3">{acceptError}</div> : null}
          {acceptModal ? (
            <>
              <p className="text-muted small mb-2">You are about to convert:</p>
              <div className="border rounded-3 p-3 mb-3 bg-light">
                <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-1">
                  <span className="text-uppercase text-muted small fw-semibold">Proposal</span>
                  <span className="fs-4 fw-bold text-success tabular-nums">{acceptModal.proposal_ref}</span>
                </div>
                {acceptModal.proposal_title ? (
                  <p className="text-body-secondary small mb-0">&ldquo;{acceptModal.proposal_title}&rdquo;</p>
                ) : null}
                <dl className="row small mb-0 mt-3">
                  <dt className="col-sm-4 text-muted">Recipient</dt>
                  <dd className="col-sm-8 mb-2">{acceptModal.recipient_name || '—'}</dd>
                  <dt className="col-sm-4 text-muted">Total</dt>
                  <dd className="col-sm-8 mb-2 fw-semibold tabular-nums">{formatMoney(acceptModal.total_amount)}</dd>
                  <dt className="col-sm-4 text-muted">Proposed</dt>
                  <dd className="col-sm-8 mb-0">{acceptModal.proposed_at || '—'}</dd>
                </dl>
              </div>
              <p className="mb-0 small">
                <strong>Convert → quotation</strong> creates an <strong className="text-success">Accepted</strong>{' '}
                quotation. <strong>Convert → invoice only</strong> creates an invoice from the proposal and does{' '}
                <strong>not</strong> create a quotation (requires <span className="text-nowrap">sales.invoices.manage</span>
                ).
                {acceptModal.lead_id ? (
                  <>
                    {' '}
                    The lead will be marked <strong>Closed won</strong> and a <strong>customer</strong> record will be
                    created (or linked if you resolve a duplicate separately).
                  </>
                ) : (
                  <> For this customer.</>
                )}
              </p>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="flex-wrap gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary" disabled={acceptSubmitting} onClick={() => setAcceptModal(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={acceptSubmitting}
            onClick={() => void submitAccept('quotation')}>
            {acceptSubmitting && acceptPendingKind === 'quotation' ? 'Converting…' : 'Convert → quotation'}
          </button>
          <button
            type="button"
            className="btn btn-success"
            disabled={acceptSubmitting}
            onClick={() => void submitAccept('invoice')}>
            {acceptSubmitting && acceptPendingKind === 'invoice' ? 'Converting…' : 'Convert → invoice only'}
          </button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(acceptSuccess)} onHide={() => setAcceptSuccess(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-success">Converted</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {acceptSuccess ? (
            <div className="text-center py-2">
              {acceptSuccess.invoiceId ? (
                <>
                  <p className="text-muted small mb-2">
                    {acceptSuccess.quotationId ? 'Quotation and invoice created' : 'Invoice created'}
                  </p>
                  <p className="fs-3 fw-bold text-primary tabular-nums mb-1">{acceptSuccess.invoiceRef}</p>
                  <p className="small text-body-secondary mb-2">Invoice</p>
                  {acceptSuccess.quotationId ? (
                    <p className="small text-muted mb-0">
                      Quotation <strong className="tabular-nums">{acceptSuccess.quoteRef}</strong> is in{' '}
                      <strong>Quotations</strong>.
                    </p>
                  ) : (
                    <p className="small text-muted mb-0">
                      No quotation was created. Open the invoice to print, send, or record payments.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-muted small mb-2">Quotation created</p>
                  <p className="fs-3 fw-bold text-primary tabular-nums mb-3">{acceptSuccess.quoteRef}</p>
                  <p className="small text-body-secondary mb-0">
                    You can open it in <strong>Quotations</strong> to print, send, or convert to an invoice.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="justify-content-center gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setAcceptSuccess(null)}>
            Close
          </button>
          {acceptSuccess?.invoiceId ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const id = acceptSuccess.invoiceId;
                setAcceptSuccess(null);
                navigate(`/tillflow/admin/invoices/${encodeURIComponent(String(id))}/edit`);
              }}>
              Open invoice
            </button>
          ) : null}
          {acceptSuccess?.quotationId ? (
            <button
              type="button"
              className={`btn ${acceptSuccess?.invoiceId ? 'btn-outline-primary' : 'btn-primary'}`}
              onClick={() => {
                const id = acceptSuccess.quotationId;
                setAcceptSuccess(null);
                navigate(`/tillflow/admin/quotations/${encodeURIComponent(String(id))}/edit`);
              }}>
              Open quotation
            </button>
          ) : null}
        </Modal.Footer>
      </Modal>

      <DeleteConfirmModal
        show={Boolean(deleteTarget)}
        title="Delete proposal?"
        body={deleteTarget ? `Delete ${deleteTarget.proposal_ref}?` : ''}
        confirmLabel="Delete"
        submitting={deleteSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
