import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import CommonFooter from '../../components/footer/commonFooter';
import DeleteModal from '../../components/delete-modal';
import InventoryDreamsList from '../../components/inventory/InventoryDreamsList';

export const Units = () => {
  const dataSource = useSelector((state) => state.rootReducer.unit_data);

  const columns = [
    { key: 'unit', header: 'Unit' },
    { key: 'shortname', header: 'Short Name', className: 'tf-mono' },
    { key: 'noofproducts', header: 'No of Products' },
    { key: 'createdon', header: 'Created Date' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="badge table-badge bg-success fw-medium fs-10">{row.status}</span>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <InventoryDreamsList
            title="Units"
            subtitle="Manage your units"
            addButton={{ label: 'Add Unit', modalTarget: '#add-units' }}
            data={dataSource ?? []}
            columns={columns}
            editModalTarget="#edit-units"
          />

          <div className="modal fade" id="add-units">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Add Unit</h4>
                      </div>
                      <button
                        type="button"
                        className="close bg-danger text-white fs-16"
                        data-bs-dismiss="modal"
                        aria-label="Close"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                    <div className="modal-body">
                      <form>
                        <div className="mb-3">
                          <label className="form-label">
                            Unit<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Short Name<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-0">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="add-unit-status" className="check" defaultChecked />
                            <label htmlFor="add-unit-status" className="checktoggle" />
                          </div>
                        </div>
                      </form>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                        data-bs-dismiss="modal"
                      >
                        Cancel
                      </button>
                      <Link to="#" data-bs-dismiss="modal" className="btn btn-primary fs-13 fw-medium p-2 px-3">
                        Add Unit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal fade" id="edit-units">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Edit Unit</h4>
                      </div>
                      <button
                        type="button"
                        className="close bg-danger text-white fs-16"
                        data-bs-dismiss="modal"
                        aria-label="Close"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                    <div className="modal-body">
                      <form>
                        <div className="mb-3">
                          <label className="form-label">
                            Unit<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" defaultValue="Kilograms" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Short Name<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" defaultValue="kg" />
                        </div>
                        <div className="mb-0">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="edit-unit-status" className="check" defaultChecked />
                            <label htmlFor="edit-unit-status" className="checktoggle" />
                          </div>
                        </div>
                      </form>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                        data-bs-dismiss="modal"
                      >
                        Cancel
                      </button>
                      <Link to="#" data-bs-dismiss="modal" className="btn btn-primary fs-13 fw-medium p-2 px-3">
                        Save Changes
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
      <DeleteModal />
    </>
  );
};
