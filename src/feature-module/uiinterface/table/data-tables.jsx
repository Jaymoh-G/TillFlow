import { useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../../routes/all_routes";
import { pageDataTablesData } from "../../../core/json/pageDataTables";
import PrimeDataTable from "../../../components/data-table";


const DataTables = () => {
  const data = pageDataTablesData;
  const route = all_routes;
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(data.length);
  const [searchText, setSearchText] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  
  const handleSearch = (e) => {
    setSearchText(e.target.value);
  };

  const filteredData = data.filter((entry) => {
    return Object.keys(entry).some((key) => {
      return String(entry[key]).
      toLowerCase().
      includes(searchText.toLowerCase());
    });
  });

  const columns = [
  {
    header: "Name",
    field: "name",
    key: "name",
    sortable: true
  },
  {
    header: "Position",
    field: "position",
    key: "position",
    sortable: true
  },
  {
    header: "Office",
    field: "office",
    key: "office",
    sortable: true
  },
  {
    header: "Age",
    field: "age",
    key: "age",
    sortable: true
  },
  {
    header: "Start Date",
    field: "startDate",
    key: "startDate",
    sortable: true
  },
  {
    header: "Salary",
    field: "salary",
    key: "salary",
    sortable: true
  }];
  return (
    <div>
      <div className="page-wrapper">
        <div className="content container-fluid">
          {/* Page Header */}
          <div className="page-header">
            <div className="row">
              <div className="col">
                <h3 className="page-title">Data Tables</h3>
                <ul className="breadcrumb">
                  <li className="breadcrumb-item">
                    <Link to={route.dashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item active">Data Tables</li>
                </ul>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          <div className="row">
            <div className="col-sm-12">
              <div className="card">
                <div className="card-header">
                  <h4 className="card-title">Default Datatable</h4>
                  <p className="card-text">
                    This is the most basic example of the datatables with zero
                    configuration. Use the <code>.datatable</code> class to
                    initialize datatables.
                  </p>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <div
                      id="DataTables_Table_0_filter"
                      className="dataTables_filter custom-data-table-react">
                      
                      <label>
                        {" "}
                        <input
                          type="search"
                          className="form-control form-control-sm"
                          placeholder="Search"
                          aria-controls="DataTables_Table_0"
                          value={searchText}
                          onChange={handleSearch} />
                        
                      </label>
                    </div>
                    <PrimeDataTable
                      column={columns}
                      data={filteredData}
                      totalRecords={totalRecords}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      rows={rows}
                      setRows={setRows}
                      selectionMode="checkbox"
                      selection={selectedRows}
                      onSelectionChange={(e) => setSelectedRows(e.value)}
                      dataKey="id"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

export default DataTables;