
import { CashFlowData } from "../../../core/json/cashFlowData";
import PrimeDataTable from "../../../components/data-table";
import TableTopHead from "../../../components/table-top-head";
import SearchFromApi from "../../../components/data-table/search";
import { Link } from "react-router";
import { useState } from "react";

import CommonFooter from "../../../components/footer/commonFooter";

const Cashflow = () => {
  const dataSource = CashFlowData;
  const columns = [
  {
    header: "Date",
    field: "Date"
  },
  {
    header: "Bank & Account Number",
    field: "Bank_Account"
  },
  {
    header: "Credit",
    field: "Credit"
  },
  {
    header: "Description",
    field: "Description"
  },
  {
    header: "Credit",
    field: "Credit"
  },
  {
    header: "Debit",
    field: "Debit"
  },
  {
    header: "Account balance",
    field: "Account_balance"
  },
  {
    header: "Total Balance ",
    field: "Total_Balance"
  },
  {
    header: "Payment Method",
    field: "Payment_Method"
  }];

  const [rows, setRows] = useState(10);
  const [_searchQuery, setSearchQuery] = useState(undefined);


  const handleSearch = (value) => {
    setSearchQuery(value);
  };
  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header">
          <div className="add-item d-flex">
            <div className="page-title">
              <h4 className="fw-bold">Cash Flow</h4>
              <h6>View Your Cashflows </h6>
            </div>
          </div>
         <TableTopHead />
        </div>
        {/* /product list */}
        <div className="card table-list-card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
            <SearchFromApi
              callback={handleSearch}
              rows={rows}
              setRows={setRows} />
            
            <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
              <div className="dropdown">
                <Link
                  to="#"
                  className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                  data-bs-toggle="dropdown">
                  
                  Payment Method
                </Link>
                <ul className="dropdown-menu  dropdown-menu-end p-3">
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      Stripe
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      Cash
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      Paypal
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <PrimeDataTable
                column={columns}
                data={dataSource}
                totalRecords={10}
                rows={10}
                setRows={() => {}}
                currentPage={1}
                setCurrentPage={() => {}} />
              {" "}
            </div>
          </div>
        </div>
        {/* /product list */}
      </div>
      <CommonFooter />
    </div>);

};

export default Cashflow;