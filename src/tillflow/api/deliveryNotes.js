import { tillflowFetch, tillflowUpload } from "./client";

export function listDeliveryNotesRequest(token, params = {}) {
  const q = new URLSearchParams();
  if (params.invoice_id != null && params.invoice_id !== "") {
    q.set("invoice_id", String(params.invoice_id));
  }
  if (params.customer_id != null && params.customer_id !== "") {
    q.set("customer_id", String(params.customer_id));
  }
  if (params.status) {
    q.set("status", String(params.status));
  }
  if (params.from) {
    q.set("from", String(params.from));
  }
  if (params.to) {
    q.set("to", String(params.to));
  }
  if (params.q) {
    q.set("q", String(params.q));
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return tillflowFetch(`/delivery-notes${suffix}`, { token });
}

export function showDeliveryNoteRequest(token, id) {
  return tillflowFetch(`/delivery-notes/${encodeURIComponent(String(id))}`, { token });
}

export function listInvoiceDeliveryNotesRequest(token, invoiceId) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(invoiceId))}/delivery-notes`, { token });
}

export function createInvoiceDeliveryNoteRequest(token, invoiceId, body) {
  return tillflowFetch(`/invoices/${encodeURIComponent(String(invoiceId))}/delivery-notes`, {
    method: "POST",
    token,
    body
  });
}

export function updateDeliveryNoteRequest(token, id, body) {
  return tillflowFetch(`/delivery-notes/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    token,
    body
  });
}

export function cancelDeliveryNoteRequest(token, id) {
  return tillflowFetch(`/delivery-notes/${encodeURIComponent(String(id))}/cancel`, {
    method: "POST",
    token
  });
}

export function previewDeliveryNoteEmailRequest(token, id) {
  return tillflowFetch(`/delivery-notes/${encodeURIComponent(String(id))}/email-preview`, { token });
}

export function sendDeliveryNoteToCustomerRequest(token, id, options = {}) {
  const { pdfBlob, attachmentFilename, toEmail, subject, message } = options;
  if (pdfBlob instanceof Blob) {
    const fd = new FormData();
    const safeId = String(id).replace(/[^\w.-]+/g, "_");
    const fname = attachmentFilename || `delivery-note-${safeId}.pdf`;
    fd.append("attachment_pdf", pdfBlob, fname);
    if (typeof toEmail === "string" && toEmail.trim()) {
      fd.append("to_email", toEmail.trim());
    }
    if (typeof subject === "string" && subject.trim()) {
      fd.append("subject", subject.trim());
    }
    if (typeof message === "string" && message.trim()) {
      fd.append("message", message);
    }
    return tillflowUpload(`/delivery-notes/${encodeURIComponent(String(id))}/send-to-customer`, {
      method: "POST",
      token,
      formData: fd
    });
  }
  const body = {};
  if (typeof toEmail === "string" && toEmail.trim()) {
    body.to_email = toEmail.trim();
  }
  if (typeof subject === "string" && subject.trim()) {
    body.subject = subject.trim();
  }
  if (typeof message === "string" && message.trim()) {
    body.message = message;
  }
  return tillflowFetch(`/delivery-notes/${encodeURIComponent(String(id))}/send-to-customer`, {
    method: "POST",
    token,
    body: Object.keys(body).length ? body : undefined
  });
}
