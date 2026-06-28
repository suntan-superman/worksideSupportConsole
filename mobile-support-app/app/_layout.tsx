import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { installNotificationDeepLinkHandler } from "@/services/deepLinks";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => installNotificationDeepLinkHandler(router), [router]);

  return (
    <AuthProvider>
      <PreferencesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PreferencesProvider>
    </AuthProvider>
  );
}
