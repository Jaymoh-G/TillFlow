import React, { useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../../core/modals/inventory/brand";
import { all_routes } from "../../routes/all_routes";
import PrimeDataTable from "../../components/data-table";
import {

  expireProduct01,
  expireProduct02,
  expireProduct03,
  expireProduct04,

  stockImg02,
  stockImg03,
  stockImg04,
  stockImg05,
  stockImg06,
  user04,
  user08,

  user10,
  user13,

  user30,
  stockImg1,
  user11,
  user3,
  user2,
  user5,
  user01 } from
"../../utils/imagepath";
import TableTopHead from "../../components/table-top-head";
import DeleteModal from "../../components/delete-modal";
import SearchFromApi from "../../components/data-table/search";

export const productlistdata = [
{
  id: 1,
  product: "Lenovo 3rd Generatio",
  productImage: stockImg1,
  sku: "PT001",
  category: "Laptop",
  brand: "Lenovo",
  price: "$12500.00",
  unit: "Pc",
  qty: "100",
  createdby: "Arroon",
  img: user30
},
{
  id: 2,
  product: "Bold V3.2",
  productImage: stockImg06,
  sku: "PT002",
  category: "Electronics",
  brand: "Bolt",
  price: "$1600.00",
  unit: "Pc",
  qty: "140",
  createdby: "Kenneth",
  img: user13
},
{
  id: 3,
  product: "Nike Jordan",
  productImage: stockImg02,
  sku: "PT003",
  category: "Shoe",
  brand: "Nike",
  price: "$6000.00",
  unit: "Pc",
  qty: "780",
  createdby: "Gooch",
  img: user11
},
{
  id: 4,
  product: "Apple Series 5 Watch",
  productImage: stockImg03,
  sku: "PT004",
  category: "Electronics",
  brand: "Apple",
  price: "$25000.00",
  unit: "Pc",
  qty: "450",
  createdby: "Nathan",
  img: user3
},
{
  id: 5,
  product: "Amazon Echo Dot",
  productImage: stockImg04,
  sku: "PT005",
  category: "Speaker",
  brand: "Amazon",
  price: "$1600.00",
  unit: "Pc",
  qty: "477",
  createdby: "Alice",
  img: user2
},
{
  id: 6,
  product: "Lobar Handy",
  productImage: stockImg05,
  sku: "PT006",
  category: "Furnitures",
  brand: "Woodmart",
  price: "$4521.00",
  unit: "Kg",
  qty: "145",
  createdby: "Robb",
  img: user5
},
{
  id: 7,
  product: "Red Premium Handy",
  productImage: expireProduct01,
  sku: "PT007",
  category: "Bags",
  brand: "Versace",
  price: "$2024.00",
  unit: "Kg",
  qty: "747",
  createdby: "Steven",
  img: user08
},
{
  id: 8,
  product: "Iphone 14 Pro",
  productImage: expireProduct02,
  sku: "PT008",
  category: "Phone",
  brand: "Iphone",
  price: "$1698.00",
  unit: "Pc",
  qty: "897",
  createdby: "Gravely",
  img: user04
},
{
  id: 9,
  product: "Black Slim 200",
  productImage: expireProduct03,
  sku: "PT009",
  category: "Chairs",
  brand: "Bently",
  price: "$6794.00",
  unit: "Pc",
  qty: "741",
  createdby: "Kevin",
  img: user01
},
{
  id: 10,
  product: "Woodcraft Sandal",
  productImage: expireProduct04,
  sku: "PT010",
  category: "Bags",
  brand: "Woodcraft",
  price: "$4547.00",
  unit: "Kg",
  qty: "148",
  createdby: "Grillo",
  img: user10
}];

















const ProductList = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, _setTotalRecords] = useState(5);
  const [rows, setRows] = useState(10);
  const [_searchQuery, setSearchQuery] = useState(undefined);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const handleSearch = (value) => {
    setSearchQuery(value);
  };

  const route = all_routes;
  const columns = [
  {
    header: "SKU",
    field: "sku",
    key: "sku",
    sortable: true
  },
  {
    header: "Product",
    field: "product",
    key: "product",
    sortable: true,
    body: (data) =>
    <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md me-2">
            <img alt="" src={data.productImage} />
          </Link>
          <Link to="#">{data.product}</Link>
        </div>

  },
  {
    header: "Category",
    field: "category",
    key: "category",
    sortable: true
  },
  {
    header: "Brand",
    field: "brand",
    key: "brand",
    sortable: true
  },
  {
    header: "Price",
    field: "price",
    key: "price",
    sortable: true
  },
  {
    header: "Unit",
    field: "unit",
    key: "unit",
    sortable: true
  },
  {
    header: "Qty",
    field: "qty",
    key: "qty",
    sortable: true
  },
  {
    header: "Created By",
    field: "createdby",
    key: "createdby",
    sortable: true,
    body: (data) =>
    <span className="userimgname">
          <Link to="/profile" className="product-img">
            <img alt="" src={data.img} />
          </Link>
          <Link to="/profile">{data.createdby}</Link>
        </span>

  },
  {
    header: "",
    field: "actions",
    key: "actions",
    sortable: false,
    body: (_row) =>
    <div className="edit-delete-action d-flex align-items-center">
          <Link
        className="me-2 p-2 d-flex align-items-center border rounded"
        to="#"
        data-bs-toggle="modal"
        data-bs-target="#edit-customer">
        
            <i className="feather icon-edit"></i>
          </Link>
          <Link
        className="p-2 d-flex align-items-center border rounded"
        to="#"
        data-bs-toggle="modal" data-bs-target="#delete-modal">
        
            <i className="feather icon-trash-2"></i>
          </Link>
        </div>

  }];



  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="page-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Product List</h4>
                <h6>Manage your products</h6>
              </div>
            </div>
            <TableTopHead />
            <div className="page-btn">
              <Link to={route.addproduct} className="btn btn-primary">
                <i className="ti ti-circle-plus me-1"></i>
                Add New Product
              </Link>
            </div>
            <div className="page-btn import">
              <Link
                to="#"
                className="btn btn-secondary color"
                data-bs-toggle="modal"
                data-bs-target="#view-notes">
                
                <i className="feather icon-download feather me-2" />
                Import Product
              </Link>
            </div>
          </div>
          {/* /product list */}
          <div className="card table-list-card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <SearchFromApi
                callback={handleSearch}
                rows={rows}
                setRows={setRows} />
              
              <div className="d-flex table-dropdown my-xl-auto right-content align-items-center flex-wrap row-gap-3">
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Product
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Lenovo IdeaPad 3
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Beats Pro{" "}
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Nike Jordan
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Apple Series 5 Watch
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Created By
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        James Kirwin
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Francis Chang
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Antonio Engle
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Leo Kelly
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Category
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Computers
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Electronics
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Shoe
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Electronics
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown me-2">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Brand
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Lenovo
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Beats
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Nike
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Apple
                      </Link>
                    </li>
                  </ul>
                </div>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white btn-md d-inline-flex align-items-center"
                    data-bs-toggle="dropdown">
                    
                    Sort By : Last 7 Days
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Desending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last Month
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Last 7 Days
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body">
              {/* /Filter */}
              <div className="table-responsive">
                {/* <Table columns={columns} dataSource={productlistdata} /> */}
                <PrimeDataTable
                  column={columns}
                  data={productlistdata}
                  rows={rows}
                  setRows={setRows}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalRecords={totalRecords}
                  selectionMode="checkbox"
                  selection={selectedProducts}
                  onSelectionChange={(e) => setSelectedProducts(e.value)}
                  dataKey="id" />
                
              </div>
            </div>
          </div>
          {/* /product list */}
          <Brand />
        </div>
      </div>
     <DeleteModal />
    </>);

};

export default ProductList;