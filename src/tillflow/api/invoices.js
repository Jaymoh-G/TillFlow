import { tillflowFetch, tillflowUpload } from './client';

export function listInvoicesRequest(token) {
  return tillflowFetch('/invoices', { token });
}

export function showInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${id}`, { token });
}

export function createInvoiceRequest(token, body) {
  return tillflowFetch('/invoices', { method: 'POST', token, body });
}

export function updateInvoiceRequest(token, id, body) {
  return tillflowFetch(`/invoices/${id}`, { method: 'PATCH', token, body });
}

export function cancelInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(id))}/cancel`, { method: 'POST', token });
}

export function restoreInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(id))}/restore`, { method: 'POST', token });
}

/**
 * @param {string} token
 * @param {string|number} id
 * @param {{ pdfBlob?: Blob, attachmentFilename?: string, toEmail?: string, subject?: string, message?: string }} [options]
 *   — same html2canvas+jsPDF capture as modal PDF when provided
 */
export function sendInvoiceToCustomerRequest(token, id, options = {}) {
  const { pdfBlob, attachmentFilename, toEmail, subject, message } = options;
  if (pdfBlob instanceof Blob) {
    const fd = new FormData();
    const safeId = String(id).replace(/[^\w.-]+/g, '_');
    const fname = attachmentFilename || `invoice-${safeId}.pdf`;
    fd.append('attachment_pdf', pdfBlob, fname);
    if (typeof toEmail === 'string' && toEmail.trim()) {
      fd.append('to_email', toEmail.trim());
    }
    if (typeof subject === 'string' && subject.trim()) {
      fd.append('subject', subject.trim());
    }
    if (typeof message === 'string' && message.trim()) {
      fd.append('message', message);
    }
    return tillflowUpload(`/invoices/${encodeURIComponent(String(id))}/send-to-customer`, {
      method: 'POST',
      token,
      formData: fd
    });
  }
  const body = {};
  if (typeof toEmail === 'string' && toEmail.trim()) {
    body.to_email = toEmail.trim();
  }
  if (typeof subject === 'string' && subject.trim()) {
    body.subject = subject.trim();
  }
  if (typeof message === 'string' && message.trim()) {
    body.message = message;
  }
  return tillflowFetch(`/invoices/${encodeURIComponent(String(id))}/send-to-customer`, {
    method: 'POST',
    token,
    body: Object.keys(body).length ? body : undefined
  });
}

export function previewInvoiceEmailRequest(token, id) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(id))}/email-preview`, { token });
}

/** @deprecated Invoices are cancelled, not deleted. Use {@link cancelInvoiceRequest}. */
export function deleteInvoiceRequest(token, id) {
  return tillflowFetch(`/invoices/${id}`, { method: 'DELETE', token });
}
