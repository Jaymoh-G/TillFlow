function safeText(value) {
  return String(value ?? "").trim();
}

export function buildCategoryFilterValue(category) {
  const id = safeText(category?.id);
  const name = safeText(category?.name);
  if (id) {
    return `id:${id}|${encodeURIComponent(name)}`;
  }
  if (name) {
    return `name:${encodeURIComponent(name)}`;
  }
  return "";
}

export function getProductCategoryId(product) {
  const direct = safeText(product?.category_id);
  if (direct) return direct;
  const nested = safeText(product?.category?.id);
  return nested;
}

export function getProductCategoryName(product) {
  return safeText(product?.category?.name ?? product?.category_name);
}

function decodeFilterValue(filterValue) {
  const raw = safeText(filterValue);
  if (!raw) {
    return { mode: "", id: "", name: "" };
  }
  if (raw.startsWith("id:")) {
    const payload = raw.slice(3);
    const [idPart, encodedName = ""] = payload.split("|");
    let name = "";
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      name = encodedName;
    }
    return { mode: "id", id: safeText(idPart), name: safeText(name) };
  }
  if (raw.startsWith("name:")) {
    const encoded = raw.slice(5);
    let name = "";
    try {
      name = decodeURIComponent(encoded);
    } catch {
      name = encoded;
    }
    return { mode: "name", id: "", name: safeText(name) };
  }
  return { mode: "name", id: "", name: raw };
}

export function matchesProductCategoryFilter(product, filterValue) {
  const parsed = decodeFilterValue(filterValue);
  if (!parsed.mode) return true;

  const productCategoryId = getProductCategoryId(product);
  const productCategoryName = getProductCategoryName(product);

  if (parsed.mode === "id") {
    if (parsed.id && productCategoryId && parsed.id === productCategoryId) {
      return true;
    }
    // Fallback for payloads where product category id may be absent.
    return parsed.name ? productCategoryName === parsed.name : false;
  }

  return parsed.name ? productCategoryName === parsed.name : false;
}

export function filterCatalogProducts(products, { query, categoryFilterValue, limit = 80 }) {
  const rawQuery = safeText(query).toLowerCase();
  const byCategory = categoryFilterValue
    ? products.filter((p) => matchesProductCategoryFilter(p, categoryFilterValue))
    : products;

  const byQuery = rawQuery
    ? byCategory.filter((p) => {
        const name = safeText(p?.name).toLowerCase();
        const sku = safeText(p?.sku).toLowerCase();
        return name.includes(rawQuery) || sku.includes(rawQuery);
      })
    : byCategory;

  return byQuery.slice(0, Math.max(0, Number(limit) || 0));
}
