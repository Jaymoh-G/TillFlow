import { suppliersData } from "../../core/json/suppliers-data";
import PrimeDataTable from "../../components/data-table";
import SearchFromApi from "../../components/data-table/search";
import DeleteModal from "../../components/delete-modal";
import CommonSelect from "../../components/select/common-select";
import TableTopHead from "../../components/table-top-head";
import { editSupplier } from "../../utils/imagepath";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import CommonFooter from "../../components/footer/commonFooter";

const ALL = { label: "All", value: "" };

const Suppliers = () => {
  const routeLocation = useLocation();
  const inTillflowShell = routeLocation.pathname.includes("/tillflow/admin");

  const [sourceRows] = useState(() => [...suppliersData]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);

  const statusOptions = useMemo(
    () => [
      ALL,
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" }
    ],
    []
  );

  const displayRows = useMemo(() => {
    let list = [...sourceRows];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          String(r.supplier).toLowerCase().includes(q) ||
          String(r.email).toLowerCase().includes(q) ||
          String(r.phone).toLowerCase().includes(q) ||
          String(r.code).toLowerCase().includes(q) ||
          String(r.location).toLowerCase().includes(q)
      );
    }
    if (filterStatus) {
      list = list.filter((r) => r.status === filterStatus);
    }
    const locQ = filterLocation.trim().toLowerCase();
    if (locQ) {
      list = list.filter((r) => String(r.location).toLowerCase().includes(locQ));
    }
    return list;
  }, [sourceRows, searchQuery, filterStatus, filterLocation]);

  const totalRecords = displayRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, filterStatus, filterLocation]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterLocation("");
    setCurrentPage(1);
  }, []);

  const columns = useMemo(
    () => [
      { header: "Code", field: "code", sortable: true },
      {
        header: "Supplier",
        field: "supplier",
        sortable: true,
        body: (row) => (
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md me-2">
              <img src={row.avatar} className="img-fluid rounded-2" alt="" />
            </Link>
            <Link to="#">{row.supplier}</Link>
          </div>
        )
      },
      { header: "Email", field: "email", sortable: true },
      { header: "Phone", field: "phone", sortable: true },
      { header: "Location", field: "location", sortable: true },
      {
        header: "Status",
        field: "status",
        sortable: true,
        body: (row) => (
          <span
            className={`d-inline-flex align-items-center p-1 pe-2 rounded-1 text-white fs-10 ${
              row.status === "Active" ? "bg-success" : "bg-danger"
            }`}>
            <i className="ti ti-point-filled me-1 fs-11" />
            {row.status}
          </span>
        )
      },
      {
        header: "",
        field: "actions",
        sortable: false,
        body: () => (
          <div className="edit-delete-action d-flex align-items-center">
            <Link className="me-2 p-2 d-flex align-items-center border rounded" to="#">
              <i className="feather icon-eye" />
            </Link>
            <Link
              className="me-2 p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#edit-supplier">
              <i className="feather icon-edit" />
            </Link>
            <Link
              className="p-2 d-flex align-items-center border rounded"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete-modal">
              <i className="feather icon-trash-2" />
            </Link>
          </div>
        )
      }
    ],
    []
  );

  return (
    <>
      <div
        className={`page-wrapper suppliers-page${
          inTillflowShell ? " suppliers-page--tillflow" : ""
        }`}>
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4 className="fw-bold">Suppliers</h4>
                <h6>Vendors and distributors — search, filter by location or status.</h6>
              </div>
            </div>
            <TableTopHead onRefresh={resetFilters} />
            <div className="page-btn">
              <Link
                to="#"
                className="btn btn-primary text-white"
                data-bs-toggle="modal"
                data-bs-target="#add-supplier">
                <i className="ti ti-circle-plus me-1" />
                Add supplier
              </Link>
            </div>
          </div>
          <div className="card table-list-card manage-stock">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={(v) => setSearchQuery(v ?? "")}
                rows={rows}
                setRows={setRows}
              />
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3 gap-2">
                <div style={{ minWidth: "12rem" }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Location"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    aria-label="Filter by location"
                  />
                </div>
                <div style={{ minWidth: "10rem" }}>
                  <CommonSelect
                    className="w-100"
                    options={statusOptions}
                    value={filterStatus === "" ? "" : filterStatus}
                    onChange={(e) => {
                      const v = e.value;
                      setFilterStatus(v == null || v === "" ? "" : String(v));
                    }}
                    placeholder="Status"
                    filter={false}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="custom-datatable-filter table-responsive">
                <PrimeDataTable
                  column={columns}
                  data={displayRows}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  selectionMode="checkbox"
                  selection={selectedSuppliers}
                  onSelectionChange={(e) => setSelectedSuppliers(e.value)}
                  dataKey="code"
                />
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>
      <div className="modal fade" id="add-supplier">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div className="page-title">
                <h4>Add supplier</h4>
              </div>
              <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form action="#" onSubmit={(e) => e.preventDefault()}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-lg-12">
                    <div className="new-employee-field">
                      <div className="profile-pic-upload mb-2">
                        <div className="profile-pic">
                          <span>
                            <i className="feather icon-plus-circle plus-down-add" /> Add image
                          </span>
                        </div>
                        <div className="mb-0">
                          <div className="image-upload mb-2">
                            <input type="file" />
                            <div className="image-uploads">
                              <h4>Upload image</h4>
                            </div>
                          </div>
                          <p>JPEG, PNG up to 2 MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        First name <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control" />
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Last name <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control" />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Email <span className="text-danger">*</span>
                      </label>
                      <input type="email" className="form-control" />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Phone <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control" />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Location <span className="text-danger">*</span>
                      </label>
                      <input type="text" className="form-control" placeholder="Enter location" />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-0">
                      <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                        <span className="status-label">Status</span>
                        <input
                          type="checkbox"
                          id="supplier-add-status"
                          className="check"
                          defaultChecked
                        />
                        <label htmlFor="supplier-add-status" className="checktoggle mb-0" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                  data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fs-13 fw-medium p-2 px-3">
                  Add supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal fade" id="edit-supplier">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="content">
              <div className="modal-header">
                <div className="page-title">
                  <h4>Edit supplier</h4>
                </div>
                <button type="button" className="close" data-bs-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <form action="#" onSubmit={(e) => e.preventDefault()}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-lg-12">
                      <div className="new-employee-field">
                        <div className="profile-pic-upload edit-pic">
                          <div className="profile-pic">
                            <span>
                              <img src={editSupplier} alt="" />
                            </span>
                            <div className="close-img">
                              <i className="feather icon-x info-img" />
                            </div>
                          </div>
                          <div className="mb-0">
                            <div className="image-upload mb-0">
                              <input type="file" />
                              <div className="image-uploads">
                                <h4>Change image</h4>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="mb-3">
                        <label className="form-label">
                          First name <span className="text-danger">*</span>
                        </label>
                        <input type="text" className="form-control" defaultValue="Apex" />
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="mb-3">
                        <label className="form-label">
                          Last name <span className="text-danger">*</span>
                        </label>
                        <input type="text" className="form-control" defaultValue="Computers" />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">
                          Email <span className="text-danger">*</span>
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          defaultValue="apexcomputers@example.com"
                        />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">
                          Phone <span className="text-danger">*</span>
                        </label>
                        <input type="text" className="form-control" defaultValue="+1 596-471-2634" />
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb-3">
                        <label className="form-label">
                          Location <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          defaultValue="Munich"
                          placeholder="Enter location"
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-0">
                        <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                          <span className="status-label">Status</span>
                          <input
                            type="checkbox"
                            id="supplier-edit-status"
                            className="check"
                            defaultChecked
                          />
                          <label htmlFor="supplier-edit-status" className="checktoggle mb-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn me-2 btn-secondary fs-13 fw-medium p-2 px-3 shadow-none"
                    data-bs-dismiss="modal">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fs-13 fw-medium p-2 px-3">
                    Save changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <DeleteModal />
    </>
  );
};

export default Suppliers;
