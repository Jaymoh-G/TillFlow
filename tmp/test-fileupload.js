// src/components/footer/commonFooter.jsx
var CommonFooter = () => {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3" }, /* @__PURE__ */ React.createElement("p", { className: "mb-0" }, "2014 - 2026 \xA9 BreezeTech. All Rights Reserved"), /* @__PURE__ */ React.createElement("p", { className: "mb-0" }, "Designed & Developed by", " ", /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "https://breezetechnologies.co.ke",
      className: "text-primary text-decoration-none",
      target: "_blank",
      rel: "noopener noreferrer"
    },
    "BreezeTech"
  ))));
};
var commonFooter_default = CommonFooter;

// src/feature-module/uiinterface/forms/formelements/fileupload.jsx
var FileUpload = () => {
  const dynamicPath = "src/assets/img/icons/download.svg";
  return /* @__PURE__ */ React.createElement("div", { className: "page-wrapper cardhead" }, /* @__PURE__ */ React.createElement("div", { className: "content container-fluid" }, /* @__PURE__ */ React.createElement("div", { className: "page-header" }, /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("div", { className: "col-sm-12" }, /* @__PURE__ */ React.createElement("h3", { className: "page-title" }, "File Upload"), /* @__PURE__ */ React.createElement("ul", { className: "breadcrumb" }, /* @__PURE__ */ React.createElement("li", { className: "breadcrumb-item" }, /* @__PURE__ */ React.createElement("a", { href: "index.html" }, "Dashboard")), /* @__PURE__ */ React.createElement("li", { className: "breadcrumb-item active" }, "File Upload"))))), /* @__PURE__ */ React.createElement("div", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "card-header" }, /* @__PURE__ */ React.createElement("h5", { className: "card-title" }, "Dropzone File Upload")), /* @__PURE__ */ React.createElement("div", { className: "card-body" }, /* @__PURE__ */ React.createElement("p", { className: "text-muted" }, "DropzoneJS is an open source library that provides drag\u2019n\u2019drop file uploads with image previews."), /* @__PURE__ */ React.createElement(
    "form",
    {
      action: "/",
      method: "post",
      className: "dropzone",
      id: "myAwesomeDropzone",
      "data-plugin": "dropzone",
      "data-previews-container": "#file-previews",
      "data-upload-preview-template": "#uploadPreviewTemplate"
    },
    /* @__PURE__ */ React.createElement("div", { className: "fallback" }, /* @__PURE__ */ React.createElement("input", { name: "file", type: "file", multiple: "" })),
    /* @__PURE__ */ React.createElement("div", { className: "dz-message needsclick" }, /* @__PURE__ */ React.createElement("i", { className: "ti ti-cloud-upload h1 text-muted" }), /* @__PURE__ */ React.createElement("h3", null, "Drop files here or click to upload."), /* @__PURE__ */ React.createElement("span", { className: "text-muted fs-13" }, "(This is just a demo dropzone. Selected files are", " ", /* @__PURE__ */ React.createElement("strong", null, "not"), " actually uploaded.)"))
  ), /* @__PURE__ */ React.createElement("div", { className: "dropzone-previews", id: "file-previews" })), " "), " ", /* @__PURE__ */ React.createElement("div", { className: "d-none", id: "uploadPreviewTemplate" }, /* @__PURE__ */ React.createElement("div", { className: "card mt-2 mb-0 shadow-none border" }, /* @__PURE__ */ React.createElement("div", { className: "p-2" }, /* @__PURE__ */ React.createElement("div", { className: "row align-items-center" }, /* @__PURE__ */ React.createElement("div", { className: "col-auto" }, /* @__PURE__ */ React.createElement(
    "img",
    {
      "data-dz-thumbnail": "",
      src: "#",
      className: "avatar-sm rounded bg-light",
      alt: ""
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "col ps-0" }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "javascript:void(0);",
      className: "text-muted fw-bold",
      "data-dz-name": ""
    }
  ), /* @__PURE__ */ React.createElement("p", { className: "mb-0", "data-dz-size": "" })), /* @__PURE__ */ React.createElement("div", { className: "col-auto" }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: "",
      className: "btn btn-link btn-lg text-muted",
      "data-dz-remove": ""
    },
    /* @__PURE__ */ React.createElement("i", { className: "ti ti-x" })
  ))))), " ")), /* @__PURE__ */ React.createElement(commonFooter_default, null));
};
var fileupload_default = FileUpload;
export {
  fileupload_default as default
};
