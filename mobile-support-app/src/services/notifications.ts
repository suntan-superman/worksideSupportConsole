import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const result = await Notifications.requestPermissionsAsync();
    finalStatus = result.status;
  }

  if (finalStatus !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function notifyTransferWaiting({ visitorName, product }: { visitorName?: string; product?: string }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Support transfer waiting",
      body: `${visitorName || "A visitor"} is waiting for human support${product ? ` in ${product}` : ""}.`,
      sound: true
    },
    trigger: null
  });
}
