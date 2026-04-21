import { parseSimpleNameRows, parseXlsxRows, writeTemplate } from "./mastersImport";

function parseValues(raw) {
  return String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function parseVariantAttributesImportFile(file) {
  const rowsAoA = await parseXlsxRows(file);
  return parseSimpleNameRows(rowsAoA, {
    aliases: { name: ["name", "variant"], values: ["values", "options"], is_active: ["is_active", "active", "status"] },
    requiredHeaders: ["name", "values"],
    buildRow: ({ cells, col, sheetRow }) => {
      const name = String(cells[col.get("name")] ?? "").trim();
      const values = parseValues(cells[col.get("values")]);
      if (!name) return { error: "name is required." };
      if (!values.length) return { error: "values are required (comma separated)." };
      const activeRaw = col.has("is_active") ? String(cells[col.get("is_active")] ?? "").trim().toLowerCase() : "";
      const isActive = !activeRaw || ["1", "true", "yes", "active"].includes(activeRaw);
      return { sheetRow, name, values, is_active: isActive };
    },
    missingMessage: 'Missing required columns "name" and/or "values".'
  });
}

export async function downloadVariantAttributesImportTemplate() {
  await writeTemplate("variant-attributes-import-template", "Variant Attributes", ["name", "values", "is_active"], ["Size", "S,M,L,XL", "true"]);
}
