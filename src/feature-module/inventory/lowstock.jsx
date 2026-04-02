import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import EditLowStock from '../../core/modals/inventory/editlowstock';
import TooltipIcons from '../../components/tooltip-content/tooltipIcons';
import RefreshIcon from '../../components/tooltip-content/refresh';
import CollapesIcon from '../../components/tooltip-content/collapes';
import CommonFooter from '../../components/footer/commonFooter';
import DeleteModal from '../../components/delete-modal';
import InventoryDreamsList, { resolveImageSrc } from '../../components/inventory/InventoryDreamsList';

const LowStock = () => {
  const raw = useSelector((state) => state.rootReducer.lowstock_data);
  const [tab, setTab] = useState('low');

  const displayed = useMemo(() => {
    const list = raw ?? [];
    if (tab === 'out') {
      return list.filter((r) => Number(String(r.qty).replace(/\D/g, '')) === 0);
    }
    return list;
  }, [raw, tab]);

  const columns = [
    { key: 'warehouse', header: 'Warehouse' },
    { key: 'store', header: 'Store' },
    {
      key: 'product',
      header: 'Product',
      render: (row) => {
        const src = resolveImageSrc(row.img);
        return (
          <span className="productimgname">
            <Link to="#" className="product-img stock-img">
              {src ? <img alt="" src={src} /> : null}
            </Link>
            {row.product}
          </span>
        );
      },
    },
    { key: 'category', header: 'Category' },
    { key: 'sku', header: 'SKU', className: 'tf-mono' },
    { key: 'qty', header: 'Qty' },
    { key: 'qtyalert', header: 'Qty Alert' },
  ];

  const filterDropdowns = (
    <>
      <div className="dropdown me-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
        >
          Warehouse
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Lavish Warehouse</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Quaint Warehouse</span>
          </li>
        </ul>
      </div>
      <div className="dropdown me-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
        >
          Store
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Crinol</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Selosy</span>
          </li>
        </ul>
      </div>
      <div className="dropdown me-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
        >
          Category
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Laptop</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Electronics</span>
          </li>
        </ul>
      </div>
      <div className="dropdown me-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
        >
          Product
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <span className="dropdown-item rounded-1 text-muted">Lenovo</span>
          </li>
          <li>
            <span className="dropdown-item rounded-1 text-muted">Nike</span>
          </li>
        </ul>
      </div>
    </>
  );

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <InventoryDreamsList
            renderPageHeader={
              <>
                <div className="page-title me-auto">
                  <h4 className="fw-bold">Low Stocks</h4>
                  <h6>Manage your low stocks</h6>
                </div>
                <ul className="table-top-head low-stock-top-head">
                  <TooltipIcons />
                  <RefreshIcon />
                  <CollapesIcon />
                  <li>
                    <Link
                      to="#"
                      className="btn btn-secondary w-auto shadow-none"
                      data-bs-toggle="modal"
                      data-bs-target="#send-email"
                    >
                      <i className="feather icon-mail feather-mail me-1" />
                      Send Email
                    </Link>
                  </li>
                </ul>
              </>
            }
            beforeCard={
              <div className="table-tab">
                <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                  <ul className="nav nav-pills low-stock-tab d-flex me-2 mb-0" role="tablist">
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        className={`nav-link ${tab === 'low' ? 'active' : ''}`}
                        onClick={() => setTab('low')}
                      >
                        Low Stocks
                      </button>
                    </li>
                    <li className="nav-item" role="presentation">
                      <button
                        type="button"
                        className={`nav-link ${tab === 'out' ? 'active' : ''}`}
                        onClick={() => setTab('out')}
                      >
                        Out of Stocks
                      </button>
                    </li>
                  </ul>
                  <div className="notify d-flex bg-white p-1 px-2 border rounded">
                    <div className="status-toggle text-secondary d-flex justify-content-between align-items-center">
                      <input type="checkbox" id="lowstock-notify" className="check" defaultChecked />
                      <label htmlFor="lowstock-notify" className="checktoggle me-2">
                        checkbox
                      </label>
                      Notify
                    </div>
                  </div>
                </div>
              </div>
            }
            addButton={null}
            data={displayed}
            columns={columns}
            hideCardHeaderDropdowns
            cardHeaderEnd={filterDropdowns}
            tableWrapperClass="category-table"
            editModalTarget="#edit-stock"
          />

          <div className="modal fade" id="send-email">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="success-email-send modal-body .custom-modal-body text-center">
                  <span className="rounded-circle d-inline-flex p-2 bg-success-transparent mb-2">
                    <i className="ti ti-checks fs-24 text-success" />
                  </span>
                  <h4 className="fs-20 fw-semibold">Success</h4>
                  <p>Email Sent Successfully</p>
                  <Link to="#" className="btn btn-primary p-1 px-2 fs-13 fw-normal" data-bs-dismiss="modal">
                    Close
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      <EditLowStock />
      <DeleteModal />
    </div>
  );
};

export default LowStock;
