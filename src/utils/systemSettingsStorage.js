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

/** @returns {Record<string, unknown>} */
export function getDefaultAutomationSettings() {
  return {
    dueReminderDaysBefore: 3,
    overdueFirstNoticeDaysAfterDue: 1,
    overdueResendEveryDays: 7,
    runHourLocal: 8,
    timezone: "UTC",
    quoteExpiryReminderDaysBefore: 3,
    proposalExpiryReminderDaysBefore: 3,
    quoteDefaultValidDays: 30,
    proposalDefaultValidDays: 30,
    invoiceDefaultDueDays: 21,
    invoiceDueReminderChannels: { email: true, sms: false },
    invoiceOverdueChannels: { email: true, sms: false },
    quoteExpiryReminderChannels: { email: true, sms: false },
    proposalExpiryReminderChannels: { email: true, sms: false }
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof getDefaultAutomationSettings>}
 */
function normalizeAutomationSettings(raw) {
  const d = getDefaultAutomationSettings();
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const x = /** @type {Record<string, unknown>} */ (raw);
  const ch = (v, def) => {
    if (!v || typeof v !== "object") {
      return { ...def };
    }
    const o = /** @type {Record<string, unknown>} */ (v);
    return {
      email: typeof o.email === "boolean" ? o.email : def.email,
      sms: typeof o.sms === "boolean" ? o.sms : def.sms
    };
  };
  const tz = typeof x.timezone === "string" && x.timezone.trim() ? x.timezone.trim() : d.timezone;
  return {
    dueReminderDaysBefore:
      typeof x.dueReminderDaysBefore === "number" && Number.isFinite(x.dueReminderDaysBefore)
        ? Math.max(0, Math.min(365, Math.floor(x.dueReminderDaysBefore)))
        : d.dueReminderDaysBefore,
    overdueFirstNoticeDaysAfterDue:
      typeof x.overdueFirstNoticeDaysAfterDue === "number" &&
      Number.isFinite(x.overdueFirstNoticeDaysAfterDue)
        ? Math.max(0, Math.min(365, Math.floor(x.overdueFirstNoticeDaysAfterDue)))
        : d.overdueFirstNoticeDaysAfterDue,
    overdueResendEveryDays:
      typeof x.overdueResendEveryDays === "number" && Number.isFinite(x.overdueResendEveryDays)
        ? Math.max(0, Math.min(365, Math.floor(x.overdueResendEveryDays)))
        : d.overdueResendEveryDays,
    runHourLocal:
      typeof x.runHourLocal === "number" && Number.isFinite(x.runHourLocal)
        ? Math.max(0, Math.min(23, Math.floor(x.runHourLocal)))
        : d.runHourLocal,
    timezone: tz,
    quoteExpiryReminderDaysBefore:
      typeof x.quoteExpiryReminderDaysBefore === "number" &&
      Number.isFinite(x.quoteExpiryReminderDaysBefore)
        ? Math.max(0, Math.min(365, Math.floor(x.quoteExpiryReminderDaysBefore)))
        : d.quoteExpiryReminderDaysBefore,
    proposalExpiryReminderDaysBefore:
      typeof x.proposalExpiryReminderDaysBefore === "number" &&
      Number.isFinite(x.proposalExpiryReminderDaysBefore)
        ? Math.max(0, Math.min(365, Math.floor(x.proposalExpiryReminderDaysBefore)))
        : d.proposalExpiryReminderDaysBefore,
    quoteDefaultValidDays:
      typeof x.quoteDefaultValidDays === "number" && Number.isFinite(x.quoteDefaultValidDays)
        ? Math.max(1, Math.min(3650, Math.floor(x.quoteDefaultValidDays)))
        : d.quoteDefaultValidDays,
    proposalDefaultValidDays:
      typeof x.proposalDefaultValidDays === "number" && Number.isFinite(x.proposalDefaultValidDays)
        ? Math.max(1, Math.min(3650, Math.floor(x.proposalDefaultValidDays)))
        : d.proposalDefaultValidDays,
    invoiceDefaultDueDays:
      typeof x.invoiceDefaultDueDays === "number" && Number.isFinite(x.invoiceDefaultDueDays)
        ? Math.max(1, Math.min(3650, Math.floor(x.invoiceDefaultDueDays)))
        : d.invoiceDefaultDueDays,
    invoiceDueReminderChannels: ch(x.invoiceDueReminderChannels, d.invoiceDueReminderChannels),
    invoiceOverdueChannels: ch(x.invoiceOverdueChannels, d.invoiceOverdueChannels),
    quoteExpiryReminderChannels: ch(x.quoteExpiryReminderChannels, d.quoteExpiryReminderChannels),
    proposalExpiryReminderChannels: ch(
      x.proposalExpiryReminderChannels,
      d.proposalExpiryReminderChannels
    )
  };
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
    automation: getDefaultAutomationSettings(),
    smsGateways: {
      nexmo: { enabled: false, apiKey: "", apiSecret: "", senderId: "" },
      twilio: { enabled: false, accountSid: "", authToken: "", fromNumber: "" },
      twoFactor: { enabled: false, apiKey: "", senderId: "", partnerId: "" }
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
  const automation = normalizeAutomationSettings(x.automation);

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
    automation,
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
