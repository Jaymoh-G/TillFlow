import { useState } from "react";
import CommonFooter from "../../components/footer/commonFooter";
import RefreshIcon from "../../components/tooltip-content/refresh";
import CollapesIcon from "../../components/tooltip-content/collapes";
import { Link } from "react-router-dom";
import CounterTwo from "../../components/counter/counterTwo";
import { cheque, deposit, points, card, cashIcon } from "../../utils/imagepath";
import CommonSelect from "../../components/select/common-select";

const Checkout = () => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedTax, setSelectedTax] = useState(null);
  const [selectedDiscountType, setSelectedDiscountType] = useState(null);
  const [selectedSaleUnit, setSelectedSaleUnit] = useState(null);
  const Country = [
    { label: "USA", value: "1" },
    { label: "India", value: "2" },
    { label: "French", value: "3" },
    { label: "Australia", value: "4" },
  ];

  const State = [
    { label: "Alaska", value: "1" },
    { label: "Mexico", value: "2" },
    { label: "Tasmania", value: "3" },
  ];

  const City = [
    { label: "Anchorage", value: "1" },
    { label: "Tijuana", value: "2" },
    { label: "Hobart", value: "3" },
  ];

  const TaxType = [
    { value: "Exclusive", label: "Exclusive" },
    { value: "Inclusive", label: "Inclusive" },
  ];
  const DiscountType = [
    { value: "Exclusive", label: "Exclusive" },
    { value: "Early payment discounts", label: "Early payment discounts" },
  ];
  const SaleUnit = [
    { value: "Kilogram", label: "Kilogram" },
    { value: "Grams", label: "Grams" },
  ];
  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4 className="fw-bold">Checkout</h4>
                <h6>Manage your checkout</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>
          <div className="row mb-3">
            <div className="col-md-7">
              <div className="card">
                <div className="card-head border-bottom p-3">
                  <h3>Billing Address</h3>
                </div>
                <div className="card-body">
                  <form action="checkout.html">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            First Name{" "}
                            <span className="ms-1 text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            required
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            Second Name{" "}
                            <span className="ms-1 text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Email <span className="ms-1 text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control mb-3"
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        Address <span className="ms-1 text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control mb-3"
                        required
                      />
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            City<span className="ms-1 text-danger">*</span>
                          </label>
                          <CommonSelect
                            options={City}
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.value)}
                            placeholder="Choose"
                            filter={false}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            State<span className="ms-1 text-danger">*</span>
                          </label>
                          <CommonSelect
                            options={State}
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.value)}
                            placeholder="Choose"
                            filter={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            Country<span className="ms-1 text-danger">*</span>
                          </label>
                          <CommonSelect
                            options={Country}
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.value)}
                            placeholder="Choose"
                            filter={false}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">
                            Postal Code
                            <span className="ms-1 text-danger">*</span>
                          </label>
                          <input type="number" className="form-control" />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-md-5">
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h4 className="fs-16 fw-bold">Order Details</h4>
                  <div className="d-flex align-items-center bg-white p-1 rounded">
                    <p className="mb-0 fs-12 text-gray-9 fw-semibold me-1">
                      Items:
                    </p>
                    <span className="text-success fw-semibold fs-12">4</span>
                  </div>
                </div>
                <table className="checkout table p-2">
                  <thead>
                    <tr>
                      <th className="bg-white fw-bold">Product</th>
                      <th className="bg-white fw-bold">QTY</th>
                      <th className="bg-white fw-bold">Price</th>
                      <th className="no-sort bg-white" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="checkout-edit d-flex align-items-center">
                          <p className="mb-0 fs-16 text-gray-9 fw-medium me-2">
                            Iphone 11S
                          </p>
                          <Link
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#edit-product"
                          >
                            <i className="feather icon-edit" />
                          </Link>
                        </div>
                        <p className="mb-0">Price : $400</p>
                      </td>
                      <td>
                        <div className="checkout product-quantity border-0 bg-secondary-transparent">
                          <CounterTwo />
                        </div>
                      </td>
                      <td className="fw-bold">$400</td>
                      <td>
                        <div className="checkout-delete edit-delete-action d-flex align-items-center">
                          <Link
                            className="p-2"
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#delete"
                          >
                            <i className="feather icon-trash-2" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="checkout-edit d-flex align-items-center">
                          <p className="mb-0 fs-16 text-gray-9 fw-medium me-2">
                            Samsung Galaxy S21
                          </p>
                          <Link
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#edit-product"
                          >
                            <i className="feather icon-edit" />
                          </Link>
                        </div>
                        <p className="mb-0">Price : $400</p>
                      </td>
                      <td>
                        <div className="checkout product-quantity border-0 bg-secondary-transparent">
                          <CounterTwo />
                        </div>
                      </td>
                      <td className="fw-bold">$400</td>
                      <td>
                        <div className="checkout-delete edit-delete-action d-flex align-items-center">
                          <Link
                            className="p-2"
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#delete"
                          >
                            <i className="feather icon-trash-2" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="checkout-edit d-flex align-items-center">
                          <p className="mb-0 fs-16 text-gray-9 fw-medium me-2">
                            Red Boot Shoes
                          </p>
                          <Link
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#edit-product"
                          >
                            <i className="feather icon-edit" />
                          </Link>
                        </div>
                        <p className="mb-0">Price : $200</p>
                      </td>
                      <td>
                        <div className="checkout product-quantity border-0 bg-secondary-transparent">
                          <CounterTwo />
                        </div>
                      </td>
                      <td className="fw-bold">$600</td>
                      <td>
                        <div className="checkout-delete edit-delete-action d-flex align-items-center">
                          <Link
                            className="p-2"
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#delete"
                          >
                            <i className="feather icon-trash-2" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className="checkout-edit d-flex align-items-center">
                          <p className="mb-0 fs-16 text-gray-9 fw-medium me-2">
                            Iphone 11S
                          </p>
                          <Link
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#edit-product"
                          >
                            <i className="feather icon-edit" />
                          </Link>
                        </div>
                        <p className="mb-0">Price : $400</p>
                      </td>
                      <td>
                        <div className="checkout product-quantity border-0 bg-secondary-transparent">
                          <CounterTwo />
                        </div>
                      </td>
                      <td className="fw-bold">$400</td>
                      <td>
                        <div className="checkout-delete edit-delete-action d-flex align-items-center">
                          <Link
                            className="p-2"
                            to="#"
                            data-bs-toggle="modal"
                            data-bs-target="#delete"
                          >
                            <i className="feather icon-trash-2" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mb-3 p-3 bg-white">
                <div className="card mb-0">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="mb-0 fs-16">Sub Total</p>
                      <p className="fs-16">$1250</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="mb-0 fs-16">Shipping</p>
                      <p className="fs-16">$35</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="mb-0 fs-16">Tax (15%)</p>
                      <p className="fs-16">$25</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <p className="mb-0 fs-16">Discount (5%)</p>
                      <p className="fs-16 fw-medium text-danger">-$24</p>
                    </div>
                  </div>
                  <div className="card-footer bg-secondary-transparent">
                    <div className="d-flex align-items-center justify-content-between">
                      <p className="mb-0 fs-16 text-gray-9 fw-bold">
                        Grand Total
                      </p>
                      <p className="fs-16 text-gray-9 fw-bold">$56590</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="block-section payment-method p-3 bg-white">
                <h5 className="mb-2">Select Payment</h5>
                <div className="row align-items-center justify-content-center methods g-2 mb-4">
                  <div className="col-sm-6 col-md-4 col-xl d-flex">
                    <Link to="#" className="checkout payment-item flex-fill">
                      <img src={cashIcon} alt="img" />
                      <p className="fw-medium">Cash</p>
                    </Link>
                  </div>
                  <div className="col-sm-6 col-md-4 col-xl d-flex">
                    <Link to="#" className="checkout payment-item flex-fill">
                      <img src={card} alt="img" />
                      <p className="fw-medium">Card</p>
                    </Link>
                  </div>
                  <div className="col-sm-6 col-md-4 col-xl d-flex">
                    <Link to="#" className="checkout payment-item flex-fill">
                      <img src={points} alt="img" />
                      <p className="fw-medium">Points</p>
                    </Link>
                  </div>
                  <div className="col-sm-6 col-md-4 col-xl d-flex">
                    <Link to="#" className="checkout payment-item flex-fill">
                      <img src={deposit} alt="img" />
                      <p className="fw-medium">Deposit</p>
                    </Link>
                  </div>
                  <div className="col-sm-6 col-md-4 col-xl d-flex">
                    <Link to="#" className="checkout payment-item flex-fill">
                      <img src={cheque} alt="img" />
                      <p className="fw-medium">Cheque</p>
                    </Link>
                  </div>
                </div>
                <div className="d-grid btn-block m-0">
                  <Link className="btn btn-teal" to="#">
                    Pay : $56590.00
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {/* Edit Product */}
      <div
        className="modal fade modal-default pos-modal"
        id="edit-product"
        aria-labelledby="edit-product"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit Product</h5>
              <button
                type="button"
                className="close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form action="pos.html">
              <div className="modal-body pb-1">
                <div className="row">
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Product Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue="Red Nike Laser Show"
                        disabled=""
                      />
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Product Price <span className="text-danger">*</span>
                      </label>
                      <div className="input-icon-start position-relative">
                        <span className="input-icon-addon text-gray-9">
                          <i className="ti ti-currency-dollar" />
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          defaultValue={1800}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Tax Type <span className="text-danger">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={TaxType}
                        value={selectedTax}
                        onChange={(e) => setSelectedTax(e.value)}
                        placeholder="Choose"
                        filter={false}
                      />
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Tax <span className="text-danger">*</span>
                      </label>
                      <div className="input-icon-start position-relative">
                        <span className="input-icon-addon text-gray-9">
                          <i className="ti ti-percentage" />
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          defaultValue={15}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Discount Type <span className="text-danger">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={DiscountType}
                        value={selectedDiscountType}
                        onChange={(e) => setSelectedDiscountType(e.value)}
                        placeholder="Choose"
                        filter={false}
                      />
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Discount <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        defaultValue={15}
                      />
                    </div>
                  </div>
                  <div className="col-lg-6 col-sm-12 col-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Sale Unit <span className="text-danger">*</span>
                      </label>
                      <CommonSelect
                        className="w-100"
                        options={SaleUnit}
                        value={selectedSaleUnit}
                        onChange={(e) => setSelectedSaleUnit(e.value)}
                        placeholder="Choose"
                        filter={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-end flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-md btn-secondary"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-md btn-primary">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Product */}
      {/* Delete Product */}
      <div className="modal fade modal-default" id="delete">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body p-0">
              <div className="success-wrap text-center">
                <form action="checkout.html">
                  <div className="icon-success bg-danger-transparent text-danger mb-2">
                    <i className="ti ti-trash" />
                  </div>
                  <h3 className="mb-2">Are you Sure ?</h3>
                  <p className="fs-16 mb-3">
                    The current order will be deleted as no payment has been
                    made so far.
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
      {/* /Delete Product */}
    </div>
  );
};

export default Checkout;
