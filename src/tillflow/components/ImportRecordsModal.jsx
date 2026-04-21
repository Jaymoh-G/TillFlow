import Modal from "react-bootstrap/Modal";

export default function ImportRecordsModal({
  show,
  title,
  helpText,
  previewColumns,
  previewRows,
  parseErrors,
  summary,
  importing,
  onClose,
  onDownloadTemplate,
  onChooseFile,
  onImport
}) {
  return (
    <Modal show={show} onHide={onClose} centered size="lg" scrollable>
      <Modal.Header closeButton={!importing}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!summary ? (
          <>
            <p className="small text-muted mb-2">{helpText}</p>
            <div className="d-flex gap-2 flex-wrap mb-2">
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={onDownloadTemplate}>
                Download template
              </button>
              <label className="btn btn-outline-secondary btn-sm mb-0">
                Upload file
                <input
                  type="file"
                  className="d-none"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={onChooseFile}
                />
              </label>
            </div>
            {parseErrors.length > 0 ? (
              <div className="alert alert-warning py-2">
                <ul className="mb-0 small ps-3">
                  {parseErrors.map((er, i) => (
                    <li key={`${er.sheetRow}-${i}`}>
                      Row {er.sheetRow}: {er.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="table-responsive border rounded" style={{ maxHeight: 320 }}>
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    {previewColumns.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 40).map((row, idx) => (
                    <tr key={`imp-row-${idx}`}>
                      {previewColumns.map((c) => (
                        <td key={`${c.key}-${idx}`}>{c.render(row)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div>
            <p className="mb-2">
              <strong>Created:</strong> {summary.created}, <strong>Skipped:</strong> {summary.skipped ?? 0},{" "}
              <strong>Failed:</strong> {summary.failed}
            </p>
            <ul className="small mb-0 ps-3" style={{ maxHeight: 220, overflow: "auto" }}>
              {(summary.details ?? []).map((d, i) => (
                <li key={`sum-${i}`}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {!summary ? (
          <>
            <button type="button" className="btn btn-light border" onClick={onClose} disabled={importing}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onImport}
              disabled={importing || previewRows.length === 0}>
              {importing ? "Importing..." : "Import"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
