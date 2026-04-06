const STORAGE_KEY = "retailpos_app_settings_v1";

/** @typedef {{ id: string, name: string, connectionType: string, ipAddress: string, port: string }} AppPrinter */
/** @typedef {{ id: string, name: string, active: boolean, isDefault: boolean, imageDataUrl: string | null }} AppSignature */
/** @typedef {{ id: string, module: string, label: string, type: string, defaultValue: string, requirement: string, status: string }} AppCustomField */

export function defaultInvoiceSettings() {
  return {
    invoiceLogoDataUrl: null,
    prefix: "INV-",
    dueDays: "7",
    roundOffEnabled: true,
    roundOffMode: "up",
    showCompanyDetails: true,
    headerTerms: "",
    footerTerms: ""
  };
}

/** @returns {AppPrinter[]} */
export function defaultPrinters() {
  return [
    {
      id: "printer_demo_1",
      name: "Receipt — front counter",
      connectionType: "Network",
      ipAddress: "192.168.1.50",
      port: "9100"
    },
    {
      id: "printer_demo_2",
      name: "Office — A4",
      connectionType: "Network",
      ipAddress: "192.168.1.51",
      port: "9100"
    }
  ];
}

/**
 * @returns {{
 *   receiptPaper: string,
 *   paymentMethods: Record<string, boolean>,
 *   soundEnabled: boolean
 * }}
 */
export function defaultPosSettings() {
  return {
    receiptPaper: "80mm",
    paymentMethods: {
      cod: true,
      cheque: true,
      card: true,
      paypal: false,
      bankTransfer: true,
      cash: true
    },
    soundEnabled: true
  };
}

/** @returns {AppSignature[]} */
export function defaultSignatures() {
  return [
    {
      id: "sig_demo_1",
      name: "Authorized signatory",
      active: true,
      isDefault: true,
      imageDataUrl: null
    }
  ];
}

/** @returns {AppCustomField[]} */
export function defaultCustomFields() {
  return [
    {
      id: "cf_demo_1",
      module: "Product",
      label: "Weight (kg)",
      type: "Number",
      defaultValue: "0",
      requirement: "Optional",
      status: "Active"
    },
    {
      id: "cf_demo_2",
      module: "Customer",
      label: "Account type",
      type: "Select",
      defaultValue: "Regular",
      requirement: "Required",
      status: "Active"
    }
  ];
}

/**
 * @returns {{
 *   invoice: ReturnType<typeof defaultInvoiceSettings>,
 *   printers: AppPrinter[],
 *   pos: ReturnType<typeof defaultPosSettings>,
 *   signatures: AppSignature[],
 *   customFields: AppCustomField[]
 * }}
 */
export function getDefaultAppSettings() {
  return {
    invoice: defaultInvoiceSettings(),
    printers: defaultPrinters(),
    pos: defaultPosSettings(),
    signatures: defaultSignatures(),
    customFields: defaultCustomFields()
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof getDefaultAppSettings>}
 */
function normalizeAppSettings(raw) {
  const d = getDefaultAppSettings();
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const o = /** @type {Record<string, unknown>} */ (raw);

  const invoice = o.invoice && typeof o.invoice === "object" ? /** @type {Record<string, unknown>} */ (o.invoice) : {};
  const inv = { ...d.invoice };
  if (typeof invoice.invoiceLogoDataUrl === "string" || invoice.invoiceLogoDataUrl === null) {
    inv.invoiceLogoDataUrl = /** @type {string | null} */ (invoice.invoiceLogoDataUrl);
  }
  for (const k of ["prefix", "dueDays", "roundOffMode", "headerTerms", "footerTerms"]) {
    if (typeof invoice[k] === "string") {
      inv[k] = invoice[k];
    }
  }
  if (typeof invoice.roundOffEnabled === "boolean") {
    inv.roundOffEnabled = invoice.roundOffEnabled;
  }
  if (typeof invoice.showCompanyDetails === "boolean") {
    inv.showCompanyDetails = invoice.showCompanyDetails;
  }

  /** @type {AppPrinter[]} */
  let printers = d.printers;
  if (Array.isArray(o.printers)) {
    printers = o.printers
      .filter((p) => p && typeof p === "object")
      .map((p) => {
       const r = /** @type {Record<string, unknown>} */ (p);
       return {
         id: typeof r.id === "string" ? r.id : `p_${Math.random().toString(36).slice(2)}`,
         name: typeof r.name === "string" ? r.name : "",
         connectionType: typeof r.connectionType === "string" ? r.connectionType : "Network",
         ipAddress: typeof r.ipAddress === "string" ? r.ipAddress : "",
         port: typeof r.port === "string" ? r.port : ""
       };
     });
  }

  const pos = o.pos && typeof o.pos === "object" ? /** @type {Record<string, unknown>} */ (o.pos) : {};
  const posOut = { ...d.pos };
  if (typeof pos.receiptPaper === "string") {
    posOut.receiptPaper = pos.receiptPaper;
  }
  if (typeof pos.soundEnabled === "boolean") {
    posOut.soundEnabled = pos.soundEnabled;
  }
  if (pos.paymentMethods && typeof pos.paymentMethods === "object") {
    const pm = /** @type {Record<string, unknown>} */ (pos.paymentMethods);
    for (const key of Object.keys(posOut.paymentMethods)) {
      if (typeof pm[key] === "boolean") {
        posOut.paymentMethods[key] = pm[key];
      }
    }
  }

  /** @type {AppSignature[]} */
  let signatures = d.signatures;
  if (Array.isArray(o.signatures)) {
    signatures = o.signatures
      .filter((s) => s && typeof s === "object")
      .map((s) => {
        const r = /** @type {Record<string, unknown>} */ (s);
        return {
          id: typeof r.id === "string" ? r.id : `s_${Math.random().toString(36).slice(2)}`,
          name: typeof r.name === "string" ? r.name : "",
          active: r.active !== false,
          isDefault: r.isDefault === true,
          imageDataUrl: typeof r.imageDataUrl === "string" || r.imageDataUrl === null ? r.imageDataUrl : null
        };
      });
  }

  /** @type {AppCustomField[]} */
  let customFields = d.customFields;
  if (Array.isArray(o.customFields)) {
    customFields = o.customFields
      .filter((c) => c && typeof c === "object")
      .map((c) => {
        const r = /** @type {Record<string, unknown>} */ (c);
        return {
          id: typeof r.id === "string" ? r.id : `cf_${Math.random().toString(36).slice(2)}`,
          module: typeof r.module === "string" ? r.module : "Product",
          label: typeof r.label === "string" ? r.label : "",
          type: typeof r.type === "string" ? r.type : "Text",
          defaultValue: typeof r.defaultValue === "string" ? r.defaultValue : "",
          requirement: typeof r.requirement === "string" ? r.requirement : "Optional",
          status: typeof r.status === "string" ? r.status : "Active"
        };
      });
  }

  return {
    invoice: inv,
    printers,
    pos: posOut,
    signatures,
    customFields
  };
}

export function loadAppSettings() {
  if (typeof window === "undefined") {
    return getDefaultAppSettings();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultAppSettings();
    }
    return normalizeAppSettings(JSON.parse(raw));
  } catch {
    return getDefaultAppSettings();
  }
}

/** @type {Array<(data: ReturnType<typeof getDefaultAppSettings>) => void>} */
const afterSaveAppSettings = [];

/** @param {(data: ReturnType<typeof getDefaultAppSettings>) => void} fn */
export function addAfterSaveAppSettingsListener(fn) {
  afterSaveAppSettings.push(fn);
  return () => {
    const i = afterSaveAppSettings.indexOf(fn);
    if (i >= 0) {
      afterSaveAppSettings.splice(i, 1);
    }
  };
}

/** @param {unknown} raw — server payload; normalized before persist (no listeners). */
export function replaceAppSettingsFromServer(raw) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeAppSettings(raw);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* quota */
  }
}

/**
 * @param {ReturnType<typeof getDefaultAppSettings>} data
 */
export function saveAppSettings(data) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
  for (const fn of afterSaveAppSettings) {
    try {
      fn(data);
    } catch {
      /* ignore */
    }
  }
}

export function newLocalId() {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Read invoice-related settings for POS / invoice UI (optional consumers).
 * @returns {ReturnType<typeof defaultInvoiceSettings>}
 */
export function getInvoiceSettingsSnapshot() {
  return loadAppSettings().invoice;
}
