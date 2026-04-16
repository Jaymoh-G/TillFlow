/** Shared PrimeDataTable column: decorative checkbox column (legacy report style). */
export const REPORT_TABLE_CHECKBOX_COLUMN = {
  field: '_pick',
  header: (
    <label className="checkboxs">
      <input type="checkbox" readOnly checked={false} aria-hidden />
      <span className="checkmarks" />
    </label>
  ),
  sortable: false,
  body: () => (
    <label className="checkboxs">
      <input type="checkbox" readOnly checked={false} aria-hidden />
      <span className="checkmarks" />
    </label>
  )
};
