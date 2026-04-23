import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listLowStockRequest } from "../../../tillflow/api/lowStock";

function unitLabel(row) {
  const u = row?.unit;
  const s = u?.short_name || u?.name;
  if (s && String(s).trim()) {
    return String(s).trim();
  }
  return "Pcs";
}

/**
 * Orange low-stock alert when the API returns at least one product with qty ≤ qty_alert.
 * Hidden when there is no token or no low-stock rows.
 */
export default function DashboardLowStockBanner({
  token,
  stockAdjustmentPath = "/admin/stock-adjustment",
  lowStockListPath = "/admin/low-stock"
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await listLowStockRequest(token, { onlyOut: false });
        const raw = data?.items ?? [];
        const sorted = [...raw].sort(
          (a, b) => Number(a?.qty ?? 0) - Number(b?.qty ?? 0)
        );
        if (!cancelled) {
          setItems(sorted);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || items.length === 0) {
    return null;
  }

  const first = items[0];
  const name = first?.name ?? "Product";
  const qty = first?.qty ?? 0;
  const alertAt = first?.qty_alert;
  const unit = unitLabel(first);
  const more = items.length - 1;

  return (
    <div className="alert bg-orange-transparent alert-dismissible fade show mb-4">
      <div>
        <span>
          <i className="ti ti-info-circle fs-14 text-orange me-2" />
          Your product{" "}
        </span>
        <span className="text-orange fw-semibold">{name}</span>
        <span> is running low — </span>
        <span className="fw-semibold">
          {qty} {unit}
        </span>
        <span> on hand</span>
        {alertAt != null && (
          <>
            <span> (reorder at </span>
            <span className="fw-semibold">{alertAt}</span>
            <span>)</span>
          </>
        )}
        <span>.</span>
        {more > 0 ? (
          <>
            {" "}
            <Link
              to={lowStockListPath}
              className="link-orange text-decoration-underline fw-semibold">
              {more} more product{more === 1 ? "" : "s"}
            </Link>
            <span>.</span>
          </>
        ) : null}{" "}
        <Link
          to={stockAdjustmentPath}
          className="link-orange text-decoration-underline fw-semibold">
          Add stock
        </Link>
      </div>
      <button
        type="button"
        className="btn-close text-gray-9 fs-14"
        data-bs-dismiss="alert"
        aria-label="Close">
        <i className="ti ti-x" />
      </button>
    </div>
  );
}
