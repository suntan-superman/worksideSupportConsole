import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AvailabilityToggle } from "@/components/AvailabilityToggle";
import { SessionCard } from "@/components/SessionCard";
import { useAuth } from "@/context/AuthContext";
import { usePolling } from "@/hooks/usePolling";
import { getSupportSessions, SupportSession } from "@/services/supportApi";

export default function DashboardScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSessions() {
    const result = await getSupportSessions({ product: "merxus" });
    setSessions(result.sessions || []);
    setLoading(false);
  }

  useEffect(() => {
    loadSessions().catch(() => setLoading(false));
  }, []);

  usePolling(loadSessions, 5000);

  const activeCount = useMemo(() => sessions.filter((s) => s.status !== "closed").length, [sessions]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Support Queue</Text>
          <Text style={styles.subtitle}>{activeCount} active conversations</Text>
        </View>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <AvailabilityToggle />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadSessions} />}
          renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
          ListEmptyComponent={<Text style={styles.empty}>No support sessions match the current filters.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 2 },
  signOut: { color: "#2563eb", fontWeight: "700" },
  empty: { textAlign: "center", color: "#64748b", marginTop: 48 }
});
