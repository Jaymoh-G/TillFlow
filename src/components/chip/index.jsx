import React from 'react';
import { Chips } from 'primereact/chips';











const CommonChipsInput = ({
  value,
  onChange,

  placeholder = 'Type and enter',

  className
}) => {
  return (
    <Chips
      className={className}
      value={value}
      onChange={(e) => onChange(e.value)}
      placeholder={placeholder} />);


};

export default CommonChipsInput;