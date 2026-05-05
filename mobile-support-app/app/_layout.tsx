import { Stack } from "expo-router";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PreferencesProvider>
    </AuthProvider>
  );
}
