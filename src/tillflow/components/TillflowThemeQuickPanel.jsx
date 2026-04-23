import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  setDataLayout,
  setDataSidebarBg
} from '../../core/redux/themeSettingSlice';
import { useTheme } from '../theme/ThemeContext';

const OFFCANVAS_ID = 'tf-theme-quick-offcanvas';

const LAYOUT_OPTIONS = [
  { value: 'twocolumn', label: '1 col' },
  { value: 'default', label: '2 col' },
  { value: 'mini', label: 'Mini' }
];

const SIDEBAR_BG_OPTIONS = [
  { value: 'sidebarbg1', img: 'src/assets/img/theme/sidebar-bg-01.svg', label: 'Pattern 1' },
  { value: 'sidebarbg2', img: 'src/assets/img/theme/sidebar-bg-02.svg', label: 'Pattern 2' },
  { value: 'sidebarbg3', img: 'src/assets/img/theme/sidebar-bg-03.svg', label: 'Pattern 3' },
  { value: 'sidebarbg4', img: 'src/assets/img/theme/sidebar-bg-04.svg', label: 'Pattern 4' },
  { value: 'sidebarbg5', img: 'src/assets/img/theme/sidebar-bg-05.svg', label: 'Pattern 5' },
  { value: 'sidebarBg6', img: 'src/assets/img/theme/sidebar-bg-06.svg', label: 'Pattern 6' }
];

const THEME_MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

export default function TillflowThemeQuickPanel() {
  const dispatch = useDispatch();
  const dataLayout = useSelector((s) => s.themeSetting.dataLayout);
  const dataSidebarBg = useSelector((s) => s.themeSetting.dataSidebarBg);
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();

  useEffect(() => {
    if (themePreference === 'system') {
      setThemePreference(resolvedTheme === 'light' ? 'light' : 'dark');
    }
  }, [themePreference, resolvedTheme, setThemePreference]);
  const isLayoutSelected = (value) =>
    value === 'mini'
      ? dataLayout === 'mini' || dataLayout === 'layout-hovered'
      : dataLayout === value;
  const handleLayoutChange = (value) => {
    dispatch(setDataLayout(value === 'mini' ? 'layout-hovered' : value));
  };

  return (
    <>
      <button
        type="button"
        className="tf-theme-quick__fab btn btn-primary rounded-circle shadow"
        data-bs-toggle="offcanvas"
        data-bs-target={`#${OFFCANVAS_ID}`}
        aria-controls={OFFCANVAS_ID}
        aria-label="Open theme and layout settings"
        title="Theme & layout">
        <i className="ti ti-settings" aria-hidden />
      </button>

      <div
        className="offcanvas offcanvas-end tf-theme-quick__offcanvas"
        tabIndex={-1}
        id={OFFCANVAS_ID}
        aria-labelledby={`${OFFCANVAS_ID}-title`}>
        <div className="offcanvas-header border-bottom">
          <h2 className="offcanvas-title tf-heading h5 mb-0" id={`${OFFCANVAS_ID}-title`}>
            Theme &amp; layout
          </h2>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>
        <div className="offcanvas-body tf-theme-quick__body">
          <fieldset className="tf-theme-quick__section mb-4">
            <legend className="form-label fw-semibold mb-2">TillFlow theme</legend>
            <div className="d-flex flex-wrap gap-2" role="group" aria-label="Theme mode">
              {THEME_MODES.map(({ value, label }) => (
                <div key={value} className="form-check form-check-inline m-0">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="tf-tqp-theme"
                    id={`tf-tqp-theme-${value}`}
                    checked={themePreference === value}
                    onChange={() => setThemePreference(value)}
                  />
                  <label className="form-check-label" htmlFor={`tf-tqp-theme-${value}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="tf-theme-quick__section mb-4">
            <legend className="form-label fw-semibold mb-2">Layout</legend>
            <div className="row g-2" role="group" aria-label="Dashboard layout">
              {LAYOUT_OPTIONS.map(({ value, label }) => (
                <div key={value} className="col-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="tf-tqp-layout"
                      id={`tf-tqp-layout-${value}`}
                      checked={isLayoutSelected(value)}
                      onChange={() => handleLayoutChange(value)}
                    />
                    <label className="form-check-label" htmlFor={`tf-tqp-layout-${value}`}>
                      {label}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="tf-theme-quick__section mb-4">
            <legend className="form-label fw-semibold mb-2">Sidebar background</legend>
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="radio"
                name="tf-tqp-sidebarbg"
                id="tf-tqp-sidebarbg-none"
                checked={!dataSidebarBg}
                onChange={() => dispatch(setDataSidebarBg(''))}
              />
              <label className="form-check-label" htmlFor="tf-tqp-sidebarbg-none">
                None (default)
              </label>
            </div>
            <div className="tf-theme-quick__sidebar-grid" role="group" aria-label="Sidebar background pattern">
              {SIDEBAR_BG_OPTIONS.map(({ value, img, label }) => (
                <div key={value} className="tf-theme-quick__sidebar-tile">
                  <label
                    className={`tf-theme-quick__sidebar-label mb-0${dataSidebarBg === value ? ' is-active' : ''}`}>
                    <input
                      className="tf-theme-quick__sidebar-input position-absolute opacity-0"
                      type="radio"
                      name="tf-tqp-sidebarbg"
                      checked={dataSidebarBg === value}
                      onChange={() => dispatch(setDataSidebarBg(value))}
                    />
                    <img src={img} alt={label} className="tf-theme-quick__sidebar-img rounded border" />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="d-grid gap-2">
            <Link
              to="/admin/settings/appearance"
              className="btn btn-outline-primary"
              data-bs-dismiss="offcanvas">
              More appearance settings…
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
