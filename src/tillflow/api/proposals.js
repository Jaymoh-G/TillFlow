import { tillflowFetch, tillflowUpload } from './client';

export function listProposalsRequest(token) {
  return tillflowFetch('/proposals', { token });
}

export function getProposalRequest(token, id) {
  return tillflowFetch(`/proposals/${id}`, { token });
}

export function createProposalRequest(token, body) {
  return tillflowFetch('/proposals', { method: 'POST', token, body });
}

export function updateProposalRequest(token, id, body) {
  return tillflowFetch(`/proposals/${id}`, { method: 'PATCH', token, body });
}

export function deleteProposalRequest(token, id) {
  return tillflowFetch(`/proposals/${id}`, { method: 'DELETE', token });
}

export function sendProposalToRecipientRequest(token, id, body, options = {}) {
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
    const fname = attachmentFilename || `proposal-${safeId}.pdf`;
    fd.append('attachment_pdf', pdfBlob, fname);
    return tillflowUpload(`/proposals/${id}/send-to-recipient`, { method: 'POST', token, formData: fd });
  }
  return tillflowFetch(`/proposals/${id}/send-to-recipient`, { method: 'POST', token, body });
}

export function acceptProposalRequest(token, id, body = {}) {
  return tillflowFetch(`/proposals/${id}/accept`, { method: 'POST', token, body });
}
