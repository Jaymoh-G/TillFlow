import Modal from "react-bootstrap/Modal";

/**
 * Inline PDF preview (same page). Pass a blob URL from createHtmlDocumentPdfObjectUrl; revoke when closed.
 */
export default function DocumentPdfPreviewModal({ url, title = "PDF preview", onHide }) {
  return (
    <Modal show={Boolean(url)} onHide={onHide} size="xl" fullscreen="lg-down" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 bg-light">
        {url ? (
          <iframe
            title={title}
            src={url}
            className="d-block w-100 border-0 bg-white"
            style={{ height: "min(85vh, 880px)", minHeight: 320 }}
          />
        ) : null}
      </Modal.Body>
    </Modal>
  );
}
