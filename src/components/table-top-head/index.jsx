import { excel, pdf } from "../../utils/imagepath";
import { Tooltip } from "primereact/tooltip";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { setToggleHeader } from "../../core/redux/sidebarSlice";

const TableTopHead = ({ onRefresh }) => {
  const dispatch = useDispatch();
  const { toggleHeader } = useSelector((state) => state.sidebar);
  const handleToggleHeader = () => {
    dispatch(setToggleHeader(!toggleHeader));
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
            disabled
            title="Export PDF (coming soon)">
            <img src={pdf} alt="" />
          </button>
        </li>
        <li>
          <button
            type="button"
            className="pr-tooltip border-0 bg-transparent p-0"
            data-pr-tooltip="Excel"
            data-pr-position="top"
            aria-label="Excel"
            disabled
            title="Export Excel (coming soon)">
            <img src={excel} alt="" />
          </button>
        </li>
        <li>
          {typeof onRefresh === "function" ? (
            <button
              type="button"
              className="pr-tooltip border-0 bg-transparent p-0"
              data-pr-tooltip="Refresh"
              data-pr-position="top"
              onClick={onRefresh}
              title="Refresh">
              <i className="ti ti-refresh" />
            </button>
          ) : (
            <span
              className="pr-tooltip d-inline-flex"
              data-pr-tooltip="Refresh"
              data-pr-position="top"
              aria-hidden>
              <i className="ti ti-refresh text-muted" />
            </span>
          )}
        </li>
        <li>
          <button
            type="button"
            className="pr-tooltip border-0 bg-transparent p-0"
            data-pr-tooltip="Collapse"
            data-pr-position="top"
            id="collapse-header"
            onClick={handleToggleHeader}
            aria-label="Toggle header collapse">
            <i
              className={`ti  ${toggleHeader ? "ti-chevron-down" : "ti-chevron-up"}`} />
          </button>
        </li>
      </ul>
    </>);

};

export default TableTopHead;