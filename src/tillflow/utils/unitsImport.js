import { parseSimpleNameRows, parseXlsxRows, writeTemplate } from "./mastersImport";

export async function parseUnitsImportFile(file) {
  const rowsAoA = await parseXlsxRows(file);
  return parseSimpleNameRows(rowsAoA, {
    aliases: { name: ["name", "unit"], short_name: ["short_name", "short name", "short"] },
    requiredHeaders: ["name", "short_name"],
    buildRow: ({ cells, col, sheetRow }) => {
      const name = String(cells[col.get("name")] ?? "").trim();
      const shortName = String(cells[col.get("short_name")] ?? "").trim();
      if (!name) return { error: "name is required." };
      if (!shortName) return { error: "short_name is required." };
      return { sheetRow, name, short_name: shortName };
    },
    missingMessage: 'Missing required columns "name" and/or "short_name".'
  });
}

export async function downloadUnitsImportTemplate() {
  await writeTemplate("units-import-template", "Units", ["name", "short_name"], ["Piece", "pc"]);
}
