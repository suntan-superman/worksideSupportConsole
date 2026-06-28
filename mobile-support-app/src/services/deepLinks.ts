import * as Notifications from "expo-notifications";
import { Router } from "expo-router";

function sessionIdFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data || {};
  const value = data.sessionId || data.session_id || data.supportSessionId;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function installNotificationDeepLinkHandler(router: Router) {
  const openFromResponse = (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return;
    const sessionId = sessionIdFromNotification(response);
    if (sessionId) {
      router.push(`/session/${encodeURIComponent(sessionId)}`);
    }
  };

  Notifications.getLastNotificationResponseAsync()
    .then(openFromResponse)
    .catch(() => {});

  const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
  return () => subscription.remove();
}
