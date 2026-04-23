import Modal from "react-bootstrap/Modal";

/**
 * Shows the server-rendered invoice email (same Blade as outbound mail) before sending.
 */
export default function InvoiceEmailPreviewModal({
  show,
  onHide,
  loading,
  error,
  html,
  toEmail,
  subject,
  message,
  onChangeToEmail,
  onChangeSubject,
  onChangeMessage,
  onSend,
  sending,
  sendDisabled,
  sendButtonLabel = "Send email",
  showHtmlPreview = false,
  children
}) {
  // When HTML preview is hidden, sending does not depend on client-side `html` (server builds the mail).
  const canSend =
    !sendDisabled && !loading && !error && (showHtmlPreview ? Boolean(html) : true);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable backdrop={sending ? "static" : true}>
      <Modal.Header closeButton={!sending}>
        <Modal.Title>Email preview</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? <p className="text-muted mb-0">Loading preview…</p> : null}
        {error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {error}
          </div>
        ) : null}
        {!loading && !error ? (
          <>
            <div className="mb-3">
              <label className="form-label mb-1">To</label>
              <input
                type="email"
                className="form-control"
                value={toEmail ?? ""}
                onChange={(e) => onChangeToEmail?.(e.target.value)}
                placeholder="customer@example.com"
                disabled={sending}
              />
            </div>
            <div className="mb-3">
              <label className="form-label mb-1">Subject</label>
              <input
                type="text"
                className="form-control"
                value={subject ?? ""}
                onChange={(e) => onChangeSubject?.(e.target.value)}
                placeholder="Email subject"
                disabled={sending}
              />
            </div>
            <div className="mb-3">
              <label className="form-label mb-1">Message template</label>
              <textarea
                className="form-control"
                rows={5}
                value={message ?? ""}
                onChange={(e) => onChangeMessage?.(e.target.value)}
                placeholder="Optional introduction shown above the main content…"
                disabled={sending}
              />
              <div className="form-text">Editable text at the top of the email before the main content.</div>
            </div>
            {children ? <div className="mb-3">{children}</div> : null}
            {showHtmlPreview && html ? (
              <div
                className="border rounded bg-white overflow-hidden"
                style={{ maxHeight: "min(58vh, 440px)" }}>
                <iframe
                  title="Invoice email preview"
                  srcDoc={html}
                  sandbox=""
                  className="w-100 d-block border-0"
                  style={{ minHeight: 300, height: 360 }}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer className="gap-2">
        <button type="button" className="btn btn-secondary" disabled={sending} onClick={onHide}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSend || sending}
          onClick={() => void onSend()}>
          {sending ? "Sending…" : sendButtonLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
