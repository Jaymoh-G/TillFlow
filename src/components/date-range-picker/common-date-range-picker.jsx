import React, { useRef, useState } from 'react';
import { DatePicker, Dropdown, Menu, Input } from 'antd';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);
dayjs.extend(localeData);

const { RangePicker } = DatePicker;
const dateFormat = 'YYYY/MM/DD';

const defaultUncontrolledRange = () => [dayjs().subtract(6, 'day'), dayjs()];

/**
 * @param {{
 *   value?: [import('dayjs').Dayjs, import('dayjs').Dayjs],
 *   onChange?: (range: [import('dayjs').Dayjs, import('dayjs').Dayjs]) => void,
 *   showAllDatesOption?: boolean,
 *   allDatesActive?: boolean,
 *   onAllDatesSelect?: () => void
 * }} [props]
 */
const CommonDateRangePicker = ({
  value,
  onChange,
  showAllDatesOption,
  allDatesActive,
  onAllDatesSelect
}) => {
  const [internalDates, setInternalDates] = useState(defaultUncontrolledRange);
  const [customVisible, setCustomVisible] = useState(false);
  const rangeRef = useRef(null);

  const isControlled = value !== undefined && value !== null;
  const dates = isControlled ? value : internalDates;

  const predefinedRanges = {
    Today: [dayjs(), dayjs()],
    Yesterday: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')],
    'Last 7 Days': [dayjs().subtract(6, 'day'), dayjs()],
    'Last 30 Days': [dayjs().subtract(29, 'day'), dayjs()],
    'This Month': [dayjs().startOf('month'), dayjs().endOf('month')],
    'Last Month': [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month')
    ]
  };

  const applyDates = (next) => {
    if (!isControlled) {
      setInternalDates(next);
    }
    onChange?.(next);
  };

  const handleMenuClick = ({ key }) => {
    if (key === 'All') {
      onAllDatesSelect?.();
      setCustomVisible(false);

      return;
    }
    if (key === 'Custom Range') {
      setCustomVisible(true);
      setTimeout(() => rangeRef.current?.focus(), 0);
    } else {
      applyDates(predefinedRanges[key]);
      setCustomVisible(false);
    }
  };

  const handleCustomChange = (nextRange) => {
    if (nextRange) {
      applyDates(nextRange);
      setCustomVisible(false);
    }
  };

  const menuItems = [];
  if (showAllDatesOption && onAllDatesSelect) {
    menuItems.push({ key: 'All', label: 'All' });
    menuItems.push({ type: 'divider' });
  }
  menuItems.push(
    ...Object.keys(predefinedRanges).map((label) => ({
      key: label,
      label
    }))
  );
  menuItems.push({ type: 'divider' });
  menuItems.push({ key: 'Custom Range', label: 'Custom Range' });

  const menu = <Menu onClick={handleMenuClick} items={menuItems} />;

  const displayValue = allDatesActive
    ? 'All dates'
    : `${dates[0].format(dateFormat)} - ${dates[1].format(dateFormat)}`;

  return (
    <div>
      <Dropdown overlay={menu} trigger={['click']}>
        <Input readOnly value={displayValue} className="" />
      </Dropdown>

      {customVisible && (
        <RangePicker
          open
          ref={rangeRef}
          onChange={handleCustomChange}
          format={dateFormat}
          value={dates}
          allowClear={false}
          style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
          onOpenChange={(open) => {
            if (!open) {
              setCustomVisible(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default CommonDateRangePicker;
