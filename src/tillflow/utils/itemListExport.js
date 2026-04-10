function formatExportDate(iso) {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function formatSelling(val) {
  if (val == null || val === "") {
    return "";
  }
  const n = Number(val);
  if (Number.isNaN(n)) {
    return String(val);
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * @param {Array<Record<string, unknown>>} products API product objects from list
 * @param {boolean} viewTrash
 */
function buildItemExportRows(products, viewTrash) {
  return (products ?? []).map((p) => ({
    SKU: String(p.sku ?? ""),
    Item: String(p.name ?? ""),
    Category: String(p.category?.name ?? ""),
    Brand: String(p.brand?.name ?? ""),
    Selling: formatSelling(p.selling_price),
    Unit: String(p.unit?.short_name ?? p.unit?.name ?? ""),
    Qty: p.qty != null && p.qty !== "" ? String(p.qty) : "",
    [viewTrash ? "Deleted" : "Created"]: formatExportDate(viewTrash ? p.deleted_at : p.created_at)
  }));
}

/**
 * @param {Array<Record<string, unknown>>} products
 * @param {boolean} viewTrash
 */
export async function downloadItemsExcel(products, viewTrash) {
  if (!products?.length) {
    return;
  }
  const XLSX = await import("xlsx");
  const data = buildItemExportRows(products, viewTrash);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  const sheetName = viewTrash ? "Items trash" : "Items";
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const slug = viewTrash ? "items-trash" : "items";
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${slug}-${date}.xlsx`);
}

/**
 * @param {Array<Record<string, unknown>>} products
 * @param {boolean} viewTrash
 */
export async function downloadItemsPdf(products, viewTrash) {
  if (!products?.length) {
    return;
  }
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const title = viewTrash ? "Items (trash)" : "Items";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  const dateHead = viewTrash ? "Deleted" : "Created";
  const head = [["SKU", "Item", "Category", "Brand", "Selling", "Unit", "Qty", dateHead]];

  const body = (products ?? []).map((p) => [
    String(p.sku ?? ""),
    String(p.name ?? ""),
    String(p.category?.name ?? ""),
    String(p.brand?.name ?? ""),
    formatSelling(p.selling_price),
    String(p.unit?.short_name ?? p.unit?.name ?? ""),
    p.qty != null && p.qty !== "" ? String(p.qty) : "",
    formatExportDate(viewTrash ? p.deleted_at : p.created_at)
  ]);

  autoTable(doc, {
    startY: 22,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [33, 37, 41] },
    theme: "striped",
    columnStyles: {
      1: { cellWidth: 42 }
    }
  });

  const slug = viewTrash ? "items-trash" : "items";
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`${slug}-${date}.pdf`);
}
