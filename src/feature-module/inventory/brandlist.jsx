import { Link } from 'react-router-dom';
import CommonFooter from '../../components/footer/commonFooter';
import { brandlistdata } from '../../core/json/brandlistdata';
import { brandIcon2 } from '../../utils/imagepath';
import DeleteModal from '../../components/delete-modal';
import InventoryDreamsList, { resolveImageSrc } from '../../components/inventory/InventoryDreamsList';

const BrandList = () => {
  const columns = [
    {
      key: 'brand',
      header: 'Brand',
    },
    {
      key: 'logo',
      header: 'Image',
      render: (row) => {
        const src = resolveImageSrc(row.logo);
        return (
          <span className="productimgname">
            <Link to="#" className="product-img stock-img">
              {src ? <img alt="" src={src} /> : null}
            </Link>
          </span>
        );
      },
    },
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
    <div>
      <div className="page-wrapper">
        <div className="content">
          <InventoryDreamsList
            title="Brand"
            subtitle="Manage your brands"
            addButton={{ label: 'Add Brand', modalTarget: '#add-brand' }}
            data={brandlistdata}
            columns={columns}
            tableWrapperClass="brand-table"
            editModalTarget="#edit-brand"
          />

          <div className="modal fade" id="add-brand">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Add Brand</h4>
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
                    <div className="modal-body custom-modal-body new-employee-field">
                      <form>
                        <div className="profile-pic-upload mb-3">
                          <div className="profile-pic brand-pic">
                            <span>
                              <i className="feather icon-plus-circle plus-down-add" /> Add Image
                            </span>
                          </div>
                          <div>
                            <div className="image-upload mb-0">
                              <input type="file" />
                              <div className="image-uploads">
                                <h4>Upload Image</h4>
                              </div>
                            </div>
                            <p className="mt-2">JPEG, PNG up to 2 MB</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Brand<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-0">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="add-brand-status" className="check" defaultChecked />
                            <label htmlFor="add-brand-status" className="checktoggle" />
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
                        Add Brand
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal fade" id="edit-brand">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Edit Brand</h4>
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
                    <div className="modal-body custom-modal-body new-employee-field">
                      <form>
                        <div className="profile-pic-upload mb-3">
                          <div className="profile-pic brand-pic">
                            <span>
                              <img src={brandIcon2} alt="Img" />
                            </span>
                            <Link to="#" className="remove-photo">
                              <i className="feather icon-x x-square-add" />
                            </Link>
                          </div>
                          <div>
                            <div className="image-upload mb-0">
                              <input type="file" />
                              <div className="image-uploads">
                                <h4>Change Image</h4>
                              </div>
                            </div>
                            <p className="mt-2">JPEG, PNG up to 2 MB</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Brand<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-0">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">Status</span>
                            <input type="checkbox" id="edit-brand-status" className="check" defaultChecked />
                            <label htmlFor="edit-brand-status" className="checktoggle" />
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
    </div>
  );
};

export default BrandList;
