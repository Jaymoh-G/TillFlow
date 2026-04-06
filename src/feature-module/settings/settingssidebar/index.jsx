import { useEffect, useState } from "react";
import { all_routes } from "../../../routes/all_routes";
import { Link, useLocation } from "react-router-dom";

const SettingsSideBar = (props) => {
  const route = all_routes;
  const location = useLocation();
  const profileSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminProfile
    : route.generalsettings;
  const companySettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminCompanySettings
    : route.companysettings;
  const securitySettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSecurity
    : route.securitysettings;
  const systemSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSystemSettings
    : route.systemsettings;
  const preferenceSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminPreference
    : route.preference;
  const appearanceSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminAppearance
    : route.appearance;
  const socialAuthSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSocialAuth
    : route.socialauthendication;
  const notificationSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminNotification
    : route.notification;
  const connectedAppsSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminConnectedApps
    : route.connectedapps;
  const invoiceSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminInvoiceSettings
    : route.invoicesettings;
  const printerSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminPrinterSettings
    : route.printersettings;
  const posSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminPosSettings
    : route.possettings;
  const signaturesSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSignatures
    : route.signatures;
  const customFieldsSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminCustomFields
    : route.customfields;
  const emailSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminEmailSettings
    : route.emailsettings;
  const emailTemplatesPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminEmailTemplates
    : route.emailtemplate;
  const smsGatewayPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSmsGateway
    : route.smssettings;
  const smsTemplatesPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminSmsTemplates
    : route.smstemplate;
  const otpSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminOtpSettings
    : route.otpsettings;
  const gdprSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminGdprSettings
    : route.gdbrsettings;
  const paymentGatewayPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminPaymentGateway
    : route.paymentgateway;
  const bankAccountsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminBankAccounts
    : route.banksettingsgrid;
  const taxRatesPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminTaxRates
    : route.taxrates;
  const currencySettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminCurrencySettings
    : route.currencysettings;
  const storageSettingsPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminStorageSettings
    : route.storagesettings;
  const banIpAddressPath = location.pathname.startsWith("/tillflow/admin")
    ? route.tillflowAdminBanIpAddress
    : route.banipaddress;

  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);
  const [isWebsiteSettingsOpen, setIsWebsiteSettingsOpen] = useState(false);

  const toggleGeneralSettings = () => {
    setIsGeneralSettingsOpen(!isGeneralSettingsOpen);
  };

  const toggleWebsiteSettings = () => {
    setIsWebsiteSettingsOpen(!isWebsiteSettingsOpen);
  };

  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);

  const toggleAppSettings = () => {
    setIsAppSettingsOpen((prev) => !prev);
  };
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const toggleSystemSettings = () => {
    setIsSystemSettingsOpen((prev) => !prev);
  };
  const [isFinancialSettingsOpen, setIsFinancialSettingsOpen] = useState(false);
  const toggleFinancialSettings = () => {
    setIsFinancialSettingsOpen((prev) => !prev);
  };

  const [isOtherSettingsOpen, setIsOtherSettingsOpen] = useState(false);

  const toggleOtherSettings = () => {
    setIsOtherSettingsOpen((prev) => !prev);
  };
  const [isSubmenutwo, setSubmenutwo] = useState(false);

  const toggleSubmenutwo = () => {
    setSubmenutwo((prev) => !prev);
  };
  const [isSms, setSms] = useState(false);

  const toggleSms = () => {
    setSms((prev) => !prev);
  };

  useEffect(() => {
    const p = location.pathname;
    if (
      p === route.generalsettings ||
      p === route.tillflowAdminProfile ||
      p === route.securitysettings ||
      p === route.tillflowAdminSecurity ||
      p === route.notification ||
      p === route.tillflowAdminNotification ||
      p === route.connectedapps ||
      p === route.tillflowAdminConnectedApps
    ) {
      setIsGeneralSettingsOpen(true);
    }
    if (
      p === route.systemsettings ||
      p === route.tillflowAdminSystemSettings ||
      p === route.companysettings ||
      p === route.tillflowAdminCompanySettings ||
      p === route.preference ||
      p === route.tillflowAdminPreference ||
      p === route.appearance ||
      p === route.tillflowAdminAppearance ||
      p === route.socialauthendication ||
      p === route.tillflowAdminSocialAuth
    ) {
      setIsWebsiteSettingsOpen(true);
    }
    if (
      p === route.invoicesettings ||
      p === route.tillflowAdminInvoiceSettings ||
      p === route.printersettings ||
      p === route.tillflowAdminPrinterSettings ||
      p === route.possettings ||
      p === route.tillflowAdminPosSettings ||
      p === route.signatures ||
      p === route.tillflowAdminSignatures ||
      p === route.customfields ||
      p === route.tillflowAdminCustomFields
    ) {
      setIsAppSettingsOpen(true);
    }
    if (
      p === route.emailsettings ||
      p === route.tillflowAdminEmailSettings ||
      p === route.emailtemplate ||
      p === route.tillflowAdminEmailTemplates ||
      p === route.smssettings ||
      p === route.tillflowAdminSmsGateway ||
      p === route.smstemplate ||
      p === route.tillflowAdminSmsTemplates ||
      p === route.otpsettings ||
      p === route.tillflowAdminOtpSettings ||
      p === route.gdbrsettings ||
      p === route.tillflowAdminGdprSettings
    ) {
      setIsSystemSettingsOpen(true);
    }
    if (
      p === route.paymentgateway ||
      p === route.tillflowAdminPaymentGateway ||
      p === route.banksettingslist ||
      p === route.banksettingsgrid ||
      p === route.tillflowAdminBankAccounts ||
      p === route.taxrates ||
      p === route.tillflowAdminTaxRates ||
      p === route.currencysettings ||
      p === route.tillflowAdminCurrencySettings
    ) {
      setIsFinancialSettingsOpen(true);
    }
    if (
      p === route.storagesettings ||
      p === route.tillflowAdminStorageSettings ||
      p === route.banipaddress ||
      p === route.tillflowAdminBanIpAddress
    ) {
      setIsOtherSettingsOpen(true);
    }
  }, [location.pathname, route]);

  return (
    <div className="settings-layout__nav" {...props}>
      <div className="settings-sidebar" id="sidebar2">
        <div className="sidebar-inner slimscroll settings-sidebar__scroll">
            <div id="sidebar-menu5" className="sidebar-menu">
              <h4 className="fw-bold fs-18 mb-2 pb-2">Settings</h4>
              <ul>
                <li className="submenu-open">
                  <ul>
                    <li className="submenu">
                      <Link
                        to="#"
                        onClick={toggleGeneralSettings}
                        className={
                        location.pathname === route.generalsettings ||
                        location.pathname === route.tillflowAdminProfile ||
                        location.pathname === route.securitysettings ||
                        location.pathname === route.tillflowAdminSecurity ||
                        location.pathname === route.notification ||
                        location.pathname === route.tillflowAdminNotification ||
                        location.pathname === route.connectedapps ||
                        location.pathname === route.tillflowAdminConnectedApps ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-settings fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          General Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isGeneralSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to={profileSettingsPath}
                            className={
                            location.pathname === route.generalsettings ||
                            location.pathname === route.tillflowAdminProfile ?
                            "active" :
                            ""
                            }>

                            Profile
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={securitySettingsPath}
                            className={
                            location.pathname === route.securitysettings ||
                            location.pathname === route.tillflowAdminSecurity ?
                            "active" :
                            ""
                            }>

                            Security
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={notificationSettingsPath}
                            className={
                            location.pathname === route.notification ||
                            location.pathname === route.tillflowAdminNotification ?
                            "active" :
                            ""
                            }>

                            Notifications
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={connectedAppsSettingsPath}
                            className={
                            location.pathname === route.connectedapps ||
                            location.pathname === route.tillflowAdminConnectedApps ?
                            "active" :
                            ""
                            }>

                            Connected Apps
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li className="submenu">
                      <Link
                        to="#"
                        onClick={toggleWebsiteSettings}
                        className={
                        location.pathname === route.systemsettings ||
                        location.pathname === route.tillflowAdminSystemSettings ||
                        location.pathname === route.companysettings ||
                        location.pathname === route.tillflowAdminCompanySettings ||
                        location.pathname === route.preference ||
                        location.pathname === route.tillflowAdminPreference ||
                        location.pathname === route.appearance ||
                        location.pathname === route.tillflowAdminAppearance ||
                        location.pathname === route.socialauthendication ||
                        location.pathname === route.tillflowAdminSocialAuth ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-world fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          Website Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isWebsiteSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to={systemSettingsPath}
                            className={
                            location.pathname === route.systemsettings ||
                            location.pathname === route.tillflowAdminSystemSettings ?
                            "active" :
                            ""
                            }>

                            System Settings
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={companySettingsPath}
                            className={
                            location.pathname === route.companysettings ||
                            location.pathname === route.tillflowAdminCompanySettings ?
                            "active" :
                            ""
                            }>

                            Company Settings
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={preferenceSettingsPath}
                            className={
                            location.pathname === route.preference ||
                            location.pathname === route.tillflowAdminPreference ?
                            "active" :
                            ""
                            }>

                            Preference
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={appearanceSettingsPath}
                            className={
                            location.pathname === route.appearance ||
                            location.pathname === route.tillflowAdminAppearance ?
                            "active" :
                            ""
                            }>

                            Appearance
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={socialAuthSettingsPath}
                            className={
                            location.pathname === route.socialauthendication ||
                            location.pathname === route.tillflowAdminSocialAuth ?
                            "active" :
                            ""
                            }>

                            Social Authentication
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li className="submenu">
                      <Link
                        to="#"
                        onClick={toggleAppSettings}
                        className={
                        location.pathname === route.invoicesettings ||
                        location.pathname === route.tillflowAdminInvoiceSettings ||
                        location.pathname === route.printersettings ||
                        location.pathname === route.tillflowAdminPrinterSettings ||
                        location.pathname === route.possettings ||
                        location.pathname === route.tillflowAdminPosSettings ||
                        location.pathname === route.signatures ||
                        location.pathname === route.tillflowAdminSignatures ||
                        location.pathname === route.customfields ||
                        location.pathname === route.tillflowAdminCustomFields ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-device-mobile fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          App Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isAppSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to={invoiceSettingsPath}
                            className={
                            location.pathname === route.invoicesettings ||
                            location.pathname === route.tillflowAdminInvoiceSettings ?
                            "active" :
                            ""
                            }>

                            Invoice
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={printerSettingsPath}
                            className={
                            location.pathname === route.printersettings ||
                            location.pathname === route.tillflowAdminPrinterSettings ?
                            "active" :
                            ""
                            }>

                            Printer
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={posSettingsPath}
                            className={
                            location.pathname === route.possettings ||
                            location.pathname === route.tillflowAdminPosSettings ?
                            "active" :
                            ""
                            }>

                            POS
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={signaturesSettingsPath}
                            className={
                            location.pathname === route.signatures ||
                            location.pathname === route.tillflowAdminSignatures ?
                            "active" :
                            ""
                            }>

                            Signatures
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={customFieldsSettingsPath}
                            className={
                            location.pathname === route.customfields ||
                            location.pathname === route.tillflowAdminCustomFields ?
                            "active" :
                            ""
                            }>

                            Custom Fields
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li className="submenu">
                      <Link
                        to="#"
                        onClick={toggleSystemSettings}
                        className={
                        location.pathname === route.emailsettings ||
                        location.pathname === route.tillflowAdminEmailSettings ||
                        location.pathname === route.emailtemplate ||
                        location.pathname === route.tillflowAdminEmailTemplates ||
                        location.pathname === route.smssettings ||
                        location.pathname === route.tillflowAdminSmsGateway ||
                        location.pathname === route.smstemplate ||
                        location.pathname === route.tillflowAdminSmsTemplates ||
                        location.pathname === route.otpsettings ||
                        location.pathname === route.tillflowAdminOtpSettings ||
                        location.pathname === route.gdbrsettings ||
                        location.pathname === route.tillflowAdminGdprSettings ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-device-desktop fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          System Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isSystemSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to="#"
                            className={`submenu-two ${location.pathname === route.emailsettings || location.pathname === route.tillflowAdminEmailSettings || location.pathname === route.emailtemplate || location.pathname === route.tillflowAdminEmailTemplates ? "active" : ""}`}
                            onClick={toggleSubmenutwo}>

                            Email
                            <span className="menu-arrow inside-submenu"></span>
                          </Link>
                          <ul
                            style={{ display: isSubmenutwo ? "block" : "none" }}>

                            <li>
                              <Link
                                to={emailSettingsPath}
                                className={`${location.pathname === route.emailsettings || location.pathname === route.tillflowAdminEmailSettings ? "active" : ""}`}>

                                Email Settings
                              </Link>
                            </li>
                            <li>
                              <Link
                                to={emailTemplatesPath}
                                className={`${location.pathname === route.emailtemplate || location.pathname === route.tillflowAdminEmailTemplates ? "active" : ""}`}>

                                Email Templates
                              </Link>
                            </li>
                          </ul>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className={`submenu-two ${location.pathname === route.smssettings || location.pathname === route.tillflowAdminSmsGateway || location.pathname === route.smstemplate || location.pathname === route.tillflowAdminSmsTemplates ? "active" : ""}`}
                            onClick={toggleSms}>

                            SMS Gateways
                            <span className="menu-arrow inside-submenu"></span>
                          </Link>
                          <ul style={{ display: isSms ? "block" : "none" }}>
                            <li>
                              <Link
                                to={smsGatewayPath}
                                className={`${location.pathname === route.smssettings || location.pathname === route.tillflowAdminSmsGateway ? "active" : ""}`}>

                                SMS Settings
                              </Link>
                            </li>
                            <li>
                              <Link
                                to={smsTemplatesPath}
                                className={
                                  location.pathname === route.smstemplate ||
                                  location.pathname === route.tillflowAdminSmsTemplates
                                    ? "active"
                                    : ""
                                }>
                                SMS Templates
                              </Link>
                            </li>
                          </ul>
                        </li>
                        <li>
                          <Link
                            to={otpSettingsPath}
                            className={
                            location.pathname === route.otpsettings ||
                            location.pathname === route.tillflowAdminOtpSettings ?
                            "active" :
                            ""
                            }>

                            OTP
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={gdprSettingsPath}
                            className={
                            location.pathname === route.gdbrsettings ||
                            location.pathname === route.tillflowAdminGdprSettings ?
                            "active" :
                            ""
                            }>

                            GDPR Cookies
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li className="submenu">
                      <Link
                        to="#"
                        // className={`active ${
                        //   isFinancialSettingsOpen ? "subdrop" : ""
                        // }`}
                        onClick={toggleFinancialSettings}
                        className={
                        location.pathname === route.paymentgateway ||
                        location.pathname === route.tillflowAdminPaymentGateway ||
                        location.pathname === route.banksettingslist ||
                        location.pathname === route.banksettingsgrid ||
                        location.pathname === route.tillflowAdminBankAccounts ||
                        location.pathname === route.taxrates ||
                        location.pathname === route.tillflowAdminTaxRates ||
                        location.pathname === route.currencysettings ||
                        location.pathname === route.tillflowAdminCurrencySettings ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-settings-dollar fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          Financial Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isFinancialSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to={paymentGatewayPath}
                            className={
                            location.pathname === route.paymentgateway ||
                            location.pathname === route.tillflowAdminPaymentGateway ?
                            "active" :
                            ""
                            }>

                            Payment Gateway
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={bankAccountsPath}
                            className={
                            location.pathname === route.banksettingsgrid ||
                            location.pathname === route.tillflowAdminBankAccounts ?
                            "active" :
                            ""
                            }>

                            Bank Accounts
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={taxRatesPath}
                            className={
                            location.pathname === route.taxrates ||
                            location.pathname === route.tillflowAdminTaxRates ?
                            "active" :
                            ""
                            }>

                            Tax Rates
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={currencySettingsPath}
                            className={
                            location.pathname === route.currencysettings ||
                            location.pathname === route.tillflowAdminCurrencySettings ?
                            "active" :
                            ""
                            }>

                            Currencies
                          </Link>
                        </li>
                      </ul>
                    </li>
                    <li className="submenu">
                      <Link
                        to="#"
                        onClick={toggleOtherSettings}
                        className={
                        location.pathname === route.storagesettings ||
                        location.pathname === route.tillflowAdminStorageSettings ||
                        location.pathname === route.banipaddress ||
                        location.pathname === route.tillflowAdminBanIpAddress ?
                        "active subdrop" :
                        ""
                        }>

                        <i className="ti ti-settings-2 fs-18"></i>
                        <span className="fs-14 fw-medium ms-2">
                          Other Settings
                        </span>
                        <span className="menu-arrow" />
                      </Link>
                      <ul
                        style={{
                          display: isOtherSettingsOpen ? "block" : "none"
                        }}>

                        <li>
                          <Link
                            to={storageSettingsPath}
                            className={
                            location.pathname === route.storagesettings ||
                            location.pathname === route.tillflowAdminStorageSettings ?
                            "active" :
                            ""
                            }>

                            Storage
                          </Link>
                        </li>
                        <li>
                          <Link
                            to={banIpAddressPath}
                            className={
                            location.pathname === route.banipaddress ||
                            location.pathname === route.tillflowAdminBanIpAddress ?
                            "active" :
                            ""
                            }>

                            Ban IP Address
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
        </div>
      </div>
    </div>);

};
export default SettingsSideBar;
