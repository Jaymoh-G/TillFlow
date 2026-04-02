import React from "react";
import { Calendar } from "primereact/calendar";






















const CommonDatePicker = ({
  value,
  onChange,
  placeholder = "Select Date",
  dateFormat = "dd/mm/yy",
  className = "",
  disabled = false,
  maxDate,
  minDate,
  appendTo = ""
}) => {
  return (
    <Calendar
      value={value}
      onChange={(e) => onChange(e.value)}
      placeholder={placeholder}
      dateFormat={dateFormat}
      className={className}
      disabled={disabled}
      maxDate={maxDate}
      minDate={minDate}
      appendTo={appendTo} />);


};

const CommonMonthPicker = ({
  value,
  onChange,
  placeholder = "Select Month",
  className = "",
  disabled = false
}) => {
  return (
    <Calendar
      value={value}
      onChange={(e) => onChange(e.value)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      dateFormat="mm/yy"
      view="month"
      yearNavigator
      yearRange="2020:2030" />);


};

export default CommonDatePicker;
export { CommonMonthPicker };