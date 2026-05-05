import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (error: any) {
      Alert.alert("Login failed", error?.message || "Unable to sign in.");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: "padding", android: undefined })}>
      <View style={styles.card}>
        <Text style={styles.title}>Workside Support</Text>
        <Text style={styles.subtitle}>Sign in to manage live support requests.</Text>

        <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

        <Pressable style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Sign In</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#eef4ff" },
  card: { backgroundColor: "white", borderRadius: 24, padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: "#123" },
  subtitle: { color: "#667085", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 14, padding: 14 },
  button: { backgroundColor: "#2563eb", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 6 },
  buttonText: { color: "white", fontWeight: "700" }
});
