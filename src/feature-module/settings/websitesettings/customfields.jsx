import { useCallback, useState } from "react";
import SettingsSideBar from "../settingssidebar";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CommonFooter from "../../../components/footer/commonFooter";
import CommonSelect from "../../../components/select/common-select";
import { useLocation } from "react-router-dom";
import { loadAppSettings, newLocalId, saveAppSettings } from "../../../utils/appSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const MODULE_OPTIONS = [
  { value: "Product", label: "Product" },
  { value: "Customer", label: "Customer" },
  { value: "Supplier", label: "Supplier" },
  { value: "Biller", label: "Biller" },
  { value: "Sale", label: "Sale" },
  { value: "Invoice", label: "Invoice" }
];

const TYPE_OPTIONS = [
  { value: "Text", label: "Text" },
  { value: "Number", label: "Number" },
  { value: "Select", label: "Select" },
  { value: "Date", label: "Date" },
  { value: "Checkbox", label: "Checkbox" }
];

const REQ_OPTIONS = [
  { value: "Required", label: "Required" },
  { value: "Optional", label: "Optional" }
];

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" }
];

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
  module: "Product",
  label: "",
  type: "Text",
  defaultValue: "",
  requirement: "Optional",
  status: "Active"
});

const CustomFields = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/admin");

  const [rows, setRows] = useState(() => loadAppSettings().customFields);
  const [savedMsg, setSavedMsg] = useState("");
  const [dialog, setDialog] = useState(
    /** @type {null | { mode: "add" } | { mode: "edit"; id: string }} */ (null)
  );
  const [form, setForm] = useState(emptyForm);

  const persist = useCallback((next) => {
    const app = loadAppSettings();
    app.customFields = next;
    saveAppSettings(app);
    setRows(next);
    setSavedMsg("Custom fields saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, []);

  const reloadCustomFieldsFromServerCache = useCallback(() => {
    setRows(loadAppSettings().customFields);
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadCustomFieldsFromServerCache);

  const openAdd = useCallback(() => {
    setForm(emptyForm());
    setDialog({ mode: "add" });
  }, []);

  const openEdit = useCallback((row) => {
    setForm({
      module: row.module,
      label: row.label,
      type: row.type,
      defaultValue: row.defaultValue,
      requirement: row.requirement,
      status: row.status
    });
    setDialog({ mode: "edit", id: row.id });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const saveDialog = useCallback(() => {
    const label = form.label.trim();
    if (!label || !dialog) {
      return;
    }
    if (dialog.mode === "add") {
      persist([
        ...rows,
        {
          id: newLocalId(),
          module: form.module,
          label,
          type: form.type,
          defaultValue: form.defaultValue.trim(),
          requirement: form.requirement,
          status: form.status
        }
      ]);
    } else {
      persist(
        rows.map((r) =>
          r.id === dialog.id
            ? {
                ...r,
                module: form.module,
                label,
                type: form.type,
                defaultValue: form.defaultValue.trim(),
                requirement: form.requirement,
                status: form.status
              }
            : r
        )
      );
    }
    closeDialog();
  }, [closeDialog, dialog, form, persist, rows]);

  const removeRow = useCallback(
    (id) => {
      if (!window.confirm("Remove this custom field?")) {
        return;
      }
      persist(rows.filter((r) => r.id !== id));
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
                      <h4 className="mb-0">Custom fields</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          Extra attributes per module (local to this browser until API sync exists).
                        </p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={openAdd}>
                      <i className="ti ti-circle-plus me-1" />
                      Add field
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
                            <th>Module</th>
                            <th>Label</th>
                            <th>Type</th>
                            <th>Default</th>
                            <th>Required</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-muted py-4 text-center">
                                No custom fields. Add labels for products, customers, and more.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <h6 className="mb-0">{row.module}</h6>
                                </td>
                                <td>{row.label}</td>
                                <td>{row.type}</td>
                                <td>{row.defaultValue || "—"}</td>
                                <td>{row.requirement}</td>
                                <td>
                                  {row.status === "Active" ? (
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
                                      className="btn btn-link btn-sm text-dark p-2 me-1"
                                      onClick={() => openEdit(row)}
                                      title="Edit">
                                      <i className="ti ti-edit" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-danger p-2"
                                      onClick={() => removeRow(row.id)}
                                      title="Remove">
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
          title={dialog.mode === "add" ? "Add custom field" : "Edit custom field"}
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
              <label className="form-label">Module</label>
              <CommonSelect
                filter
                options={MODULE_OPTIONS}
                value={form.module}
                onChange={(e) => setForm((f) => ({ ...f, module: e?.value ?? "Product" }))}
                appendTo="body"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">
                Label <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Field type</label>
              <CommonSelect
                filter={false}
                options={TYPE_OPTIONS}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e?.value ?? "Text" }))}
                appendTo="body"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Default value</label>
              <input
                type="text"
                className="form-control"
                value={form.defaultValue}
                onChange={(e) => setForm((f) => ({ ...f, defaultValue: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Validation</label>
              <CommonSelect
                filter={false}
                options={REQ_OPTIONS}
                value={form.requirement}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requirement: e?.value ?? "Optional" }))
                }
                appendTo="body"
              />
            </div>
            <div className="mb-0">
              <label className="form-label">Status</label>
              <CommonSelect
                filter={false}
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e?.value ?? "Active" }))}
                appendTo="body"
              />
            </div>
          </>
        </ModalFrame>
      ) : null}
    </>
  );
};

export default CustomFields;
