import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";

export function InternalNotes({
  notes,
  busy,
  onSave
}: {
  notes: string[];
  busy?: boolean;
  onSave: (note: string) => Promise<void>;
}) {
  const { darkMode } = usePreferences();
  const [note, setNote] = useState("");

  async function submit() {
    const trimmed = note.trim();
    if (!trimmed || busy) return;
    await onSave(trimmed);
    setNote("");
  }

  return (
    <View style={[styles.panel, darkMode && styles.panelDark]}>
      <Text style={[styles.title, darkMode && styles.textDark]}>Internal Notes</Text>
      {notes.length ? notes.map((item, index) => (
        <Text key={`${item}-${index}`} style={[styles.note, darkMode && styles.mutedDark]}>{item}</Text>
      )) : <Text style={[styles.empty, darkMode && styles.mutedDark]}>No internal notes yet.</Text>}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add internal note"
        placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"}
        style={[styles.input, darkMode && styles.inputDark]}
        multiline
      />
      <Pressable style={[styles.button, (busy || !note.trim()) && styles.disabled]} onPress={submit} disabled={busy || !note.trim()}>
        <Text style={styles.buttonText}>Save Note</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e2e8f0", padding: 12, gap: 8 },
  panelDark: { backgroundColor: "#1e293b", borderTopColor: "#334155" },
  title: { color: "#0f172a", fontWeight: "900" },
  textDark: { color: "#e5edf8" },
  mutedDark: { color: "#94a3b8" },
  note: { color: "#475569", fontWeight: "600" },
  empty: { color: "#64748b" },
  input: { borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, minHeight: 48 },
  inputDark: { backgroundColor: "#0f172a", borderColor: "#334155", color: "#e5edf8" },
  button: { alignSelf: "flex-start", backgroundColor: "#2563eb", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: "white", fontWeight: "900" }
});
