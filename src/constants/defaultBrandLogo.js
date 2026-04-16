/**
 * Shown wherever a tenant-specific logo is not set (sidebar, login, invoices, quotations, etc.).
 * File is served from `public/branding/breezetech-logo.png`.
 */
export const DEFAULT_BRAND_LOGO_URL = "/branding/breezetech-logo.png";

/** Use for invoice / receipt logo fields stored as data URLs or remote URLs. */
export function resolveInvoiceLogoUrl(invoiceLogoDataUrl) {
  const s = String(invoiceLogoDataUrl ?? "").trim();
  return s || DEFAULT_BRAND_LOGO_URL;
}
