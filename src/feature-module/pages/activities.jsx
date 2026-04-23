import { Link } from "react-router-dom";

import { all_routes } from "../../routes/all_routes";
import ImageWithBasePath from "../../components/image-with-base-path";

import CommonFooter from "../../components/footer/commonFooter";

const route = all_routes;

const Activities = () => {
  return (
    <>
      <div className="page-wrapper ">
        <div className="content mb-4">
          <div className="page-header">
            <div className="page-title w-100 d-flex justify-content-between align-items-center">
              <div>
                <h4>All Notifications</h4>
                <h6>View your all activities</h6>
                <p className="text-muted small mb-0 mt-2">
                  TillFlow live feed (requires permission):{" "}
                  <Link to="/admin/notifications" className="text-primary">
                    Open notifications in TillFlow
                  </Link>
                </p>
              </div>
              <div>
                <Link to="#" className="btn btn-secondary me-1">
                  <i className="ti ti-checklist " /> Mark all as read
                </Link>
                <Link to="#" className="btn btn-danger me-1">
                  <i className="ti ti-trash" /> Delete All
                </Link>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <Link
                      to="profile.html"
                      className="avatar avatar-lg avatar-rounded"
                    >
                      <ImageWithBasePath
                        src="assets/img/customer/profile3.jpg"
                        alt="Elwis Mathew"
                      />
                    </Link>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        Elwis Mathew
                      </Link>{" "}
                      <span>added a new product</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        Redmi Pro 7 Mobile
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />
                      Just Now
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none  notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <Link
                      to="profile.html"
                      className="avatar avatar-lg avatar-rounded"
                    >
                      <ImageWithBasePath
                        src="assets/img/customer/profile4.jpg"
                        alt="Elizabeth Olsen"
                      />
                    </Link>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        Elizabeth Olsen
                      </Link>{" "}
                      <span>added a new product category</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        Desktop Computers
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />4 min ago
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none  notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <Link
                      to="profile.html"
                      className="avatar avatar-lg avatar-rounded"
                    >
                      <ImageWithBasePath
                        src="assets/img/customer/profile5.jpg"
                        alt="William Smith"
                      />
                    </Link>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        William Smith
                      </Link>{" "}
                      <span>added a new sales list for</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        January Month
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />6 min ago
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none  notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <Link
                      to="profile.html"
                      className="avatar avatar-lg avatar-rounded"
                    >
                      <ImageWithBasePath
                        src="assets/img/customer/customer4.jpg"
                        alt="Lesley Grauer"
                      />
                    </Link>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        Lesley Grauer
                      </Link>{" "}
                      <span>has updated invoice</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        #987654
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />
                      12 min ago
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none  notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <span className="avatar avatar-lg bg-success avatar-rounded">
                      <span className="avatar-title">CE</span>
                    </span>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        Carl Evans
                      </Link>{" "}
                      <span>adjust the stock</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        Apple Series 5 Watch
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />2 days ago
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-3 border shadow-none  notification-card">
            <div className="px-3 py-3">
              <div className="d-flex align-items-center justify-content-between">
                <div
                  className="d-flex align-items-center"
                  data-toggle="tooltip"
                  data-placement="right"
                  data-title="2 hrs ago"
                  data-original-title=""
                  title=""
                >
                  <div className="d-flex me-2">
                    <Link
                      to="profile.html"
                      className="avatar avatar-lg bg-primary avatar-rounded"
                    >
                      <span className="avatar-title">MR</span>
                    </Link>
                  </div>
                  <div className="flex-fill ml-3">
                    <p className="text-sm lh-140 mb-0">
                      <Link to="profile.html" className="h6">
                        Minerva Rameriz
                      </Link>{" "}
                      <span>accepted Quotation</span>{" "}
                      <Link to="javascript:void(0);" className="h6">
                        #QUO0001
                      </Link>
                    </p>
                    <small>
                      <i className="far fa-clock me-1" />1 month ago
                    </small>
                  </div>
                </div>
                <div className="noti-btn">
                  <Link
                    to="#"
                    className="btn btn-md btn-soft-danger rounded-circle p-2 fs-14 d-inline-flex align-items-center justify-content-center"
                    data-bs-toggle="modal"
                    data-bs-target="#delte-notification"
                  >
                    <i className="ti ti-trash" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {/* Delete */}
      <div className="modal fade modal-default" id="delte-notification">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body p-0">
              <div className="success-wrap text-center">
                <form action="activities.html">
                  <div className="icon-success bg-danger-transparent text-danger mb-2">
                    <i className="ti ti-trash" />
                  </div>
                  <h3 className="mb-2">Delete Notification</h3>
                  <p className="fs-16 mb-3">
                    Are you sure you want to delete this notification?
                  </p>
                  <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-md btn-secondary"
                      data-bs-dismiss="modal"
                    >
                      No, Cancel
                    </button>
                    <button type="submit" className="btn btn-md btn-primary">
                      Yes, Delete
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Delete */}
    </>
  );
};

export default Activities;
