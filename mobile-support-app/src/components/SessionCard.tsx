import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";
import { formatStatus, isHumanActive, isWaitingForTakeover, productLabel, SupportSession } from "@/services/supportApi";

export function SessionCard({ session, onPress }: { session: SupportSession; onPress: () => void }) {
  const { darkMode } = usePreferences();
  const waiting = isWaitingForTakeover(session);
  const humanActive = isHumanActive(session);
  const assigned = session.ownerName || session.assignedTo || "Unassigned";
  const name = session.leadName || session.visitorName || session.leadEmail || "Visitor";
  const sessionDate = formatDateTime(session.startedAt || session.createdAt || session.updatedAt || session.lastInteractionAt);
  const lastInteractionTime = formatTime(session.lastInteractionAt || session.updatedAt || session.startedAt || session.createdAt);
  const preview = cleanPreview(session.lastMessagePreview);

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
      {sessionDate ? <Text style={[styles.date, darkMode && styles.mutedDark]}>{sessionDate}</Text> : null}
      <View style={styles.detailRow}>
        <Text style={[styles.assignment, darkMode && styles.textDark]} numberOfLines={1}>{assigned}</Text>
        {session.leadEmail ? <Text style={[styles.email, darkMode && styles.mutedDark]} numberOfLines={1}>{session.leadEmail}</Text> : null}
      </View>
      {session.routingStatus || session.availabilityOutcome ? (
        <Text style={[styles.routing, darkMode && styles.mutedDark]} numberOfLines={1}>
          {[session.routingStatus, session.availabilityOutcome].filter(Boolean).map(formatStatus).join(" · ")}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        {preview ? <Text style={[styles.preview, darkMode && styles.previewDark]} numberOfLines={2}>{preview}</Text> : <View style={styles.previewSpacer} />}
        {lastInteractionTime ? <Text style={[styles.time, darkMode && styles.mutedDark]}>{lastInteractionTime}</Text> : null}
      </View>
    </Pressable>
  );
}

function cleanPreview(value?: string) {
  const preview = String(value || "").trim();
  return preview && preview !== "No preview available." ? preview : "";
}

function formatDateTime(value?: string) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatTime(value?: string) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  date: { color: "#64748b", marginTop: 3, fontSize: 12, fontWeight: "700" },
  detailRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 6 },
  assignment: { color: "#475569", fontWeight: "800", flexShrink: 0 },
  email: { color: "#64748b", flex: 1, textAlign: "right" },
  routing: { color: "#64748b", marginTop: 6, fontSize: 12 },
  footerRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 },
  preview: { color: "#334155", flex: 1 },
  previewSpacer: { flex: 1 },
  previewDark: { color: "#cbd5e1" },
  time: { color: "#64748b", fontSize: 12, fontWeight: "800" }
});
