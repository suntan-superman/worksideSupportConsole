import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { SessionCard } from "@/components/SessionCard";
import { useAuth } from "@/context/AuthContext";
import { QueueFilter, usePreferences } from "@/context/PreferencesContext";
import { usePolling } from "@/hooks/usePolling";
import { getSupportSessions, isHumanActive, isWaitingForTakeover, SupportSession } from "@/services/supportApi";
import { notifyTransferWaiting, registerForPushNotificationsAsync } from "@/services/notifications";

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting" },
  { value: "mine", label: "Mine" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" }
];

export default function DashboardScreen() {
  const router = useRouter();
  const { authEmail, signOut, user } = useAuth();
  const { darkMode, notificationsEnabled, queueFilter, setQueueFilter } = usePreferences();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const knownWaitingIdsRef = useRef<Set<string>>(new Set());

  async function loadSessions() {
    const result = await getSupportSessions({ product: "merxus" });
    const nextSessions = result.sessions || [];
    const waiting = nextSessions.filter(isWaitingForTakeover);
    const knownWaitingIds = knownWaitingIdsRef.current;
    const newWaiting = waiting.find((session) => !knownWaitingIds.has(session.id));
    if (notificationsEnabled && knownWaitingIds.size > 0 && newWaiting) {
      await notifyTransferWaiting({
        visitorName: newWaiting.leadName || newWaiting.visitorName || "A visitor",
        product: newWaiting.product || "Merxus AI"
      }).catch(() => {});
    }
    knownWaitingIdsRef.current = new Set(waiting.map((session) => session.id));
    setSessions(nextSessions);
    setLoading(false);
  }

  useEffect(() => {
    registerForPushNotificationsAsync().catch(() => {});
    loadSessions().catch(() => setLoading(false));
  }, []);

  usePolling(loadSessions, 5000);

  const activeCount = useMemo(() => sessions.filter((s) => s.status !== "closed").length, [sessions]);
  const waitingCount = useMemo(() => sessions.filter(isWaitingForTakeover).length, [sessions]);
  const currentUserKey = String(user?.email || authEmail || "").trim().toLowerCase();
  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (queueFilter === "all") return true;
        if (queueFilter === "closed") return session.status === "closed";
        if (queueFilter === "waiting") return isWaitingForTakeover(session);
        if (queueFilter === "active") return isHumanActive(session);
        if (queueFilter === "mine") {
          const owner = `${session.ownerName || ""} ${session.assignedTo || ""}`.toLowerCase();
          return Boolean(currentUserKey && owner.includes(currentUserKey));
        }
        return session.status !== "closed";
      }),
    [currentUserKey, queueFilter, sessions]
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await loadSessions();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, darkMode && styles.textDark]}>Support Queue</Text>
          <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>{activeCount} active · {waitingCount} waiting for takeover</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/settings")}>
            <Text style={styles.signOut}>Settings</Text>
          </Pressable>
          <Pressable onPress={signOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <AvailabilityToggle />

      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.value}
            style={[styles.filterChip, queueFilter === filter.value && styles.filterChipActive, darkMode && styles.filterChipDark]}
            onPress={() => setQueueFilter(filter.value)}
          >
            <Text style={[styles.filterText, queueFilter === filter.value && styles.filterTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={visibleSessions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
          ListEmptyComponent={<Text style={styles.empty}>No support sessions match the current filters.</Text>}
          contentContainerStyle={{ paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  containerDark: { backgroundColor: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerActions: { alignItems: "flex-end", gap: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  textDark: { color: "#e5edf8" },
  subtitle: { color: "#64748b", marginTop: 2 },
  mutedDark: { color: "#94a3b8" },
  signOut: { color: "#2563eb", fontWeight: "700" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: { borderWidth: 1, borderColor: "#dbe4ef", backgroundColor: "white", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipDark: { backgroundColor: "#1e293b", borderColor: "#334155" },
  filterChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  filterText: { color: "#475569", fontWeight: "800", fontSize: 12 },
  filterTextActive: { color: "white" },
  empty: { textAlign: "center", color: "#64748b", marginTop: 48 }
});
