import React from "react";
import { debounce } from "../../utils/debounce";






const SearchFromApi = ({ callback }) => {
  const dataApi = debounce(callback, 700);
  const handleChange = (e) => {
    dataApi(e.target.value?.trim());
  };

  return (
    <>
      <div className="search-set">
        <div className="search-input">
          <span className="btn-searchset">
            <i className="ti ti-search fs-14 feather-search" />
          </span>
          <div id="DataTables_Table_0_filter" className="dataTables_filter">
            <label>
              {" "}
              <input
                type="search"
                className="form-control form-control-sm d-table-search"
                aria-controls="DataTables_Table_0"
                onChange={handleChange}
                placeholder="Search" />
              
            </label>
          </div>
        </div>
      </div>
    </>);

};

export default SearchFromApi;