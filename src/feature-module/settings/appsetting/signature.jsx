import { useCallback, useState } from "react";
import CommonFooter from "../../../components/footer/commonFooter";
import SettingsSideBar from "../settingssidebar";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import { signatureImage } from "../../../utils/imagepath";
import { useLocation } from "react-router-dom";
import { loadAppSettings, newLocalId, saveAppSettings } from "../../../utils/appSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

function ModalFrame({ title, onClose, children, footer }) {
  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title mb-0">{title}</h4>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

const emptyForm = () => ({
  name: "",
  active: true,
  isDefault: false,
  imageDataUrl: null
});

const Signature = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/admin");

  const [rows, setRows] = useState(() => loadAppSettings().signatures);
  const [savedMsg, setSavedMsg] = useState("");
  const [dialog, setDialog] = useState(
    /** @type {null | { mode: "add" } | { mode: "edit"; id: string }} */ (null)
  );
  const [form, setForm] = useState(emptyForm);

  const persist = useCallback((next) => {
    const app = loadAppSettings();
    app.signatures = next;
    saveAppSettings(app);
    setRows(next);
    setSavedMsg("Signatures saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, []);

  const reloadSignaturesFromServerCache = useCallback(() => {
    setRows(loadAppSettings().signatures);
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadSignaturesFromServerCache);

  const openAdd = useCallback(() => {
    setForm(emptyForm());
    setDialog({ mode: "add" });
  }, []);

  const openEdit = useCallback((row) => {
    setForm({
      name: row.name,
      active: row.active,
      isDefault: row.isDefault,
      imageDataUrl: row.imageDataUrl
    });
    setDialog({ mode: "edit", id: row.id });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleImage = useCallback((fileList) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    if (file.size > 600 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : null;
      setForm((f) => ({ ...f, imageDataUrl: url }));
    };
    reader.readAsDataURL(file);
  }, []);

  const saveDialog = useCallback(() => {
    const name = form.name.trim();
    if (!name || !dialog) {
      return;
    }
    let next = [...rows];
    if (form.isDefault) {
      next = next.map((s) => ({ ...s, isDefault: false }));
    }
    if (dialog.mode === "add") {
      next.push({
        id: newLocalId(),
        name,
        active: form.active,
        isDefault: form.isDefault,
        imageDataUrl: form.imageDataUrl
      });
    } else {
      next = next.map((s) =>
        s.id === dialog.id
          ? {
              ...s,
              name,
              active: form.active,
              isDefault: form.isDefault,
              imageDataUrl: form.imageDataUrl
            }
          : s
      );
    }
    persist(next);
    closeDialog();
  }, [closeDialog, dialog, form, persist, rows]);

  const removeRow = useCallback(
    (id) => {
      if (!window.confirm("Delete this signature?")) {
        return;
      }
      persist(rows.filter((s) => s.id !== id));
    },
    [persist, rows]
  );

  return (
    <>
      <div className="page-wrapper">
        <div className="content settings-content">
          <div className="page-header settings-pg-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Settings</h4>
                <h6>Manage your settings on portal</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>
          <div className="row">
            <div className="col-xl-12">
              <div className="settings-wrapper d-flex">
                <SettingsSideBar />
                <div className="card flex-fill mb-0 min-w-0">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <h4 className="mb-0">Signatures</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          For quotations and invoices (stored in this browser).
                        </p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={openAdd}>
                      <i className="ti ti-circle-plus me-1" />
                      Add signature
                    </button>
                  </div>
                  <div className="card-body">
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <div className="table-responsive">
                      <table className="table border">
                        <thead className="thead-light">
                          <tr>
                            <th>Name</th>
                            <th>Preview</th>
                            <th>Status</th>
                            <th className="no-sort" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-muted py-4 text-center">
                                No signatures yet.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <h6 className="mb-0">
                                    {row.name}
                                    {row.isDefault ? (
                                      <span className="badge bg-secondary ms-2 small fw-normal">Default</span>
                                    ) : null}
                                  </h6>
                                </td>
                                <td>
                                  <img
                                    src={row.imageDataUrl || signatureImage}
                                    alt=""
                                    style={{ maxHeight: 40, objectFit: "contain" }}
                                  />
                                </td>
                                <td>
                                  {row.active ? (
                                    <span className="badge badge-success d-inline-flex align-items-center badge-xs">
                                      <i className="ti ti-point-filled me-1" />
                                      Active
                                    </span>
                                  ) : (
                                    <span className="badge bg-light text-dark border d-inline-flex align-items-center badge-xs">
                                      Inactive
                                    </span>
                                  )}
                                </td>
                                <td className="action-table-data">
                                  <div className="edit-delete-action">
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-dark p-2"
                                      onClick={() => openEdit(row)}
                                      title="Edit">
                                      <i className="ti ti-edit" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-danger p-2"
                                      onClick={() => removeRow(row.id)}
                                      title="Delete">
                                      <i className="ti ti-trash" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {dialog ? (
        <ModalFrame
          title={dialog.mode === "add" ? "Add signature" : "Edit signature"}
          onClose={closeDialog}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveDialog}>
                Save
              </button>
            </>
          }>
          <>
            <div className="mb-3">
              <label className="form-label d-block">Image (PNG or JPG, max ~600 KB)</label>
              <input type="file" accept="image/*" onChange={(e) => handleImage(e.target.files)} />
              {form.imageDataUrl ? (
                <div className="mt-2">
                  <img src={form.imageDataUrl} alt="" style={{ maxHeight: 80 }} />
                </div>
              ) : null}
            </div>
            <div className="mb-3">
              <label className="checkboxs mb-0 pb-0 line-height-1">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                <span className="checkmarks" />
                Use as default on new documents
              </label>
            </div>
            <div className="mb-3">
              <label className="form-label">
                Signature name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
              <span className="status-label">Active</span>
              <input
                type="checkbox"
                id="sig-active"
                className="check"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="sig-active" className="checktoggle" />
            </div>
          </>
        </ModalFrame>
      ) : null}
    </>
  );
};

export default Signature;
