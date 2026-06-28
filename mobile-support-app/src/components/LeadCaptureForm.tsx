import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";

export type LeadCaptureValue = {
  name: string;
  email: string;
  phone: string;
  company: string;
};

export function LeadCaptureForm({
  value,
  busy,
  onSave
}: {
  value: LeadCaptureValue;
  busy?: boolean;
  onSave: (value: LeadCaptureValue) => Promise<void>;
}) {
  const { darkMode } = usePreferences();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value.email, value.name, value.phone, value.company]);

  async function submit() {
    if (busy) return;
    await onSave(draft);
  }

  return (
    <View style={[styles.panel, darkMode && styles.panelDark]}>
      <Text style={[styles.title, darkMode && styles.textDark]}>Lead</Text>
      <TextInput style={[styles.input, darkMode && styles.inputDark]} value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="Name" placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"} />
      <TextInput style={[styles.input, darkMode && styles.inputDark]} value={draft.email} onChangeText={(email) => setDraft((current) => ({ ...current, email }))} placeholder="Email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"} />
      <TextInput style={[styles.input, darkMode && styles.inputDark]} value={draft.phone} onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"} />
      <TextInput style={[styles.input, darkMode && styles.inputDark]} value={draft.company} onChangeText={(company) => setDraft((current) => ({ ...current, company }))} placeholder="Company" placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"} />
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>Save Lead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 12, gap: 8 },
  panelDark: { backgroundColor: "#1e293b", borderTopColor: "#334155" },
  title: { color: "#0f172a", fontWeight: "900" },
  textDark: { color: "#e5edf8" },
  input: { borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  inputDark: { backgroundColor: "#0f172a", borderColor: "#334155", color: "#e5edf8" },
  button: { alignSelf: "flex-start", backgroundColor: "#0f766e", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: "white", fontWeight: "900" }
});
