import { StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";
import { SupportMessage } from "@/services/supportApi";

export function MessageBubble({ message }: { message: SupportMessage }) {
  const { darkMode } = usePreferences();
  const role = String(message.role || message.sender || "visitor").toLowerCase();
  const isAgent = role === "agent" || role === "support" || role === "human";
  const isSystem = role === "system";
  const text = message.text || message.message || message.content || "";

  return (
    <View style={[styles.bubble, isSystem ? styles.system : isAgent ? styles.agent : styles.visitor, darkMode && !isAgent && styles.darkBubble]}>
      <Text style={[styles.text, isAgent ? styles.agentText : styles.visitorText, darkMode && !isAgent && styles.darkText]}>
        {text || "(empty message)"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "82%", padding: 12, borderRadius: 18, marginBottom: 8 },
  agent: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  visitor: { alignSelf: "flex-start", backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0" },
  system: { alignSelf: "center", backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1" },
  text: { fontSize: 15, lineHeight: 20 },
  agentText: { color: "white" },
  visitorText: { color: "#0f172a" }
  ,
  darkBubble: { backgroundColor: "#1e293b", borderColor: "#334155" },
  darkText: { color: "#e5edf8" }
});
