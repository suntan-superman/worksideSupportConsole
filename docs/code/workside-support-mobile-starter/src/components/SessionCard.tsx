import { Pressable, StyleSheet, Text, View } from "react-native";
import { SupportSession } from "@/services/supportApi";

export function SessionCard({ session, onPress }: { session: SupportSession; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.name}>{session.leadName || session.visitorName || "Visitor"}</Text>
        <Text style={styles.status}>{session.status || "active"}</Text>
      </View>
      <Text style={styles.meta}>
        {(session.product || "merxus").replace("_", " ")}
        {session.routingStatus ? ` · ${session.routingStatus}` : ""}
      </Text>
      <Text style={styles.preview} numberOfLines={2}>{session.lastMessagePreview || "No preview available."}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: "#0f172a" },
  status: { color: "#2563eb", fontWeight: "800", textTransform: "capitalize" },
  meta: { color: "#64748b", marginTop: 6, textTransform: "capitalize" },
  preview: { color: "#334155", marginTop: 8 }
});
