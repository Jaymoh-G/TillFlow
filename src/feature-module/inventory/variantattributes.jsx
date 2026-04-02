import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import CommonFooter from '../../components/footer/commonFooter';
import DeleteModal from '../../components/delete-modal';
import InventoryDreamsList from '../../components/inventory/InventoryDreamsList';

const VariantAttributes = () => {
  const dataSource = useSelector((state) => state.rootReducer.variantattributes_data);

  const columns = [
    { key: 'variant', header: 'Variant' },
    { key: 'values', header: 'Values' },
    { key: 'createdon', header: 'Created On' },
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
            title="Variant Attributes"
            subtitle="Manage your variant attributes"
            addButton={{ label: 'Add Variant', modalTarget: '#add-variant-attribute' }}
            data={dataSource ?? []}
            columns={columns}
            editModalTarget="#edit-variant-attribute"
          />

          <div className="modal fade" id="add-variant-attribute">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Add Variant</h4>
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
                    <div className="modal-body custom-modal-bodys">
                      <form>
                        <div className="mb-3">
                          <label className="form-label">
                            Variant<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Values<span className="text-danger ms-1">*</span>
                          </label>
                          <span className="tag-text mt-2 d-flex">Enter value separated by comma</span>
                        </div>
                        <div className="mb-0 mt-4">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="add-var-status" className="check" defaultChecked />
                            <label htmlFor="add-var-status" className="checktoggle" />
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
                      <Link to="#" className="btn btn-primary fs-13 fw-medium p-2 px-3" data-bs-dismiss="modal">
                        Add Variant
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal fade" id="edit-variant-attribute">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Edit Variant </h4>
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
                            Variant<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" defaultValue="Size" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Values<span className="text-danger ms-1">*</span>
                          </label>
                          <span className="tag-text mt-2 d-flex">Enter value separated by comma</span>
                        </div>
                        <div className="mb-0 mt-3">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="edit-var-status" className="check" defaultChecked />
                            <label htmlFor="edit-var-status" className="checktoggle" />
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
                      <Link to="#" className="btn btn-primary fs-13 fw-medium p-2 px-3" data-bs-dismiss="modal">
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

export default VariantAttributes;
