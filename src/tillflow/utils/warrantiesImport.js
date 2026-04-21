import { parseSimpleNameRows, parseXlsxRows, writeTemplate } from "./mastersImport";

export async function parseWarrantiesImportFile(file) {
  const rowsAoA = await parseXlsxRows(file);
  return parseSimpleNameRows(rowsAoA, {
    aliases: {
      name: ["name", "warranty"],
      description: ["description", "details"],
      duration_value: ["duration_value", "duration"],
      duration_unit: ["duration_unit", "unit", "period"],
      is_active: ["is_active", "active", "status"]
    },
    requiredHeaders: ["name", "duration_value", "duration_unit"],
    buildRow: ({ cells, col, sheetRow }) => {
      const name = String(cells[col.get("name")] ?? "").trim();
      const durationValue = Number(String(cells[col.get("duration_value")] ?? "").replace(/[^0-9.-]/g, ""));
      const durationUnitRaw = String(cells[col.get("duration_unit")] ?? "").trim().toLowerCase();
      const durationUnit = durationUnitRaw.startsWith("year") ? "year" : "month";
      const description = col.has("description") ? String(cells[col.get("description")] ?? "").trim() : "";
      const activeRaw = col.has("is_active") ? String(cells[col.get("is_active")] ?? "").trim().toLowerCase() : "";
      const isActive = !activeRaw || ["1", "true", "yes", "active"].includes(activeRaw);
      if (!name) return { error: "name is required." };
      if (!Number.isFinite(durationValue) || durationValue < 1) return { error: "duration_value must be >= 1." };
      return {
        sheetRow,
        name,
        description: description || null,
        duration_value: durationValue,
        duration_unit: durationUnit,
        is_active: isActive
      };
    },
    missingMessage: 'Missing required columns "name", "duration_value", and/or "duration_unit".'
  });
}

export async function downloadWarrantiesImportTemplate() {
  await writeTemplate("warranties-import-template", "Warranties", ["name", "description", "duration_value", "duration_unit", "is_active"], ["Standard 1 Year", "Manufacturer warranty", "1", "year", "true"]);
}
