const STORAGE_PREFIX = "tillflow_notification_prefs_v1";

/** @typedef {{ push: boolean, sms: boolean, email: boolean }} TopicChannels */

/**
 * @returns {{
 *   channelBrowser: boolean,
 *   channelEmail: boolean,
 *   channelSms: boolean,
 *   topics: Record<string, TopicChannels>
 * }}
 */
export function defaultNotificationPreferences() {
  return {
    channelBrowser: true,
    channelEmail: true,
    channelSms: false,
    topics: {
      payments: { push: true, sms: false, email: true },
      sales: { push: true, sms: false, email: true },
      inventory: { push: true, sms: true, email: true },
      expiry: { push: true, sms: false, email: true },
      quotations: { push: false, sms: false, email: true },
      account: { push: true, sms: false, email: true }
    }
  };
}

/** @param {string|number|null|undefined} userId */
function storageKey(userId) {
  const id = userId != null && String(userId).trim() !== "" ? String(userId) : "local";
  return `${STORAGE_PREFIX}:${id}`;
}

/**
 * @param {string|number|null|undefined} userId
 * @returns {ReturnType<typeof defaultNotificationPreferences>}
 */
export function loadNotificationPreferences(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) {
      return defaultNotificationPreferences();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultNotificationPreferences();
    }
    const base = defaultNotificationPreferences();
    return {
      channelBrowser: typeof parsed.channelBrowser === "boolean" ? parsed.channelBrowser : base.channelBrowser,
      channelEmail: typeof parsed.channelEmail === "boolean" ? parsed.channelEmail : base.channelEmail,
      channelSms: typeof parsed.channelSms === "boolean" ? parsed.channelSms : base.channelSms,
      topics: mergeTopics(parsed.topics, base.topics)
    };
  } catch {
    return defaultNotificationPreferences();
  }
}

/** @param {unknown} raw @param {Record<string, TopicChannels>} defaults */
function mergeTopics(raw, defaults) {
  /** @type {Record<string, TopicChannels>} */
  const out = { ...defaults };
  if (!raw || typeof raw !== "object") {
    return out;
  }
  for (const key of Object.keys(defaults)) {
    const v = raw[key];
    if (!v || typeof v !== "object") {
      continue;
    }
    out[key] = {
      push: typeof v.push === "boolean" ? v.push : defaults[key].push,
      sms: typeof v.sms === "boolean" ? v.sms : defaults[key].sms,
      email: typeof v.email === "boolean" ? v.email : defaults[key].email
    };
  }
  return out;
}

/**
 * @param {string|number|null|undefined} userId
 * @param {ReturnType<typeof defaultNotificationPreferences>} prefs
 */
/** @type {Array<(userId: string|number|null|undefined, prefs: ReturnType<typeof defaultNotificationPreferences>) => void>} */
const afterSaveNotificationPreferences = [];

/** @param {typeof afterSaveNotificationPreferences[number]} fn */
export function addAfterSaveNotificationPreferencesListener(fn) {
  afterSaveNotificationPreferences.push(fn);
  return () => {
    const i = afterSaveNotificationPreferences.indexOf(fn);
    if (i >= 0) {
      afterSaveNotificationPreferences.splice(i, 1);
    }
  };
}

/**
 * @param {string|number|null|undefined} userId
 * @param {unknown} raw
 */
export function replaceNotificationPreferencesFromServer(userId, raw) {
  const base = defaultNotificationPreferences();
  if (!raw || typeof raw !== "object") {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(base));
    } catch {
      /* ignore */
    }
    return;
  }
  const parsed = raw;
  const prefs = {
    channelBrowser:
      typeof parsed.channelBrowser === "boolean" ? parsed.channelBrowser : base.channelBrowser,
    channelEmail: typeof parsed.channelEmail === "boolean" ? parsed.channelEmail : base.channelEmail,
    channelSms: typeof parsed.channelSms === "boolean" ? parsed.channelSms : base.channelSms,
    topics: mergeTopics(parsed.topics, base.topics)
  };
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function saveNotificationPreferences(userId, prefs) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  for (const fn of afterSaveNotificationPreferences) {
    try {
      fn(userId, prefs);
    } catch {
      /* ignore */
    }
  }
}

export const NOTIFICATION_TOPIC_ROWS = [
  { id: "payments", label: "Payments & checkouts" },
  { id: "sales", label: "Sales & invoices" },
  { id: "inventory", label: "Stock & inventory" },
  { id: "expiry", label: "Expiry & waste alerts" },
  { id: "quotations", label: "Quotations" },
  { id: "account", label: "Account & security" }
];
