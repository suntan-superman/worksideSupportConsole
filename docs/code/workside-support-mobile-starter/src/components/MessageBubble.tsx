import { StyleSheet, Text, View } from "react-native";
import { SupportMessage } from "@/services/supportApi";

export function MessageBubble({ message }: { message: SupportMessage }) {
  const role = message.role || message.sender || "visitor";
  const isAgent = role === "agent" || role === "support";
  const text = message.text || message.message || "";

  return (
    <View style={[styles.bubble, isAgent ? styles.agent : styles.visitor]}>
      <Text style={[styles.text, isAgent ? styles.agentText : styles.visitorText]}>
        {text || "(empty message)"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "82%", padding: 12, borderRadius: 18, marginBottom: 8 },
  agent: { alignSelf: "flex-end", backgroundColor: "#2563eb" },
  visitor: { alignSelf: "flex-start", backgroundColor: "white", borderWidth: 1, borderColor: "#e2e8f0" },
  text: { fontSize: 15, lineHeight: 20 },
  agentText: { color: "white" },
  visitorText: { color: "#0f172a" }
});
