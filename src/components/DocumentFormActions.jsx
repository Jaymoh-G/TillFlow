import PropTypes from "prop-types";

/**
 * Standard form footer actions for sales documents (quotation/invoice/etc).
 * Enforces consistent visual hierarchy: Cancel = primary, Save = secondary.
 */
export default function DocumentFormActions({
  ui = "bootstrap",
  onCancel,
  cancelLabel = "Cancel",
  saveLabel = "Save",
  saving = false,
  className = ""
}) {
  const isTf = ui === "tillflow";
  const wrap = isTf
    ? `d-flex flex-wrap gap-2 justify-content-end mt-3 ${className}`.trim()
    : `d-flex flex-wrap justify-content-end gap-2 ${className}`.trim();

  const cancelClass = isTf
    ? "tf-btn tf-btn--primary"
    : "btn btn-primary fs-13 fw-medium px-3 shadow-none";
  const saveClass = isTf
    ? "tf-btn tf-btn--secondary"
    : "btn btn-secondary fs-13 fw-medium px-3";

  return (
    <div className={wrap}>
      <button type="button" className={cancelClass} onClick={onCancel}>
        {cancelLabel}
      </button>
      <button type="submit" className={saveClass} disabled={saving}>
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

DocumentFormActions.propTypes = {
  ui: PropTypes.oneOf(["bootstrap", "tillflow"]),
  onCancel: PropTypes.func.isRequired,
  cancelLabel: PropTypes.string,
  saveLabel: PropTypes.string,
  saving: PropTypes.bool,
  className: PropTypes.string
};

