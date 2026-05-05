import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";
import { formatStatus, isHumanActive, isWaitingForTakeover, productLabel, SupportSession } from "@/services/supportApi";

export function SessionCard({ session, onPress }: { session: SupportSession; onPress: () => void }) {
  const { darkMode } = usePreferences();
  const waiting = isWaitingForTakeover(session);
  const humanActive = isHumanActive(session);
  const assigned = session.ownerName || session.assignedTo || "Unassigned";
  const name = session.leadName || session.visitorName || session.leadEmail || "Visitor";

  return (
    <Pressable style={[styles.card, darkMode && styles.cardDark, waiting && styles.waitingCard]} onPress={onPress}>
      <View style={styles.row}>
        <Text style={[styles.name, darkMode && styles.textDark]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.status, waiting && styles.waitingStatus, humanActive && styles.humanStatus]}>
          {waiting ? "Waiting" : formatStatus(session.status)}
        </Text>
      </View>
      <Text style={[styles.meta, darkMode && styles.mutedDark]}>
        {productLabel(session.product)}
        {session.urgency ? ` · ${formatStatus(session.urgency)} urgency` : ""}
      </Text>
      <View style={styles.detailRow}>
        <Text style={[styles.assignment, darkMode && styles.textDark]} numberOfLines={1}>{assigned}</Text>
        {session.leadEmail ? <Text style={[styles.email, darkMode && styles.mutedDark]} numberOfLines={1}>{session.leadEmail}</Text> : null}
      </View>
      {session.routingStatus || session.availabilityOutcome ? (
        <Text style={[styles.routing, darkMode && styles.mutedDark]} numberOfLines={1}>
          {[session.routingStatus, session.availabilityOutcome].filter(Boolean).map(formatStatus).join(" · ")}
        </Text>
      ) : null}
      <Text style={[styles.preview, darkMode && styles.previewDark]} numberOfLines={2}>{session.lastMessagePreview || "No preview available."}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  cardDark: { backgroundColor: "#1e293b", borderColor: "#334155" },
  waitingCard: { borderColor: "#2563eb", borderLeftWidth: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: "#0f172a" },
  textDark: { color: "#e5edf8" },
  mutedDark: { color: "#94a3b8" },
  status: { color: "#2563eb", fontWeight: "800", textTransform: "capitalize" },
  waitingStatus: { color: "#b45309" },
  humanStatus: { color: "#0f766e" },
  meta: { color: "#64748b", marginTop: 6, textTransform: "capitalize" },
  detailRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 6 },
  assignment: { color: "#475569", fontWeight: "800", flexShrink: 0 },
  email: { color: "#64748b", flex: 1, textAlign: "right" },
  routing: { color: "#64748b", marginTop: 6, fontSize: 12 },
  preview: { color: "#334155", marginTop: 8 },
  previewDark: { color: "#cbd5e1" }
});
