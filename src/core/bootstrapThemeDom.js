/**
 * Apply DreamsPOS theme attributes from localStorage before first paint.
 * Mirrors ThemeSettings so routes that never mount FeatureModule (e.g. /tillflow/*) still get
 * consistent html/body data-* attributes when returning to template routes.
 */
export function bootstrapThemeDomFromStorage() {
  const dataLayout = localStorage.getItem("dataLayout") || "default";
  const dataWidth = localStorage.getItem("dataWidth") || "fluid";
  const dataSidebar = localStorage.getItem("dataSidebar") || "light";
  const dataTheme = localStorage.getItem("dataTheme") || "light";
  const dataTopBar = localStorage.getItem("dataTopBar") || "white";
  const dataTopBarColor = localStorage.getItem("dataTopBarolor") || "white";
  const dataColor = localStorage.getItem("dataColor") || "primary";
  const dataSidebarBg = localStorage.getItem("dataSidebarBg") || "";
  const dataTopbarBg = localStorage.getItem("dataTopbarBg") || "";

  const el = document.documentElement;
  el.setAttribute("data-layout", dataLayout);
  el.setAttribute("data-width", dataWidth);
  el.setAttribute("data-sidebar", dataSidebar);
  el.setAttribute("data-theme", dataTheme);
  el.setAttribute("data-topbar", dataTopBar);
  el.setAttribute("data-topbarcolor", dataTopBarColor);
  el.setAttribute("data-color", dataColor);

  document.body.setAttribute("data-sidebarbg", dataSidebarBg);
  document.body.setAttribute("data-topbarbg", dataTopbarBg);

  if (
    dataLayout === "mini" ||
    dataLayout === "layout-hovered" ||
    dataWidth === "box"
  ) {
    document.body.classList.add("mini-sidebar");
  } else {
    document.body.classList.remove("mini-sidebar");
  }
}
