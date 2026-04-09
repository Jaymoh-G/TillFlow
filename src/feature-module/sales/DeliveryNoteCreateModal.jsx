import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { mapInvoiceItemsToDeliveryCandidates } from "./deliveryNoteViewHelpers";

function normalizeQtyInput(raw) {
  const next = String(raw ?? "").replace(/[^0-9.]/g, "");
  const n = Number(next);
  return Number.isFinite(n) ? n : 0;
}

export default function DeliveryNoteCreateModal({ show, onHide, invoiceRow, saving, error, onSubmit }) {
  const [issuedAt, setIssuedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [qtyByItemId, setQtyByItemId] = useState({});

  const candidates = useMemo(() => mapInvoiceItemsToDeliveryCandidates(invoiceRow?.items), [invoiceRow?.items]);

  useEffect(() => {
    if (!show) {
      return;
    }
    setIssuedAt(new Date().toISOString().slice(0, 10));
    setNotes("");
    setQtyByItemId(
      candidates.reduce((acc, row) => {
        acc[String(row.invoiceItemId ?? row.key)] = 0;
        return acc;
      }, {})
    );
  }, [show, candidates]);

  const selectedCount = useMemo(() => {
    return Object.values(qtyByItemId).filter((qty) => Number(qty) > 0).length;
  }, [qtyByItemId]);

  const payloadItems = useMemo(() => {
    return candidates
      .map((row) => {
        const k = String(row.invoiceItemId ?? row.key);
        const qty = Number(qtyByItemId[k] ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          return null;
        }
        const safeQty = Math.min(row.remainingQty, qty);
        return {
          invoice_item_id: row.invoiceItemId,
          product_id: row.productId,
          uom: row.uom || null,
          qty: safeQty
        };
      })
      .filter(Boolean);
  }, [candidates, qtyByItemId]);

  const canSubmit = payloadItems.length > 0 && !saving;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop={saving ? "static" : true}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title>Generate Delivery Note</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Issue date</label>
            <input type="date" className="form-control" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
          <div className="col-md-8">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-control"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions or remarks"
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-end">Invoice qty</th>
                <th className="text-end">Delivered</th>
                <th className="text-end">Remaining</th>
                <th className="text-end" style={{ width: 150 }}>
                  Deliver now
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted text-center py-3">
                    This invoice has no line items.
                  </td>
                </tr>
              ) : (
                candidates.map((row) => {
                  const k = String(row.invoiceItemId ?? row.key);
                  const val = Number(qtyByItemId[k] ?? 0);
                  const disabled = row.remainingQty <= 0;
                  return (
                    <tr key={k}>
                      <td>
                        <span className="fw-medium">{row.productName}</span>
                        {row.uom ? <span className="text-muted small ms-2">({row.uom})</span> : null}
                      </td>
                      <td className="text-end">{row.invoiceQty}</td>
                      <td className="text-end">{row.deliveredQty}</td>
                      <td className="text-end">{row.remainingQty}</td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm text-end"
                          min={0}
                          step="0.001"
                          max={row.remainingQty}
                          value={val}
                          disabled={disabled}
                          onChange={(e) => {
                            const next = Math.min(row.remainingQty, normalizeQtyInput(e.target.value));
                            setQtyByItemId((prev) => ({ ...prev, [k]: next }));
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="small text-muted mb-0 mt-2">{selectedCount} line(s) selected for this delivery note.</p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-light border" disabled={saving} onClick={onHide}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSubmit}
          onClick={() => onSubmit({ issued_at: issuedAt || undefined, notes: notes.trim() || null, items: payloadItems })}>
          {saving ? "Generating..." : "Generate Delivery Note"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
