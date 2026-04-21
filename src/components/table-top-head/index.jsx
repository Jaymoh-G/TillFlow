import { Tooltip } from "primereact/tooltip";
import { ChevronDown, ChevronUp, RefreshCw, Upload } from "react-feather";
import { useDispatch, useSelector } from "react-redux";
import { setToggleHeader } from "../../core/redux/sidebarSlice";
import { excel, pdf } from "../../utils/imagepath";

/**
 * @param {object} props
 * @param {() => void} [props.onRefresh]
 * @param {() => void} [props.onExportPdf]
 * @param {() => void} [props.onExportExcel]
 * @param {() => void} [props.onImport]
 * @param {boolean} [props.showCollapse]
 */
const TableTopHead = ({
  onRefresh,
  onExportPdf,
  onExportExcel,
  onImport,
  showCollapse = true
}) => {
  const dispatch = useDispatch();
  const { toggleHeader } = useSelector((state) => state.sidebar);
  const handleToggleHeader = () => {
    dispatch(setToggleHeader(!toggleHeader));
  };

  const exportPdfEnabled = typeof onExportPdf === "function";
  const exportExcelEnabled = typeof onExportExcel === "function";
  const importEnabled = typeof onImport === "function";

  const iconProps = {
    size: 20,
    strokeWidth: 1.75,
    style: { color: "var(--tf-text, currentColor)" }
  };

  return (
    <>
      <Tooltip target=".pr-tooltip" />
      <ul className="table-top-head">
        <li>
          <button
            type="button"
            className="pr-tooltip border-0 bg-transparent p-0"
            data-pr-tooltip="Pdf"
            data-pr-position="top"
            aria-label="Pdf"
            disabled={!exportPdfEnabled}
            title={exportPdfEnabled ? "Export PDF" : "Export PDF (not available)"}
            onClick={exportPdfEnabled ? onExportPdf : undefined}>
            <img src={pdf} alt="" style={{ opacity: exportPdfEnabled ? 1 : 0.45 }} />
          </button>
        </li>
        <li>
          <button
            type="button"
            className="pr-tooltip border-0 bg-transparent p-0 d-inline-flex align-items-center justify-content-center"
            data-pr-tooltip="Import"
            data-pr-position="top"
            aria-label="Import"
            disabled={!importEnabled}
            title={importEnabled ? "Import spreadsheet" : "Import (not available)"}
            onClick={importEnabled ? onImport : undefined}>
            <Upload {...iconProps} style={{ ...iconProps.style, opacity: importEnabled ? 1 : 0.45 }} />
          </button>
        </li>
        <li>
          <button
            type="button"
            className="pr-tooltip border-0 bg-transparent p-0"
            data-pr-tooltip="Excel"
            data-pr-position="top"
            aria-label="Excel"
            disabled={!exportExcelEnabled}
            title={exportExcelEnabled ? "Export Excel" : "Export Excel (not available)"}
            onClick={exportExcelEnabled ? onExportExcel : undefined}>
            <img src={excel} alt="" style={{ opacity: exportExcelEnabled ? 1 : 0.45 }} />
          </button>
        </li>
        <li>
          {typeof onRefresh === "function" ? (
            <button
              type="button"
              className="pr-tooltip border-0 bg-transparent p-0 d-inline-flex align-items-center justify-content-center"
              data-pr-tooltip="Refresh"
              data-pr-position="top"
              onClick={onRefresh}
              title="Refresh">
              <RefreshCw {...iconProps} />
            </button>
          ) : (
            <span
              className="pr-tooltip d-inline-flex align-items-center justify-content-center"
              data-pr-tooltip="Refresh"
              data-pr-position="top"
              aria-hidden>
              <RefreshCw size={20} strokeWidth={1.75} className="text-muted" />
            </span>
          )}
        </li>
        {showCollapse ? (
          <li>
            <button
              type="button"
              className="pr-tooltip border-0 bg-transparent p-0 d-inline-flex align-items-center justify-content-center"
              data-pr-tooltip="Collapse"
              data-pr-position="top"
              id="collapse-header"
              onClick={handleToggleHeader}
              aria-label="Toggle header collapse"
              title="Collapse header">
              {toggleHeader ? <ChevronDown {...iconProps} /> : <ChevronUp {...iconProps} />}
            </button>
          </li>
        ) : null}
      </ul>
    </>
  );
};

export default TableTopHead;
