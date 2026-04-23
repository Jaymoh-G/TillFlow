import { NavLink } from 'react-router-dom';

export default function AdminSidebarSettingsPanel({
  canTenant,
  settingsGeneralOpen,
  setSettingsGeneralOpen,
  settingsWebsiteOpen,
  setSettingsWebsiteOpen,
  settingsAppOpen,
  setSettingsAppOpen,
  settingsSystemOpen,
  setSettingsSystemOpen,
  settingsFinancialOpen,
  setSettingsFinancialOpen,
  settingsOtherOpen,
  setSettingsOtherOpen
}) {
  return (
    <>
      <div className="tf-sidebar-panel__title">Settings</div>
      <div className="tf-nav-settings-nested tf-nav-settings-nested--rail">
        <div className="tf-nav-group tf-nav-group--settings">
          <button
            type="button"
            className="tf-nav-group__hdr"
            onClick={() => setSettingsGeneralOpen((v) => !v)}
            aria-expanded={settingsGeneralOpen}>
            General settings
            <i className={`feather icon-chevron-${settingsGeneralOpen ? 'up' : 'down'}`} aria-hidden />
          </button>
          {settingsGeneralOpen ? (
            <div className="tf-nav-group__body">
              <NavLink
                to="/admin/settings/profile"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-user tf-nav__icon" aria-hidden />
                Profile
              </NavLink>
              <NavLink
                to="/admin/settings/security"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-shield tf-nav__icon" aria-hidden />
                Security
              </NavLink>
              <NavLink
                to="/admin/settings/notifications"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-bell tf-nav__icon" aria-hidden />
                Notifications
              </NavLink>
              <NavLink
                to="/admin/settings/connected-apps"
                className={({ isActive }) => (isActive ? 'active' : undefined)}>
                <i className="feather icon-link-2 tf-nav__icon" aria-hidden />
                Connected apps
              </NavLink>
            </div>
          ) : null}
        </div>
        {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsWebsiteOpen((v) => !v)}
              aria-expanded={settingsWebsiteOpen}>
              Website settings
              <i className={`feather icon-chevron-${settingsWebsiteOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsWebsiteOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/admin/settings/company"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-briefcase tf-nav__icon" aria-hidden />
                  Company
                </NavLink>
                <NavLink
                  to="/admin/settings/preference"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-sliders tf-nav__icon" aria-hidden />
                  Preference
                </NavLink>
                <NavLink
                  to="/admin/settings/appearance"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-sidebar tf-nav__icon" aria-hidden />
                  Appearance
                </NavLink>
                <NavLink
                  to="/admin/settings/social-authentication"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-share-2 tf-nav__icon" aria-hidden />
                  Social login
                </NavLink>
              </div>
            ) : null}
          </div>
        ) : null}
        {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsAppOpen((v) => !v)}
              aria-expanded={settingsAppOpen}>
              App settings
              <i className={`feather icon-chevron-${settingsAppOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsAppOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/admin/settings/invoice"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-file-text tf-nav__icon" aria-hidden />
                  Invoice
                </NavLink>
                <NavLink
                  to="/admin/settings/printer"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-printer tf-nav__icon" aria-hidden />
                  Printers
                </NavLink>
                <NavLink
                  to="/admin/settings/pos"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-monitor tf-nav__icon" aria-hidden />
                  POS
                </NavLink>
                <NavLink
                  to="/admin/settings/signatures"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-edit-3 tf-nav__icon" aria-hidden />
                  Signatures
                </NavLink>
                <NavLink
                  to="/admin/settings/custom-fields"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-layout tf-nav__icon" aria-hidden />
                  Custom fields
                </NavLink>
              </div>
            ) : null}
          </div>
        ) : null}
        {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsSystemOpen((v) => !v)}
              aria-expanded={settingsSystemOpen}>
              System settings
              <i className={`feather icon-chevron-${settingsSystemOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsSystemOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/admin/settings/system"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-settings tf-nav__icon" aria-hidden />
                  System
                </NavLink>
                <NavLink
                  to="/admin/settings/email"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-mail tf-nav__icon" aria-hidden />
                  Email
                </NavLink>
                <NavLink
                  to="/admin/settings/email-templates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-layers tf-nav__icon" aria-hidden />
                  Email templates
                </NavLink>
                <NavLink
                  to="/admin/settings/sms-gateway"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-message-square tf-nav__icon" aria-hidden />
                  SMS gateway
                </NavLink>
                <NavLink
                  to="/admin/settings/sms-templates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-message-circle tf-nav__icon" aria-hidden />
                  SMS templates
                </NavLink>
                <NavLink
                  to="/admin/settings/otp"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-key tf-nav__icon" aria-hidden />
                  OTP
                </NavLink>
                <NavLink
                  to="/admin/settings/gdpr"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-shield tf-nav__icon" aria-hidden />
                  GDPR
                </NavLink>
              </div>
            ) : null}
          </div>
        ) : null}
        {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsFinancialOpen((v) => !v)}
              aria-expanded={settingsFinancialOpen}>
              Financial settings
              <i className={`feather icon-chevron-${settingsFinancialOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsFinancialOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/admin/settings/payment-gateway"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-credit-card tf-nav__icon" aria-hidden />
                  Payment gateway
                </NavLink>
                <NavLink
                  to="/admin/settings/bank-accounts"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-briefcase tf-nav__icon" aria-hidden />
                  Bank accounts
                </NavLink>
                <NavLink
                  to="/admin/settings/tax-rates"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-percent tf-nav__icon" aria-hidden />
                  Tax rates
                </NavLink>
                <NavLink
                  to="/admin/settings/currencies"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-dollar-sign tf-nav__icon" aria-hidden />
                  Currencies
                </NavLink>
              </div>
            ) : null}
          </div>
        ) : null}
        {canTenant ? (
          <div className="tf-nav-group tf-nav-group--settings">
            <button
              type="button"
              className="tf-nav-group__hdr"
              onClick={() => setSettingsOtherOpen((v) => !v)}
              aria-expanded={settingsOtherOpen}>
              Other settings
              <i className={`feather icon-chevron-${settingsOtherOpen ? 'up' : 'down'}`} aria-hidden />
            </button>
            {settingsOtherOpen ? (
              <div className="tf-nav-group__body">
                <NavLink
                  to="/admin/settings/storage"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-hard-drive tf-nav__icon" aria-hidden />
                  Storage
                </NavLink>
                <NavLink
                  to="/admin/settings/ban-ip"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}>
                  <i className="feather icon-slash tf-nav__icon" aria-hidden />
                  Ban IP address
                </NavLink>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
