import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import EditCategoryList from '../../core/modals/inventory/editcategorylist';
import CommonFooter from '../../components/footer/commonFooter';
import DeleteModal from '../../components/delete-modal';
import InventoryDreamsList from '../../components/inventory/InventoryDreamsList';

const CategoryList = () => {
  const dataSource = useSelector((state) => state.rootReducer.categotylist_data);

  const columns = [
    { key: 'category', header: 'Category' },
    { key: 'categoryslug', header: 'Category Slug', className: 'tf-mono' },
    { key: 'createdon', header: 'Created On' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <span className="badge bg-success fw-medium fs-10">{row.status}</span>,
    },
  ];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <InventoryDreamsList
            title="Category"
            subtitle="Manage your categories"
            addButton={{ label: 'Add Category', modalTarget: '#add-category' }}
            data={dataSource ?? []}
            columns={columns}
            editModalTarget="#edit-category"
          />

          {/* Add Category */}
          <div className="modal fade" id="add-category">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="page-wrapper-new p-0">
                  <div className="content">
                    <div className="modal-header">
                      <div className="page-title">
                        <h4>Add Category</h4>
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
                            Category<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">
                            Category Slug<span className="text-danger ms-1">*</span>
                          </label>
                          <input type="text" className="form-control" />
                        </div>
                        <div className="mb-0">
                          <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                            <span className="status-label">
                              Status<span className="text-danger ms-1">*</span>
                            </span>
                            <input type="checkbox" id="add-category-status" className="check" defaultChecked />
                            <label htmlFor="add-category-status" className="checktoggle" />
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
                        Add Category
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

      <EditCategoryList />
      <DeleteModal />
    </div>
  );
};

export default CategoryList;
