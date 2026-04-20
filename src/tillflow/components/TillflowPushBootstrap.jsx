import { useEffect } from "react";
import {
  addAfterSaveNotificationPreferencesListener,
  loadNotificationPreferences
} from "../../utils/notificationPreferencesStorage";
import { useAuth } from "../auth/AuthContext";
import { registerTillflowWebPush, unregisterTillflowWebPush } from "../push/webPush";

/**
 * Subscribes or unsubscribes Web Push based on notification preferences and auth.
 */
export default function TillflowPushBootstrap() {
  const { token, user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!token || userId == null) {
      return undefined;
    }
    const prefs = loadNotificationPreferences(userId);
    if (prefs.channelBrowser) {
      void registerTillflowWebPush(token);
    }
    return undefined;
  }, [token, userId]);

  useEffect(() => {
    if (!token || userId == null) {
      return undefined;
    }
    const unsub = addAfterSaveNotificationPreferencesListener((uid, prefs) => {
      if (String(uid) !== String(userId)) {
        return;
      }
      if (prefs.channelBrowser) {
        void registerTillflowWebPush(token);
      } else {
        void unregisterTillflowWebPush(token);
      }
    });
    return unsub;
  }, [token, userId]);

  return null;
}
