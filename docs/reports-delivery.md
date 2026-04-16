# Reports module — delivery surface

**Decision:** Report UIs for TillFlow live under **`/tillflow/admin/reports`** and **`/tillflow/admin/reports/:slug`**, backed by **`GET /api/v1/reports/*`** endpoints. Legacy theme routes such as `/sales-report` remain **visual references only** (not wired to this API in this iteration).

Permissions: **`reports.view`** for the hub and all new report runners; existing **low-stock** / **expired-items** remain available under **`catalog.manage` OR `reports.view`**.
