import { tillflowFetch, tillflowUpload } from './client';

export function listQuotationsRequest(token) {
  return tillflowFetch('/quotations', { token });
}

export function createQuotationRequest(token, body) {
  return tillflowFetch('/quotations', { method: 'POST', token, body });
}

export function updateQuotationRequest(token, id, body) {
  return tillflowFetch(`/quotations/${id}`, { method: 'PATCH', token, body });
}

export function deleteQuotationRequest(token, id) {
  return tillflowFetch(`/quotations/${id}`, { method: 'DELETE', token });
}

/**
 * @param {string} token
 * @param {string|number} id
 * @param {{ to: string, subject?: string, message?: string, cc?: string[] }} body
 * @param {{ pdfBlob?: Blob, attachmentFilename?: string }} [options] — same html2canvas+jsPDF capture as modal Download PDF
 */
export function sendQuotationToCustomerRequest(token, id, body, options = {}) {
  const { pdfBlob, attachmentFilename } = options;
  if (pdfBlob instanceof Blob) {
    const fd = new FormData();
    fd.append('to', body.to ?? '');
    if (body.subject != null && body.subject !== '') {
      fd.append('subject', String(body.subject));
    }
    if (body.message != null && body.message !== '') {
      fd.append('message', String(body.message));
    }
    for (const email of body.cc || []) {
      if (email && String(email).trim()) {
        fd.append('cc[]', String(email).trim());
      }
    }
    const safeId = String(id).replace(/[^\w.-]+/g, '_');
    const fname = attachmentFilename || `quotation-${safeId}.pdf`;
    fd.append('attachment_pdf', pdfBlob, fname);
    return tillflowUpload(`/quotations/${id}/send-to-customer`, { method: 'POST', token, formData: fd });
  }
  return tillflowFetch(`/quotations/${id}/send-to-customer`, { method: 'POST', token, body });
}
