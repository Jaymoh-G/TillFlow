import { useCallback, useMemo, useState } from "react";
import SettingsSideBar from "../settingssidebar";
import { useLocation } from "react-router-dom";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonFooter from "../../../components/footer/commonFooter";
import CommonSelect from "../../../components/select/common-select";
import { loadAppSettings, newLocalId, saveAppSettings } from "../../../utils/appSettingsStorage";
import { useReloadFromTenantUiSettingsHydration } from "../../../tillflow/tenantUiSettings/useReloadFromTenantUiSettingsHydration";

const CONNECTION_OPTIONS = [
  { value: "Network", label: "Network" },
  { value: "USB", label: "USB" },
  { value: "Bluetooth", label: "Bluetooth" }
];

const emptyForm = () => ({
  name: "",
  connectionType: "Network",
  ipAddress: "",
  port: "9100"
});

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

const PrinterSettings = () => {
  const location = useLocation();
  const isTillflow = location.pathname.startsWith("/tillflow/admin");

  const [printers, setPrinters] = useState(() => loadAppSettings().printers);
  const [savedMsg, setSavedMsg] = useState("");
  const [dialog, setDialog] = useState(
    /** @type {null | { mode: "add" } | { mode: "edit"; id: string }} */ (null)
  );
  const [form, setForm] = useState(emptyForm);

  const persist = useCallback((nextPrinters) => {
    const app = loadAppSettings();
    app.printers = nextPrinters;
    saveAppSettings(app);
    setPrinters(nextPrinters);
    setSavedMsg("Printers saved.");
    window.setTimeout(() => setSavedMsg(""), 3500);
  }, []);

  const reloadPrintersFromServerCache = useCallback(() => {
    setPrinters(loadAppSettings().printers);
    setSavedMsg("");
  }, []);
  useReloadFromTenantUiSettingsHydration(reloadPrintersFromServerCache);

  const openAdd = useCallback(() => {
    setForm(emptyForm());
    setDialog({ mode: "add" });
  }, []);

  const openEdit = useCallback((row) => {
    setForm({
      name: row.name,
      connectionType: row.connectionType,
      ipAddress: row.ipAddress,
      port: row.port
    });
    setDialog({ mode: "edit", id: row.id });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const saveDialog = useCallback(() => {
    const name = form.name.trim();
    if (!name) {
      return;
    }
    if (!dialog) {
      return;
    }
    if (dialog.mode === "add") {
      persist([
        ...printers,
        {
          id: newLocalId(),
          name,
          connectionType: form.connectionType,
          ipAddress: form.ipAddress.trim(),
          port: form.port.trim()
        }
      ]);
    } else {
      persist(
        printers.map((p) =>
          p.id === dialog.id
            ? {
                ...p,
                name,
                connectionType: form.connectionType,
                ipAddress: form.ipAddress.trim(),
                port: form.port.trim()
              }
            : p
        )
      );
    }
    closeDialog();
  }, [closeDialog, dialog, form, persist, printers]);

  const removeRow = useCallback(
    (id) => {
      if (!window.confirm("Remove this printer from the list?")) {
        return;
      }
      persist(printers.filter((p) => p.id !== id));
    },
    [persist, printers]
  );

  const tableRows = useMemo(() => printers, [printers]);

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
                      <h4 className="mb-0">Printers</h4>
                      {isTillflow ? (
                        <p className="text-muted small mb-0">
                          Register printers for receipts and documents (local to this browser).
                        </p>
                      ) : null}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={openAdd}>
                      <i className="ti ti-circle-plus me-1" />
                      Add printer
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
                            <th>Printer name</th>
                            <th>Connection</th>
                            <th>IP / host</th>
                            <th>Port</th>
                            <th className="no-sort" />
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-muted py-4 text-center">
                                No printers yet. Add one for each station or document type.
                              </td>
                            </tr>
                          ) : (
                            tableRows.map((row) => (
                              <tr key={row.id}>
                                <td>{row.name}</td>
                                <td>{row.connectionType}</td>
                                <td>{row.ipAddress || "—"}</td>
                                <td>{row.port || "—"}</td>
                                <td className="action-table-data">
                                  <div className="edit-delete-action">
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-dark me-2 p-2"
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
          title={dialog.mode === "add" ? "Add printer" : "Edit printer"}
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
              <label className="form-label">
                Printer name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Connection type</label>
              <CommonSelect
                filter={false}
                options={CONNECTION_OPTIONS}
                value={form.connectionType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, connectionType: e?.value ?? "Network" }))
                }
                appendTo="body"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">IP address or hostname</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 192.168.1.50"
                value={form.ipAddress}
                onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))}
              />
            </div>
            <div className="mb-0">
              <label className="form-label">Port</label>
              <input
                type="text"
                className="form-control"
                placeholder="9100"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              />
            </div>
          </>
        </ModalFrame>
      ) : null}
    </>
  );
};

export default PrinterSettings;
