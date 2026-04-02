import React from "react";
import { MultiSelect } from "primereact/multiselect";











const MultiSelectProps = ({
  value,
  options,
  placeholder = "Select",
  onChange

}) => {
  console.log("values", value);
  return (
    <MultiSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      maxSelectedLabels={3} />);


};
export default MultiSelectProps;