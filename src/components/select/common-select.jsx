import React from "react";
import { Dropdown } from "primereact/dropdown";

const CommonSelect = ({
  value,
  options,
  placeholder = "Select",
  onChange,
  className = "",
  disabled = false,
  filter = true,
  optionLabel = "label",
  optionValue = "value",
  /** `"self"` keeps panel inside parent (can clip). `"body"` attaches to document.body. */
  appendTo = "self",
  /** Open overlay when the control receives focus (e.g. Tab). */
  showOnFocus = false,
  /** When `filter` is on, move focus to the filter field as soon as the overlay opens. */
  filterInputAutoFocus = false,
  ...rest
}) => {
  const appendTarget =
    appendTo === "body" && typeof document !== "undefined" ? document.body : appendTo;

  return (
    <div className="primereact-common-select">
      <Dropdown
        value={value}
        options={Array.isArray(options) ? options : []}
        optionLabel={optionLabel}
        optionValue={optionValue}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        appendTo={appendTarget}
        filter={filter}
        showOnFocus={showOnFocus}
        filterInputAutoFocus={filterInputAutoFocus}
        {...rest}
      />
    </div>
  );
};

export default CommonSelect;