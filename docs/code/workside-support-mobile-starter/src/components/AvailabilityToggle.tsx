import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAvailabilityHeartbeat } from "@/hooks/useAvailabilityHeartbeat";
import { getMyAvailability, updateMyAvailability } from "@/services/supportApi";

export function AvailabilityToggle() {
  const [status, setStatus] = useState<"available" | "away" | "busy" | "offline">("offline");
  const [effective, setEffective] = useState<string>("offline");

  const heartbeatEnabled = status === "available";
  useAvailabilityHeartbeat(heartbeatEnabled);

  useEffect(() => {
    getMyAvailability()
      .then((res) => {
        const nextStatus = (res.availability?.status || "offline") as any;
        setStatus(nextStatus);
        setEffective(res.availability?.effectiveStatus || nextStatus);
      })
      .catch(() => {});
  }, []);

  async function toggle() {
    const next = status === "available" ? "away" : "available";
    setStatus(next);
    setEffective(next);
    await updateMyAvailability(next);
  }

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Availability</Text>
        <Text style={styles.status}>{status} · {effective}</Text>
      </View>
      <Pressable style={[styles.toggle, status === "available" ? styles.on : styles.off]} onPress={toggle}>
        <Text style={styles.toggleText}>{status === "available" ? "Available" : "Go Available"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", padding: 16, borderRadius: 18, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#64748b", fontWeight: "700" },
  status: { color: "#0f172a", fontWeight: "800", textTransform: "capitalize", marginTop: 4 },
  toggle: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  on: { backgroundColor: "#16a34a" },
  off: { backgroundColor: "#2563eb" },
  toggleText: { color: "white", fontWeight: "800" }
});
