import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";

export default function SettingsScreen() {
  const router = useRouter();
  const { authEmail, deleteAccount, signOut, user } = useAuth();
  const { darkMode, notificationsEnabled, setDarkMode, setNotificationsEnabled } = usePreferences();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const email = user?.email || authEmail || "Unknown";
  const displayName = user?.displayName || (email !== "Unknown" ? email.split("@")[0] : "Support user");

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setConfirmSignOut(false);
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setBusy(true);
    try {
      await deleteAccount();
      setConfirmDelete(false);
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Unable to delete account", error?.message || "Sign in again and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={[styles.container, darkMode && styles.containerDark]} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.title, darkMode && styles.textDark]}>Settings</Text>

      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Current user</Text>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Name</Text>
        <Text style={[styles.value, darkMode && styles.textDark]}>{displayName}</Text>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Email</Text>
        <Text style={[styles.value, darkMode && styles.textDark]}>{email}</Text>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>User ID</Text>
        <Text style={[styles.value, darkMode && styles.textDark]}>{user?.uid || "Token sign-in"}</Text>
      </View>

      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Preferences</Text>
        <View style={styles.row}>
          <View>
            <Text style={[styles.value, darkMode && styles.textDark]}>Notifications</Text>
            <Text style={[styles.help, darkMode && styles.mutedDark]}>Local alerts while the app is open.</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={[styles.value, darkMode && styles.textDark]}>Dark mode</Text>
            <Text style={[styles.help, darkMode && styles.mutedDark]}>Use darker mobile screens.</Text>
          </View>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
      </View>

      <View style={[styles.card, darkMode && styles.cardDark]}>
        <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>Account</Text>
        <Pressable style={styles.signOutButton} onPress={() => setConfirmSignOut(true)}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={() => setConfirmDelete(true)}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </View>
      <ConfirmSheet
        visible={confirmSignOut}
        title="Sign out?"
        message="You will stop receiving support queue updates on this device until you sign back in."
        confirmLabel="Sign out"
        busy={busy}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={handleSignOut}
      />
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete account?"
        message="This cannot be undone. Your account will be removed from Firebase for this sign-in flow, and an administrator may still need to disable any backend support access."
        confirmLabel="Delete account"
        tone="danger"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteAccount}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  containerDark: { backgroundColor: "#0f172a" },
  content: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 48, gap: 14 },
  back: { color: "#2563eb", fontWeight: "800", marginBottom: 4 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "900", marginBottom: 4 },
  textDark: { color: "#e5edf8" },
  mutedDark: { color: "#94a3b8" },
  card: { backgroundColor: "white", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  cardDark: { backgroundColor: "#1e293b", borderColor: "#334155" },
  sectionTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900" },
  label: { color: "#64748b", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  value: { color: "#0f172a", fontWeight: "800" },
  help: { color: "#64748b", marginTop: 2, maxWidth: 230 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, paddingVertical: 8 },
  signOutButton: { borderRadius: 14, backgroundColor: "#eff6ff", padding: 14, alignItems: "center" },
  signOutText: { color: "#1d4ed8", fontWeight: "900" },
  deleteButton: { borderRadius: 14, backgroundColor: "#fee2e2", padding: 14, alignItems: "center" },
  deleteText: { color: "#b91c1c", fontWeight: "900" }
});
