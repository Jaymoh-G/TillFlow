/* global self */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }
  const title = data.title || "TillFlow";
  const url = data.url || "/tillflow/admin/notifications";
  const options = {
    body: data.body || "",
    data: { url },
    icon: "/favicon.ico"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : "/tillflow/admin";
  const abs = new URL(raw, self.location.origin).href;
  event.waitUntil(self.clients.openWindow(abs));
});
