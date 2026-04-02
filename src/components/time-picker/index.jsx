import React, { useRef } from 'react';
import { Calendar } from 'primereact/calendar';









const CommonTimePicker = ({
  selectedTime,
  onChange,
  className = 'datetimepicker',
  minTime,
  disabled = false
}) => {
  const timerRef = useRef(null);

  return (
    <>
      <Calendar
        ref={timerRef}
        className={className}
        placeholder="Select time"
        value={selectedTime}
        onChange={(e) => onChange(e.value)}
        timeOnly
        disabled={disabled}
        minDate={minTime} />
      
    </>);

};

export default CommonTimePicker;