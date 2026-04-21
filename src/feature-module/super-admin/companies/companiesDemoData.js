import { companies_details } from '../../../core/json/companiesdetails';

/** Demo rows with stable `id` for PrimeDataTable `dataKey`. */
export function getCompaniesDemoRows() {
  return companies_details.map((r) => ({
    ...r,
    id: r.key ?? r.id
  }));
}
