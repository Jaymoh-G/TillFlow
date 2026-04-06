const SYS_KEY = "retailpos_system_integrations_v1";
const PREF_KEY = "retailpos_store_preferences_v1";

/** @returns {{ captcha: boolean, analytics: boolean, adsense: boolean, maps: boolean }} */
export function defaultSystemIntegrations() {
  return {
    captcha: false,
    analytics: false,
    adsense: false,
    maps: false
  };
}

/** @returns {Record<string, boolean>} */
export function defaultStorePreferences() {
  return {
    maintenanceMode: false,
    coupons: false,
    offers: false,
    multiLanguage: false,
    multiCurrency: false,
    sms: false,
    stores: true,
    warehouses: false,
    barcode: true,
    qrCode: false,
    hrms: false
  };
}

export function loadSystemIntegrations() {
  try {
    const raw = localStorage.getItem(SYS_KEY);
    if (!raw) {
      return defaultSystemIntegrations();
    }
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") {
      return defaultSystemIntegrations();
    }
    const d = defaultSystemIntegrations();
    return {
      captcha: typeof p.captcha === "boolean" ? p.captcha : d.captcha,
      analytics: typeof p.analytics === "boolean" ? p.analytics : d.analytics,
      adsense: typeof p.adsense === "boolean" ? p.adsense : d.adsense,
      maps: typeof p.maps === "boolean" ? p.maps : d.maps
    };
  } catch {
    return defaultSystemIntegrations();
  }
}

/** @type {Array<(data: ReturnType<typeof defaultSystemIntegrations>) => void>} */
const afterSaveSystemIntegrations = [];

/** @param {(data: ReturnType<typeof defaultSystemIntegrations>) => void} fn @returns {() => void} */
export function addAfterSaveSystemIntegrationsListener(fn) {
  afterSaveSystemIntegrations.push(fn);
  return () => {
    const i = afterSaveSystemIntegrations.indexOf(fn);
    if (i >= 0) {
      afterSaveSystemIntegrations.splice(i, 1);
    }
  };
}

export function saveSystemIntegrations(data) {
  try {
    localStorage.setItem(SYS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  for (const fn of afterSaveSystemIntegrations) {
    try {
      fn(data);
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Hydrate from tenant API without firing sync listeners. */
export function replaceSystemIntegrationsFromServer(raw) {
  const next = (() => {
    if (!raw || typeof raw !== "object") {
      return defaultSystemIntegrations();
    }
    const p = raw;
    const d = defaultSystemIntegrations();
    return {
      captcha: typeof p.captcha === "boolean" ? p.captcha : d.captcha,
      analytics: typeof p.analytics === "boolean" ? p.analytics : d.analytics,
      adsense: typeof p.adsense === "boolean" ? p.adsense : d.adsense,
      maps: typeof p.maps === "boolean" ? p.maps : d.maps
    };
  })();
  try {
    localStorage.setItem(SYS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadStorePreferences() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) {
      return defaultStorePreferences();
    }
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") {
      return defaultStorePreferences();
    }
    const d = defaultStorePreferences();
    /** @type {Record<string, boolean>} */
    const out = {};
    for (const key of Object.keys(d)) {
      out[key] = typeof p[key] === "boolean" ? p[key] : d[key];
    }
    return out;
  } catch {
    return defaultStorePreferences();
  }
}

/** @type {Array<(data: Record<string, boolean>) => void>} */
const afterSaveStorePreferences = [];

/** @param {(data: Record<string, boolean>) => void} fn */
export function addAfterSaveStorePreferencesListener(fn) {
  afterSaveStorePreferences.push(fn);
  return () => {
    const i = afterSaveStorePreferences.indexOf(fn);
    if (i >= 0) {
      afterSaveStorePreferences.splice(i, 1);
    }
  };
}

export function saveStorePreferences(data) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  for (const fn of afterSaveStorePreferences) {
    try {
      fn(data);
    } catch {
      /* ignore */
    }
  }
}

/** @param {unknown} raw */
export function replaceStorePreferencesFromServer(raw) {
  const next = (() => {
    if (!raw || typeof raw !== "object") {
      return defaultStorePreferences();
    }
    const p = raw;
    const d = defaultStorePreferences();
    /** @type {Record<string, boolean>} */
    const out = {};
    for (const key of Object.keys(d)) {
      out[key] = typeof p[key] === "boolean" ? p[key] : d[key];
    }
    return out;
  })();
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
