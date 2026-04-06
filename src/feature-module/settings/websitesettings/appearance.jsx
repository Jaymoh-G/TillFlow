import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import SettingsSideBar from "../settingssidebar";
import RefreshIcon from "../../../components/tooltip-content/refresh";
import CollapesIcon from "../../../components/tooltip-content/collapes";
import CommonSelect from "../../../components/select/common-select";
import { themeImage08, themeImage09, themeImage10 } from "../../../utils/imagepath";
import {
  setDataColor,
  setDataLayout,
  setDataTheme,
  setExpandMenu
} from "../../../core/redux/themeSettingSlice";

const THEME_LS = "appearance_theme_choice";

const SWATCH_TO_COLOR = {
  defaultcolor: "primary",
  "theme-violet": "lavendar",
  "theme-blue": "brightblue",
  "theme-brown": "orange"
};

const COLOR_TO_SWATCH = Object.fromEntries(
  Object.entries(SWATCH_TO_COLOR).map(([k, v]) => [v, k])
);

const sizeOptions = [
  { value: "small", label: "Small — mini sidebar" },
  { value: "large", label: "Large — full sidebar" }
];

const Appearance = () => {
  const dispatch = useDispatch();
  const dataTheme = useSelector((s) => s.themeSetting.dataTheme);
  const dataLayout = useSelector((s) => s.themeSetting.dataLayout);
  const dataColor = useSelector((s) => s.themeSetting.dataColor);
  const expandMenus = useSelector((s) => s.themeSetting.expandMenus);

  const [themeChoice, setThemeChoice] = useState("Light");
  const [accentSwatch, setAccentSwatch] = useState("defaultcolor");
  const [expandSidebar, setExpandSidebar] = useState(true);
  const [sidebarSize, setSidebarSize] = useState("large");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_LS);
    if (stored === "auto") {
      setThemeChoice("Automatic");
    } else if (dataTheme === "dark") {
      setThemeChoice("Dark");
    } else {
      setThemeChoice("Light");
    }
    setAccentSwatch(COLOR_TO_SWATCH[dataColor] || "defaultcolor");
    setExpandSidebar(Boolean(expandMenus));
    setSidebarSize(dataLayout === "mini" ? "small" : "large");
  }, [dataTheme, dataColor, dataLayout, expandMenus]);

  const applyAutomaticTheme = useCallback(() => {
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    dispatch(setDataTheme(prefersDark ? "dark" : "light"));
  }, [dispatch]);

  const handleSave = (e) => {
    e.preventDefault();
    if (themeChoice === "Automatic") {
      localStorage.setItem(THEME_LS, "auto");
      applyAutomaticTheme();
    } else if (themeChoice === "Dark") {
      localStorage.setItem(THEME_LS, "dark");
      dispatch(setDataTheme("dark"));
    } else {
      localStorage.setItem(THEME_LS, "light");
      dispatch(setDataTheme("light"));
    }
    const nextColor = SWATCH_TO_COLOR[accentSwatch] || "primary";
    dispatch(setDataColor(nextColor));
    dispatch(setExpandMenu(expandSidebar));
    dispatch(setDataLayout(sidebarSize === "small" ? "mini" : "default"));
    setSavedMsg("Appearance updated.");
    window.setTimeout(() => setSavedMsg(""), 2200);
  };

  const handleCancel = () => {
    const stored = localStorage.getItem(THEME_LS);
    if (stored === "auto") {
      setThemeChoice("Automatic");
    } else if (dataTheme === "dark") {
      setThemeChoice("Dark");
    } else {
      setThemeChoice("Light");
    }
    setAccentSwatch(COLOR_TO_SWATCH[dataColor] || "defaultcolor");
    setExpandSidebar(Boolean(expandMenus));
    setSidebarSize(dataLayout === "mini" ? "small" : "large");
    setSavedMsg("");
  };

  const showTillflowBackLink =
    typeof window !== "undefined" && window.location.pathname.startsWith("/tillflow/admin/");

  return (
    <>
      <div className="page-wrapper settings-appearance-page">
        <div className="content settings-content">
          <div className="page-header settings-pg-header">
            <div className="add-item d-flex">
              <div className="page-title">
                <h4>Settings</h4>
                <h6>Manage your settings on portal</h6>
              </div>
            </div>
            <ul className="table-top-head">
              <RefreshIcon />
              <CollapesIcon />
            </ul>
          </div>
          <div className="row">
            <div className="col-xl-12">
              <div className="settings-wrapper d-flex">
                <SettingsSideBar />
                <div className="card flex-fill mb-0">
                  <div className="card-header d-flex flex-wrap align-items-center gap-2 justify-content-between">
                    <h4 className="fs-18 fw-bold mb-0">Appearance</h4>
                    {showTillflowBackLink ? (
                      <Link to="/tillflow/admin" className="btn btn-outline-secondary btn-sm">
                        Back to admin
                      </Link>
                    ) : null}
                  </div>
                  <div className="card-body">
                    <p className="fs-14 text-muted mb-3">
                      These options drive the main DreamsPOS layout (theme, accent, sidebar). They are stored in the
                      browser like the theme customizer.
                    </p>
                    {savedMsg ? (
                      <div className="alert alert-success py-2 mb-3" role="status">
                        {savedMsg}
                      </div>
                    ) : null}
                    <form onSubmit={handleSave}>
                      <div className="appearance-settings">
                        <div className="row">
                          <div className="col-xl-4 col-lg-12 col-md-4">
                            <div className="setting-info mb-4">
                              <h6>Select theme</h6>
                              <p>Light, dark, or match the operating system once when you save.</p>
                            </div>
                          </div>
                          <div className="col-xl-8 col-lg-12 col-md-8">
                            <div className="theme-type-images d-flex align-items-center flex-wrap gap-3 mb-4">
                              <div
                                role="button"
                                tabIndex={0}
                                className={`theme-image border ${themeChoice === "Light" ? "active" : ""}`}
                                onClick={() => setThemeChoice("Light")}
                                onKeyDown={(ev) => {
                                  if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    setThemeChoice("Light");
                                  }
                                }}>
                                <div className="theme-image-set">
                                  <img src={themeImage08} alt="" />
                                </div>
                                <h6>Light</h6>
                              </div>
                              <div
                                role="button"
                                tabIndex={0}
                                className={`theme-image border ${themeChoice === "Dark" ? "active" : ""}`}
                                onClick={() => setThemeChoice("Dark")}
                                onKeyDown={(ev) => {
                                  if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    setThemeChoice("Dark");
                                  }
                                }}>
                                <div className="theme-image-set">
                                  <img src={themeImage09} alt="" />
                                </div>
                                <h6>Dark</h6>
                              </div>
                              <div
                                role="button"
                                tabIndex={0}
                                className={`theme-image border ${themeChoice === "Automatic" ? "active" : ""}`}
                                onClick={() => setThemeChoice("Automatic")}
                                onKeyDown={(ev) => {
                                  if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    setThemeChoice("Automatic");
                                  }
                                }}>
                                <div className="theme-image-set">
                                  <img src={themeImage10} alt="" />
                                </div>
                                <h6>Automatic</h6>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="row">
                          <div className="col-xl-4 col-lg-12 col-md-4">
                            <div className="setting-info mb-4">
                              <h6 className="mb-1">Accent color</h6>
                              <p>Primary palette for buttons and highlights.</p>
                            </div>
                          </div>
                          <div className="col-xl-8 col-lg-12 col-md-8">
                            <div className="theme-colors mb-4">
                              <ul className="d-flex flex-wrap gap-2 list-unstyled mb-0">
                                {[
                                  { id: "defaultcolor", className: "themecolorset defaultcolor" },
                                  { id: "theme-violet", className: "themecolorset theme-violet" },
                                  { id: "theme-blue", className: "themecolorset theme-blue" },
                                  { id: "theme-brown", className: "themecolorset theme-brown" }
                                ].map((c) => (
                                  <li key={c.id}>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      className={`${c.className} ${accentSwatch === c.id ? "active" : ""}`}
                                      onClick={() => setAccentSwatch(c.id)}
                                      onKeyDown={(ev) => {
                                        if (ev.key === "Enter" || ev.key === " ") {
                                          ev.preventDefault();
                                          setAccentSwatch(c.id);
                                        }
                                      }}
                                    />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="row align-items-center">
                          <div className="col-xl-4 col-lg-12 col-md-4">
                            <div className="setting-info mb-4 mb-md-0">
                              <h6>Expand sidebar</h6>
                              <p>Leave on to show submenu labels more often in mini mode.</p>
                            </div>
                          </div>
                          <div className="col-xl-8 col-lg-12 col-md-8">
                            <div className="status-toggle modal-status d-flex justify-content-between align-items-center">
                              <input
                                type="checkbox"
                                id="appearance-expand-sidebar"
                                className="check"
                                checked={expandSidebar}
                                onChange={(e) => setExpandSidebar(e.target.checked)}
                              />
                              <label htmlFor="appearance-expand-sidebar" className="checktoggle">
                                {" "}
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="row mt-3">
                          <div className="col-xl-4 col-lg-12 col-md-4">
                            <div className="setting-info mb-4 mb-md-0">
                              <h6 className="mb-1">Sidebar size</h6>
                              <p>Mini uses a narrow icon rail; full restores the wide menu.</p>
                            </div>
                          </div>
                          <div className="col-xl-4 col-lg-12 col-md-4">
                            <div className="localization-select mb-4">
                              <CommonSelect
                                filter={false}
                                options={sizeOptions}
                                value={sidebarSize}
                                onChange={(e) => setSidebarSize(e.value)}
                                placeholder="Choose"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-end settings-bottom-btn mt-2">
                        <button type="button" className="btn btn-secondary me-2" onClick={handleCancel}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Save changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Appearance;
