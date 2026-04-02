import CommonFooter from "../../../../components/footer/commonFooter";

const FileUpload = () => {
  const dynamicPath = "src/assets/img/icons/download.svg"; // Replace with your dynamic path or variable

  return (
    <div className="page-wrapper cardhead">
      <div className="content container-fluid">
        {/* Page Header */}
        <div className="page-header">
          <div className="row">
            <div className="col-sm-12">
              <h3 className="page-title">File Upload</h3>
              <ul className="breadcrumb">
                <li className="breadcrumb-item">
                  <a href="index.html">Dashboard</a>
                </li>
                <li className="breadcrumb-item active">File Upload</li>
              </ul>
            </div>
          </div>
        </div>
        {/* /Page Header */}
        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Dropzone File Upload</h5>
          </div>
          <div className="card-body">
            <p className="text-muted">
              DropzoneJS is an open source library that provides drag’n’drop
              file uploads with image previews.
            </p>
            <form
              action="/"
              method="post"
              className="dropzone"
              id="myAwesomeDropzone"
              data-plugin="dropzone"
              data-previews-container="#file-previews"
              data-upload-preview-template="#uploadPreviewTemplate"
            >
              <div className="fallback">
                <input name="file" type="file" multiple="" />
              </div>
              <div className="dz-message needsclick">
                <i className="ti ti-cloud-upload h1 text-muted" />
                <h3>Drop files here or click to upload.</h3>
                <span className="text-muted fs-13">
                  (This is just a demo dropzone. Selected files are{" "}
                  <strong>not</strong> actually uploaded.)
                </span>
              </div>
            </form>
            {/* Preview */}
            <div className="dropzone-previews" id="file-previews" />
          </div>{" "}
          {/* end card-body */}
        </div>{" "}
        {/* end card */}
        {/* file preview template */}
        <div className="d-none" id="uploadPreviewTemplate">
          <div className="card mt-2 mb-0 shadow-none border">
            <div className="p-2">
              <div className="row align-items-center">
                <div className="col-auto">
                  <img
                    data-dz-thumbnail=""
                    src="#"
                    className="avatar-sm rounded bg-light"
                    alt=""
                  />
                </div>
                <div className="col ps-0">
                  <a
                    href="javascript:void(0);"
                    className="text-muted fw-bold"
                    data-dz-name=""
                  />
                  <p className="mb-0" data-dz-size="" />
                </div>
                <div className="col-auto">
                  {/* Button */}
                  <a
                    href=""
                    className="btn btn-link btn-lg text-muted"
                    data-dz-remove=""
                  >
                    <i className="ti ti-x" />
                  </a>
                </div>
              </div>
            </div>
          </div>{" "}
          {/* end card */}
        </div>
      </div>
      <CommonFooter />
    </div>
  );
};

export default FileUpload;
