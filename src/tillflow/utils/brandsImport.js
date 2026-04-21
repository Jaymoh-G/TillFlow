import { parseSimpleNameRows, parseXlsxRows, writeTemplate } from "./mastersImport";

export async function parseBrandsImportFile(file) {
  const rowsAoA = await parseXlsxRows(file);
  return parseSimpleNameRows(rowsAoA, {
    aliases: { name: ["name", "brand"], slug: ["slug"] },
    buildRow: ({ cells, col, sheetRow }) => {
      const name = String(cells[col.get("name")] ?? "").trim();
      if (!name) return { error: "name is required." };
      const slug = col.has("slug") ? String(cells[col.get("slug")] ?? "").trim() : "";
      return { sheetRow, name, slug: slug || null, logoFile: null };
    },
    missingMessage: 'Missing required column "name".'
  });
}

export async function downloadBrandsImportTemplate() {
  await writeTemplate("brands-import-template", "Brands", ["name", "slug"], ["Acme", "acme"]);
}
