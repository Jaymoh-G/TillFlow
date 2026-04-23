import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PrimeDataTable from '../../components/data-table';
import TableTopHead from '../../components/table-top-head';
import ImportRecordsModal from '../components/ImportRecordsModal';
import { listLowStockRequest } from '../api/lowStock';
import { createProductRequest } from '../api/products';
import { TillFlowApiError } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import { downloadItemsImportTemplate, parseItemsImportFile } from '../utils/itemsImport';
import { downloadRowsExcel, downloadRowsPdf } from '../utils/listExport';

function formatListDate(iso) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminLowStock() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [tab, setTab] = useState('low'); // low | out
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setListError('');
    setLoading(true);
    try {
      const data = await listLowStockRequest(token, { onlyOut: tab === 'out' });
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      if (e instanceof TillFlowApiError) {
        setListError(e.status === 403 ? `${e.message} (needs reports.view)` : e.message);
      } else {
        setListError('Failed to load low stock report');
      }
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((r) => {
      const sku = r.sku ?? '';
      const name = r.name ?? '';
      const cat = r.category?.name ?? '';
      const brand = r.brand?.name ?? '';
      const unit = r.unit?.short_name ?? r.unit?.name ?? '';
      return (
        String(name).toLowerCase().includes(q) ||
        String(sku).toLowerCase().includes(q) ||
        String(cat).toLowerCase().includes(q) ||
        String(brand).toLowerCase().includes(q) ||
        String(unit).toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rows, tab]);

  const columns = useMemo(
    () => [
      {
        header: 'Item',
        field: 'name',
        body: (r) => (
          <div className="d-flex align-items-center">
            <div className="avatar avatar-md me-2">{initials(r.name)}</div>
            <span>{r.name}</span>
          </div>
        )
      },
      { header: 'SKU', field: 'sku', body: (r) => <span className="tf-mono">{r.sku ?? '—'}</span> },
      { header: 'Category', field: 'category.name', body: (r) => r.category?.name ?? '—' },
      { header: 'Brand', field: 'brand.name', body: (r) => r.brand?.name ?? '—' },
      { header: 'Unit', field: 'unit.name', body: (r) => r.unit?.short_name ?? r.unit?.name ?? '—' },
      { header: 'Qty', field: 'qty', className: 'text-end', headerClassName: 'text-end', body: (r) => <span className="text-end d-block">{Number.isFinite(r.qty) ? r.qty : '—'}</span> },
      { header: 'Alert', field: 'qty_alert', className: 'text-end', headerClassName: 'text-end', body: (r) => <span className="text-end d-block">{Number.isFinite(r.qty_alert) ? r.qty_alert : '—'}</span> },
      { header: 'Updated', field: 'updated_at', body: (r) => <span className="userimgname text-muted small">{formatListDate(r.updated_at)}</span> }
    ],
    []
  );

  const handleExportExcel = useCallback(async () => {
    const records = filtered.map((r) => ({
      Item: String(r.name ?? ''),
      SKU: String(r.sku ?? ''),
      Category: String(r.category?.name ?? ''),
      Brand: String(r.brand?.name ?? ''),
      Unit: String(r.unit?.short_name ?? r.unit?.name ?? ''),
      Qty: Number.isFinite(r.qty) ? r.qty : '',
      Alert: Number.isFinite(r.qty_alert) ? r.qty_alert : '',
      Updated: formatListDate(r.updated_at)
    }));
    await downloadRowsExcel(records, tab === 'out' ? 'Out of stock' : 'Low stock', tab === 'out' ? 'out-of-stock' : 'low-stock');
  }, [filtered, tab]);

  const handleExportPdf = useCallback(async () => {
    const body = filtered.map((r) => [
      String(r.name ?? ''),
      String(r.sku ?? ''),
      String(r.category?.name ?? ''),
      String(r.brand?.name ?? ''),
      String(r.unit?.short_name ?? r.unit?.name ?? ''),
      Number.isFinite(r.qty) ? String(r.qty) : '',
      Number.isFinite(r.qty_alert) ? String(r.qty_alert) : '',
      formatListDate(r.updated_at)
    ]);
    await downloadRowsPdf(
      tab === 'out' ? 'Out of stock' : 'Low stock',
      ['Item', 'SKU', 'Category', 'Brand', 'Unit', 'Qty', 'Alert', 'Updated'],
      body,
      tab === 'out' ? 'out-of-stock' : 'low-stock'
    );
  }, [filtered, tab]);

  const runImportItems = useCallback(async () => {
    if (!token || importRows.length === 0) return;
    setImporting(true);
    let created = 0;
    let failed = 0;
    const details = [];
    for (const row of importRows) {
      const { sheetRow, ...payload } = row;
      try {
        await createProductRequest(token, payload);
        created += 1;
      } catch (e) {
        failed += 1;
        details.push(`Row ${sheetRow}: ${e instanceof TillFlowApiError ? e.message : 'Could not create item.'}`);
      }
    }
    await load();
    setImportSummary({ created, skipped: 0, failed, details });
    setImporting(false);
  }, [token, importRows, load]);

  return (
    <div className="tf-item-list-page">
      <div className="page-header">
        <div className="add-item d-flex">
          <div className="page-title">
            <h4>Low Stock</h4>
            <h6>Monitor SKUs below reorder level</h6>
          </div>
        </div>
        <TableTopHead
          onRefresh={() => void load()}
          onExportPdf={loading || filtered.length === 0 ? undefined : () => void handleExportPdf()}
          onExportExcel={loading || filtered.length === 0 ? undefined : () => void handleExportExcel()}
          onImport={() => setShowImport(true)}
        />
        <div className="page-header-actions">
          <div className="page-btn import">
            <Link to="/admin/items" className="btn btn-secondary color">
              <i className="feather icon-package me-2" />
              Items
            </Link>
          </div>
        </div>
      </div>

      {listError ? <div className="tf-alert tf-alert--error mb-3">{listError}</div> : null}

      <div className="card table-list-card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
          <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1">
            <div className="search-set">
              <div className="search-input">
                <span className="btn-searchset">
                  <i className="feather icon-search" />
                </span>
                <div className="dataTables_filter">
                  <label className="mb-0">
                    <input
                      type="search"
                      className="form-control form-control-sm"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label="Search low stock"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="btn-group btn-group-sm" role="group" aria-label="Low stock tab">
              <button
                type="button"
                className={`btn ${tab === 'low' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab('low')}
              >
                Low stock
              </button>
              <button
                type="button"
                className={`btn ${tab === 'out' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab('out')}
              >
                Out of stock
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="custom-datatable-filter table-responsive">
            <PrimeDataTable
              column={columns}
              data={filtered}
              rows={rows}
              setRows={setRows}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalRecords={filtered.length}
              loading={loading}
              isPaginationEnabled
            />
          </div>
        </div>
      </div>
      <ImportRecordsModal
        show={showImport}
        title="Import items"
        helpText="Create items from spreadsheet while reviewing low-stock reports."
        previewColumns={[
          { key: 'sheetRow', label: 'Row', render: (r) => r.sheetRow },
          { key: 'name', label: 'Item', render: (r) => r.name },
          { key: 'sku', label: 'SKU', render: (r) => r.sku || '—' },
          { key: 'qty', label: 'Qty', render: (r) => r.qty ?? '—' }
        ]}
        previewRows={importRows}
        parseErrors={importErrors}
        summary={importSummary}
        importing={importing}
        onClose={() => {
          if (!importing) {
            setShowImport(false);
            setImportRows([]);
            setImportErrors([]);
            setImportSummary(null);
          }
        }}
        onDownloadTemplate={() => void downloadItemsImportTemplate()}
        onChooseFile={async (e) => {
          const file = e.target.files?.[0];
          if (e.target) e.target.value = '';
          if (!file) return;
          const parsed = await parseItemsImportFile(file);
          setImportRows(parsed.rows);
          setImportErrors(parsed.errors);
          setImportSummary(null);
        }}
        onImport={() => void runImportItems()}
      />
    </div>
  );
}
