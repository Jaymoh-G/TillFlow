import React from "react";
import { Dropdown } from "primereact/dropdown";

const CommonSelect = ({
  value,
  options,
  placeholder = "Select",
  onChange,
  className = "",
  disabled = false,
  filter = true
}) => {
  return (
    <div className="primereact-common-select">
    <Dropdown
      value={value}
      options={Array.isArray(options) ? options : []}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      appendTo={"self"}
      filter={filter} />
      </div>
      );


};

export default CommonSelect;