import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

const REMEMBER_EMAIL_KEY = "support_mobile_remember_email";
const REMEMBER_ENABLED_KEY = "support_mobile_remember_enabled";

export default function LoginScreen() {
  const router = useRouter();
  const { requestOtp, signIn, verifyOtp } = useAuth();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([REMEMBER_EMAIL_KEY, REMEMBER_ENABLED_KEY]).then((items) => {
      const values = Object.fromEntries(items);
      const enabled = values[REMEMBER_ENABLED_KEY] !== "false";
      setRememberMe(enabled);
      if (enabled && values[REMEMBER_EMAIL_KEY]) {
        setEmail(values[REMEMBER_EMAIL_KEY]);
      }
    });
  }, []);

  async function handleLogin() {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "otp") {
        await verifyOtp(email.trim(), otpCode.trim());
      } else {
        await signIn(email.trim(), password);
      }
      if (rememberMe) {
        await AsyncStorage.multiSet([
          [REMEMBER_ENABLED_KEY, "true"],
          [REMEMBER_EMAIL_KEY, email.trim()]
        ]);
      } else {
        await AsyncStorage.multiSet([[REMEMBER_ENABLED_KEY, "false"]]);
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      router.replace("/dashboard");
    } catch (error: any) {
      Alert.alert("Login failed", error?.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    if (busy) return;
    setBusy(true);
    try {
      await requestOtp(email.trim());
      setOtpSent(true);
      Alert.alert("Code sent", "Check your email for the support login code.");
    } catch (error: any) {
      Alert.alert("Unable to send code", error?.message || "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: "padding", android: "height" })}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
        <Text style={styles.title}>Workside Support</Text>
        <Text style={styles.subtitle}>Sign in to manage live support requests.</Text>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, mode === "password" && styles.activeTab]} onPress={() => setMode("password")}>
            <Text style={[styles.tabText, mode === "password" && styles.activeTabText]}>Password</Text>
          </Pressable>
          <Pressable style={[styles.tab, mode === "otp" && styles.activeTab]} onPress={() => setMode("otp")}>
            <Text style={[styles.tabText, mode === "otp" && styles.activeTabText]}>Email code</Text>
          </Pressable>
        </View>

        <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        {mode === "otp" ? (
          <>
            <Pressable style={styles.secondaryButton} onPress={handleSendOtp} disabled={busy || !email.trim()}>
              <Text style={styles.secondaryButtonText}>{otpSent ? "Send another code" : "Send login code"}</Text>
            </Pressable>
            <TextInput style={styles.input} placeholder="6-digit code" keyboardType="number-pad" value={otpCode} onChangeText={setOtpCode} />
          </>
        ) : (
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        )}

        <Pressable style={styles.checkboxRow} onPress={() => setRememberMe((value) => !value)}>
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe ? <Text style={styles.checkmark}>x</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>Remember my email on this device</Text>
        </Pressable>

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={handleLogin} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? "Signing in..." : "Sign In"}</Text>
        </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef4ff" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: "#123" },
  subtitle: { color: "#667085", marginBottom: 8 },
  tabs: { flexDirection: "row", gap: 8, backgroundColor: "#f1f5f9", borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: "center", borderRadius: 11, paddingVertical: 10 },
  activeTab: { backgroundColor: "white" },
  tabText: { color: "#64748b", fontWeight: "800" },
  activeTabText: { color: "#0f172a" },
  input: { borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 14, padding: 14 },
  secondaryButton: { borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", borderRadius: 14, padding: 14, alignItems: "center" },
  secondaryButtonText: { color: "#1d4ed8", fontWeight: "800" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: "#94a3b8", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  checkmark: { color: "white", fontWeight: "900" },
  checkboxLabel: { color: "#475569", fontWeight: "700" },
  button: { backgroundColor: "#2563eb", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 6 },
  disabled: { opacity: 0.55 },
  buttonText: { color: "white", fontWeight: "700" }
});
