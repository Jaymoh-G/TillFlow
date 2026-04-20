const PREFIX = "tillflow_notif_last_seen_v1";

/** @param {string|number|null|undefined} userId */
function storageKey(userId) {
  const id = userId != null && String(userId).trim() !== "" ? String(userId) : "local";
  return `${PREFIX}:${id}`;
}

/**
 * @param {string|number|null|undefined} userId
 * @returns {string|null} ISO timestamp — entries at or before this are treated as seen
 */
export function getNotificationsLastSeenIso(userId) {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/**
 * @param {string|number|null|undefined} userId
 * @param {string} iso
 */
export function setNotificationsLastSeenIso(userId, iso) {
  try {
    localStorage.setItem(storageKey(userId), iso);
  } catch {
    /* ignore */
  }
}

/**
 * Move the "seen" cursor forward to now and any timestamps in `rows`, without moving backward.
 * Call when the user opens the bell dropdown or views the notifications page.
 *
 * @param {string|number|null|undefined} userId
 * @param {{ created_at?: string|null }[]} [rows]
 */
export function advanceNotificationsLastSeen(userId, rows) {
  let maxT = 0;
  const prev = getNotificationsLastSeenIso(userId);
  if (prev) {
    const t = new Date(prev).getTime();
    if (!Number.isNaN(t)) {
      maxT = t;
    }
  }
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (r?.created_at) {
        const t = new Date(String(r.created_at)).getTime();
        if (!Number.isNaN(t)) {
          maxT = Math.max(maxT, t);
        }
      }
    }
  }
  maxT = Math.max(maxT, Date.now());
  setNotificationsLastSeenIso(userId, new Date(maxT).toISOString());
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("tillflow-notifications-seen", { detail: { userId } })
    );
  }
}

/**
 * @param {object[]} logs activity_logs rows (any order)
 * @param {string|number|null|undefined} userId
 * @returns {number}
 */
export function countUnreadNotificationLogs(logs, userId) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return 0;
  }
  const seenIso = getNotificationsLastSeenIso(userId);
  if (!seenIso) {
    return logs.length;
  }
  const seenTime = new Date(seenIso).getTime();
  if (Number.isNaN(seenTime)) {
    return logs.length;
  }
  return logs.filter((log) => {
    if (!log?.created_at) {
      return true;
    }
    const t = new Date(String(log.created_at)).getTime();
    if (Number.isNaN(t)) {
      return true;
    }
    return t > seenTime;
  }).length;
}
