const STORAGE_KEY = "retailpos_company_settings_v1";

/** @typedef {{ companyName: string, email: string, phone: string, website: string, location: string }} CompanySettingsForm */

/** Shown on quotations (view, PDF, print) when company footer fields are left blank. */
export const QUOTATION_FOOTER_DEFAULTS = {
  paymentLine: "Cheque to: Breezetech Management Systems Ltd",
  bankLine:
    "Bank transfer to: Acc: 1286283051 · Bank: KCB Bank · SWIFT/BIC code: KCBLKENXXX · Bank code is 01",
  closingLine:
    "Thank you for your interest. This quotation is valid until the date shown above."
};

/** Collapse multi-line bank footer text to one line for the 3-line quotation footer layout. */
export function compactQuotationFooterBankLine(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

export const defaultCompanySettings = {
  companyName: "",
  email: "",
  phone: "",
  website: "",
  location: "",
  quotationFooterPaymentLine: "",
  quotationFooterBankLine: "",
  quotationFooterClosingLine: ""
};

/**
 * Resolved footer text for display (fallback to defaults when unset).
 * @param {Partial<typeof defaultCompanySettings>} snapshot
 */
export function resolveQuotationFooterFromSnapshot(snapshot) {
  const pay = String(snapshot?.quotationFooterPaymentLine ?? "").trim();
  const bank = String(snapshot?.quotationFooterBankLine ?? "").trim();
  const close = String(snapshot?.quotationFooterClosingLine ?? "").trim();
  return {
    paymentLine: pay || QUOTATION_FOOTER_DEFAULTS.paymentLine,
    bankLine: bank || QUOTATION_FOOTER_DEFAULTS.bankLine,
    closingLine: close || QUOTATION_FOOTER_DEFAULTS.closingLine
  };
}

/**
 * @param {string[]} parts
 * @returns {string}
 */
function joinLocationParts(parts) {
  return parts
    .filter((x) => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim())
    .join(", ");
}

/**
 * @param {object} profile
 * @returns {string}
 */
function buildLocationFromProfile(profile) {
  const line = String(profile.company_address_line ?? "").trim();
  if (line) {
    return line;
  }
  return joinLocationParts([
    String(profile.company_city ?? "").trim(),
    String(profile.company_state ?? "").trim(),
    String(profile.company_country ?? "").trim(),
    String(profile.company_postal_code ?? "").trim()
  ]);
}

/**
 * Map API `profile` or loaded `tenant` JSON to local form shape.
 * @param {object|null|undefined} profile
 * @returns {typeof defaultCompanySettings}
 */
export function profileApiToForm(profile) {
  if (!profile || typeof profile !== "object") {
    return { ...defaultCompanySettings };
  }
  return {
    companyName: String(profile.name ?? profile.company_name ?? "").trim(),
    email: String(profile.company_email ?? "").trim(),
    phone: String(profile.company_phone ?? "").trim(),
    website: String(profile.company_website ?? "").trim(),
    location: buildLocationFromProfile(profile),
    quotationFooterPaymentLine: String(
      profile.quotation_footer_payment_line ?? ""
    ).trim(),
    quotationFooterBankLine: String(profile.quotation_footer_bank_line ?? "").trim(),
    quotationFooterClosingLine: String(
      profile.quotation_footer_closing_line ?? ""
    ).trim()
  };
}

/**
 * @param {typeof defaultCompanySettings} form
 * @returns {object} body for PATCH /tenant/company-profile
 */
export function formToCompanyProfileApiBody(form) {
  const trimOrNull = (v) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };
  return {
    name: form.companyName.trim(),
    company_email: form.email.trim(),
    company_phone: form.phone.trim(),
    company_website: form.website.trim() || null,
    company_address_line: form.location.trim(),
    quotation_footer_payment_line: trimOrNull(form.quotationFooterPaymentLine),
    quotation_footer_bank_line: trimOrNull(form.quotationFooterBankLine),
    quotation_footer_closing_line: trimOrNull(form.quotationFooterClosingLine)
  };
}

/**
 * Load persisted company profile (browser localStorage).
 * @returns {CompanySettingsForm}
 */
export function loadCompanySettings() {
  if (typeof window === "undefined") {
    return { ...defaultCompanySettings };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultCompanySettings };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...defaultCompanySettings };
    }
    const merged = { ...defaultCompanySettings, ...parsed };
    if (!merged.location?.trim()) {
      merged.location = joinLocationParts([
        merged.addressLine,
        merged.city,
        merged.state,
        merged.country,
        merged.postalCode
      ]);
    }
    return {
      companyName: merged.companyName,
      email: merged.email,
      phone: merged.phone,
      website: merged.website,
      location: merged.location || "",
      quotationFooterPaymentLine: String(merged.quotationFooterPaymentLine ?? "").trim(),
      quotationFooterBankLine: String(merged.quotationFooterBankLine ?? "").trim(),
      quotationFooterClosingLine: String(merged.quotationFooterClosingLine ?? "").trim()
    };
  } catch {
    return { ...defaultCompanySettings };
  }
}

/**
 * @param {CompanySettingsForm} data
 */
export function saveCompanySettings(data) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}

/** Snapshot for other screens (e.g. quotations footer). */
export function getCompanySettingsSnapshot() {
  return loadCompanySettings();
}

/** Same key as `companysettings.jsx` — tenant UI / company settings page. */
const COMPANY_LOGOS_STORAGE_KEY = "retailpos_company_logo_settings_v1";

/** @returns {{ icon: string|null, favicon: string|null, logo: string|null, darkLogo: string|null }} */
export function defaultCompanyLogoSettings() {
  return {
    icon: null,
    favicon: null,
    logo: null,
    darkLogo: null
  };
}

/**
 * Company image slots saved from Settings → Company (data URLs or absolute URLs).
 * @returns {ReturnType<typeof defaultCompanyLogoSettings>}
 */
export function loadCompanyLogoSettings() {
  if (typeof window === "undefined") {
    return defaultCompanyLogoSettings();
  }
  try {
    const raw = localStorage.getItem(COMPANY_LOGOS_STORAGE_KEY);
    if (!raw) {
      return defaultCompanyLogoSettings();
    }
    const src = JSON.parse(raw);
    if (!src || typeof src !== "object") {
      return defaultCompanyLogoSettings();
    }
    return {
      icon:
        typeof src.icon === "string" && src.icon.trim() ? src.icon.trim() : null,
      favicon:
        typeof src.favicon === "string" && src.favicon.trim()
          ? src.favicon.trim()
          : null,
      logo:
        typeof src.logo === "string" && src.logo.trim() ? src.logo.trim() : null,
      darkLogo:
        typeof src.darkLogo === "string" && src.darkLogo.trim()
          ? src.darkLogo.trim()
          : null
    };
  } catch {
    return defaultCompanyLogoSettings();
  }
}
