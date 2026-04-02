import Modal from 'react-bootstrap/Modal';

function tillflowModalContainer() {
  if (typeof document === 'undefined') {
    return document.body;
  }
  return document.querySelector('.tillflow-root') || document.body;
}

/**
 * DreamsPOS-style centered delete confirmation (see template delete-modal pattern).
 */
export default function DeleteConfirmModal({
  show,
  onHide,
  title = 'Delete item',
  message,
  confirmLabel = 'Yes Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  submitting = false,
  submittingLabel = 'Deleting…',
}) {
  return (
    <Modal
      show={show}
      onHide={submitting ? () => {} : onHide}
      centered
      backdrop={submitting ? 'static' : true}
      keyboard={!submitting}
      className="tf-delete-modal"
      contentClassName="tf-delete-modal__content"
      container={tillflowModalContainer}
      enforceFocus
    >
      <Modal.Body className="tf-delete-modal__body">
        <span className="tf-delete-modal__icon-wrap" aria-hidden>
          <i className="feather icon-trash-2 tf-delete-modal__icon" />
        </span>
        <h4 className="tf-delete-modal__title">{title}</h4>
        <p className="tf-delete-modal__message">{message}</p>
        <div className="tf-delete-modal__actions">
          <button
            type="button"
            className="tf-btn tf-btn--secondary tf-delete-modal__btn"
            onClick={onHide}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="tf-btn tf-btn--primary tf-delete-modal__btn"
            onClick={() => void onConfirm()}
            disabled={submitting}
          >
            {submitting ? submittingLabel : confirmLabel}
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
