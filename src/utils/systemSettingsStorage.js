const STORAGE_KEY = "retailpos_system_communications_v1";

export const EMAIL_TEMPLATE_DEFS = [
  { id: "welcome", title: "Welcome Email" },
  { id: "orderConfirmation", title: "Order Confirmation" },
  { id: "invoiceReceipt", title: "Invoice Receipt" },
  { id: "subscriptionRenewal", title: "Subscription Renewal Reminder" },
  { id: "seasonalPromotion", title: "Seasonal Promotion" },
  { id: "systemUpdate", title: "System Update" }
];

export const SMS_TEMPLATE_DEFS = [
  { id: "orderConfirmation", title: "Order Confirmation" },
  { id: "shippingUpdate", title: "Shipping Update" },
  { id: "invoiceReceipt", title: "Invoice Receipt" },
  { id: "subscriptionRenewal", title: "Subscription Renewal Reminder" },
  { id: "seasonalPromotion", title: "Seasonal Promotion" },
  { id: "systemUpdate", title: "System Update" }
];

const DEFAULT_EMAIL_BODY = `Hi {Customer Name},

Thank you for choosing {Company Name}.

— {Company Name} Team`;

const DEFAULT_SMS_BODY = `Hi {Customer Name}, update from {Company Name} (order {Order ID}).`;

/** @param {{ id: string }[]} defs */
function defaultTemplatesFromDefs(defs, defaultBody) {
  /** @type {Record<string, { enabled: boolean, body: string }>} */
  const o = {};
  for (const { id } of defs) {
    o[id] = { enabled: true, body: defaultBody };
  }
  return o;
}

export function getDefaultSystemSettings() {
  return {
    email: {
      phpMailer: { enabled: false, fromEmail: "", password: "", fromName: "" },
      smtp: {
        enabled: true,
        fromEmail: "",
        password: "",
        host: "",
        port: "587",
        fromName: ""
      },
      sendGrid: { enabled: false, apiKey: "", fromEmail: "" }
    },
    testRecipient: "",
    smsGateways: {
      nexmo: { enabled: false, apiKey: "", apiSecret: "", senderId: "" },
      twilio: { enabled: false, accountSid: "", authToken: "", fromNumber: "" },
      twoFactor: { enabled: false, apiKey: "", senderId: "" }
    },
    smsDelivery: { senderLabel: "", notes: "" },
    emailTemplates: defaultTemplatesFromDefs(EMAIL_TEMPLATE_DEFS, DEFAULT_EMAIL_BODY),
    smsTemplates: defaultTemplatesFromDefs(SMS_TEMPLATE_DEFS, DEFAULT_SMS_BODY),
    otp: { channel: "SMS", digits: "6", expire: "10mins" },
    gdpr: {
      consentText: "",
      position: "left",
      agreeText: "Agree",
      declineText: "Decline",
      showDecline: true,
      policyLink: ""
    }
  };
}

/**
 * @param {Record<string, { enabled?: boolean, body?: string }>} raw
 * @param {typeof EMAIL_TEMPLATE_DEFS} defs
 * @param {string} defaultBody
 */
function normalizeTemplates(raw, defs, defaultBody) {
  const d = defaultTemplatesFromDefs(defs, defaultBody);
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const o = { ...d };
  for (const { id } of defs) {
    const t = raw[id];
    if (t && typeof t === "object") {
      o[id] = {
        enabled: t.enabled !== false,
        body: typeof t.body === "string" ? t.body : d[id].body
      };
    }
  }
  return o;
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof getDefaultSystemSettings>}
 */
function normalizeSystemSettings(raw) {
  const d = getDefaultSystemSettings();
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const x = /** @type {Record<string, unknown>} */ (raw);

  const email = x.email && typeof x.email === "object" ? /** @type {any} */ (x.email) : {};
  const smsG = x.smsGateways && typeof x.smsGateways === "object" ? /** @type {any} */ (x.smsGateways) : {};
  const smsDel =
    x.smsDelivery && typeof x.smsDelivery === "object" ? /** @type {any} */ (x.smsDelivery) : {};
  const otp = x.otp && typeof x.otp === "object" ? /** @type {any} */ (x.otp) : {};
  const gdpr = x.gdpr && typeof x.gdpr === "object" ? /** @type {any} */ (x.gdpr) : {};

  const mergeProvider = (base, patch) => {
    if (!patch || typeof patch !== "object") {
      return { ...base };
    }
    const o = { ...base };
    for (const k of Object.keys(base)) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) {
        o[k] = patch[k];
      }
    }
    return o;
  };

  return {
    email: {
      phpMailer: mergeProvider(d.email.phpMailer, email.phpMailer || {}),
      smtp: mergeProvider(d.email.smtp, email.smtp || {}),
      sendGrid: mergeProvider(d.email.sendGrid, email.sendGrid || {})
    },
    testRecipient: typeof x.testRecipient === "string" ? x.testRecipient : d.testRecipient,
    smsGateways: {
      nexmo: mergeProvider(d.smsGateways.nexmo, smsG.nexmo || {}),
      twilio: mergeProvider(d.smsGateways.twilio, smsG.twilio || {}),
      twoFactor: mergeProvider(d.smsGateways.twoFactor, smsG.twoFactor || {})
    },
    smsDelivery: {
      senderLabel:
        typeof smsDel.senderLabel === "string" ? smsDel.senderLabel : d.smsDelivery.senderLabel,
      notes: typeof smsDel.notes === "string" ? smsDel.notes : d.smsDelivery.notes
    },
    emailTemplates: normalizeTemplates(x.emailTemplates, EMAIL_TEMPLATE_DEFS, DEFAULT_EMAIL_BODY),
    smsTemplates: normalizeTemplates(x.smsTemplates, SMS_TEMPLATE_DEFS, DEFAULT_SMS_BODY),
    otp: {
      channel:
        otp.channel === "Email" || otp.channel === "email"
          ? "EMail"
          : ["SMS", "EMail"].includes(otp.channel)
            ? otp.channel
            : d.otp.channel,
      digits: ["4", "5", "6", "8"].includes(otp.digits) ? otp.digits : d.otp.digits,
      expire: ["5mins", "10mins", "15mins", "30mins"].includes(otp.expire)
        ? otp.expire
        : d.otp.expire
    },
    gdpr: {
      consentText:
        typeof gdpr.consentText === "string" ? gdpr.consentText : d.gdpr.consentText,
      position: ["left", "center", "right"].includes(gdpr.position)
        ? gdpr.position
        : d.gdpr.position,
      agreeText: typeof gdpr.agreeText === "string" ? gdpr.agreeText : d.gdpr.agreeText,
      declineText:
        typeof gdpr.declineText === "string" ? gdpr.declineText : d.gdpr.declineText,
      showDecline:
        typeof gdpr.showDecline === "boolean" ? gdpr.showDecline : d.gdpr.showDecline,
      policyLink:
        typeof gdpr.policyLink === "string" ? gdpr.policyLink : d.gdpr.policyLink
    }
  };
}

export function loadSystemSettings() {
  if (typeof window === "undefined") {
    return getDefaultSystemSettings();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultSystemSettings();
    }
    return normalizeSystemSettings(JSON.parse(raw));
  } catch {
    return getDefaultSystemSettings();
  }
}

/** @type {Array<(data: ReturnType<typeof getDefaultSystemSettings>) => void>} */
const afterSaveSystemSettings = [];

/** @param {(data: ReturnType<typeof getDefaultSystemSettings>) => void} fn */
export function addAfterSaveSystemSettingsListener(fn) {
  afterSaveSystemSettings.push(fn);
  return () => {
    const i = afterSaveSystemSettings.indexOf(fn);
    if (i >= 0) {
      afterSaveSystemSettings.splice(i, 1);
    }
  };
}

/** @param {unknown} raw */
export function replaceSystemSettingsFromServer(raw) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeSystemSettings(raw);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* quota */
  }
}

/** @param {ReturnType<typeof getDefaultSystemSettings>} data */
export function saveSystemSettings(data) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
  for (const fn of afterSaveSystemSettings) {
    try {
      fn(data);
    } catch {
      /* ignore */
    }
  }
}
