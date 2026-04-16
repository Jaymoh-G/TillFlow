/**
 * Group permission rows by top-level domain (first slug segment) for nested UI.
 * Each row is a module (e.g. catalog.masters) with optional view/manage permission objects.
 */

const TOP_ORDER = [
  'tenant',
  'users',
  'reports',
  'catalog',
  'inventory',
  'stores',
  'sales',
  'procurement',
  'finance',
];

function humanizeSegment(seg) {
  if (!seg) {
    return '';
  }
  return seg
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function titleizeTop(key) {
  return humanizeSegment(key);
}

/**
 * @param {Array<{ id: number, slug: string, name?: string }>} permissions
 * @returns {Array<{ id: string, title: string, rows: Array<{
 *   moduleKey: string,
 *   label: string, // submodule name, or "General" when the module is the whole top-level group
 *   view: object | null,
 *   manage: object | null,
 * }> }>}
 */
export function buildPermissionGroups(permissions) {
  const slugOrder = permissions.map((p) => p.slug);
  const indexOfSlug = (slug) => {
    const i = slugOrder.indexOf(slug);
    return i === -1 ? 9999 : i;
  };

  /** @type {Map<string, { moduleKey: string, view: object | null, manage: object | null }>} */
  const pairMap = new Map();

  for (const p of permissions) {
    const parts = p.slug.split('.');
    const last = parts[parts.length - 1];
    if (last === 'view' || last === 'manage') {
      const moduleKey = parts.slice(0, -1).join('.');
      if (!pairMap.has(moduleKey)) {
        pairMap.set(moduleKey, { moduleKey, view: null, manage: null });
      }
      const row = pairMap.get(moduleKey);
      row[last] = p;
    }
  }

  /** @type {Map<string, Array<{ moduleKey: string, label: string, view: object | null, manage: object | null }>>} */
  const tops = new Map();

  for (const row of pairMap.values()) {
    const parts = row.moduleKey.split('.');
    const topKey = parts[0];
    const subParts = parts.slice(1);
    /* When moduleKey is a single segment (e.g. tenant, users, reports), the group title is already
     * that word — do not repeat it as the row label (was: Tenant ▸ Tenant). */
    const label = subParts.length ? humanizeSegment(subParts.join('_')) : 'General';

    if (!tops.has(topKey)) {
      tops.set(topKey, []);
    }
    tops.get(topKey).push({
      moduleKey: row.moduleKey,
      label,
      view: row.view,
      manage: row.manage,
    });
  }

  for (const rows of tops.values()) {
    rows.sort((a, b) => {
      const sa = a.view?.slug || a.manage?.slug || '';
      const sb = b.view?.slug || b.manage?.slug || '';
      return indexOfSlug(sa) - indexOfSlug(sb);
    });
  }

  const topKeys = [...tops.keys()].sort((a, b) => {
    const ia = TOP_ORDER.indexOf(a);
    const ib = TOP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) {
      return a.localeCompare(b);
    }
    if (ia === -1) {
      return 1;
    }
    if (ib === -1) {
      return -1;
    }
    return ia - ib;
  });

  return topKeys.map((id) => ({
    id,
    title: titleizeTop(id),
    rows: tops.get(id) ?? [],
  }));
}
