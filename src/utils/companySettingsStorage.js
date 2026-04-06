const STORAGE_KEY = "retailpos_company_settings_v1";

/** @typedef {{ companyName: string, email: string, phone: string, website: string, location: string }} CompanySettingsForm */

export const defaultCompanySettings = {
  companyName: "",
  email: "",
  phone: "",
  website: "",
  location: ""
};

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
    location: buildLocationFromProfile(profile)
  };
}

/**
 * @param {typeof defaultCompanySettings} form
 * @returns {object} body for PATCH /tenant/company-profile
 */
export function formToCompanyProfileApiBody(form) {
  return {
    name: form.companyName.trim(),
    company_email: form.email.trim(),
    company_phone: form.phone.trim(),
    company_website: form.website.trim() || null,
    company_address_line: form.location.trim()
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
      location: merged.location || ""
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
