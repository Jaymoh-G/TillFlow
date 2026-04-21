import { parseSimpleNameRows, parseXlsxRows, writeTemplate } from "./mastersImport";

export async function parseCategoriesImportFile(file) {
  const rowsAoA = await parseXlsxRows(file);
  return parseSimpleNameRows(rowsAoA, {
    aliases: { name: ["name", "category"], slug: ["slug"] },
    buildRow: ({ cells, col, sheetRow }) => {
      const name = String(cells[col.get("name")] ?? "").trim();
      if (!name) return { error: "name is required." };
      const slug = col.has("slug") ? String(cells[col.get("slug")] ?? "").trim() : "";
      return { sheetRow, name, slug: slug || null };
    },
    missingMessage: 'Missing required column "name".'
  });
}

export async function downloadCategoriesImportTemplate() {
  await writeTemplate("categories-import-template", "Categories", ["name", "slug"], ["Electronics", "electronics"]);
}
