import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";

export type InquiryCaptureValue = {
  messageSummary: string;
  urgency: string;
  intent: string;
};

const URGENCIES = ["low", "medium", "high"];
const INTENTS = ["general", "sales", "support", "billing", "booking"];

export function InquiryCaptureForm({
  value,
  busy,
  onSave
}: {
  value: InquiryCaptureValue;
  busy?: boolean;
  onSave: (value: InquiryCaptureValue) => Promise<void>;
}) {
  const { darkMode } = usePreferences();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value.messageSummary, value.urgency, value.intent]);

  async function submit() {
    if (busy) return;
    await onSave(draft);
  }

  return (
    <View style={[styles.panel, darkMode && styles.panelDark]}>
      <Text style={[styles.title, darkMode && styles.textDark]}>Inquiry</Text>
      <TextInput
        style={[styles.input, styles.summaryInput, darkMode && styles.inputDark]}
        value={draft.messageSummary}
        onChangeText={(messageSummary) => setDraft((current) => ({ ...current, messageSummary }))}
        placeholder="Inquiry summary"
        placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"}
        multiline
      />
      <View style={styles.chips}>
        {URGENCIES.map((urgency) => (
          <Pressable key={urgency} style={[styles.chip, draft.urgency === urgency && styles.chipActive]} onPress={() => setDraft((current) => ({ ...current, urgency }))}>
            <Text style={[styles.chipText, draft.urgency === urgency && styles.chipTextActive]}>{urgency}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chips}>
        {INTENTS.map((intent) => (
          <Pressable key={intent} style={[styles.chip, draft.intent === intent && styles.intentActive]} onPress={() => setDraft((current) => ({ ...current, intent }))}>
            <Text style={[styles.chipText, draft.intent === intent && styles.chipTextActive]}>{intent}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>Save Inquiry</Text>
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
  summaryInput: { minHeight: 60 },
  inputDark: { backgroundColor: "#0f172a", borderColor: "#334155", color: "#e5edf8" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#dbe4ef", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: "#b45309", borderColor: "#b45309" },
  intentActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#475569", fontWeight: "800", textTransform: "capitalize" },
  chipTextActive: { color: "white" },
  button: { alignSelf: "flex-start", backgroundColor: "#2563eb", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: "white", fontWeight: "900" }
});
