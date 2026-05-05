import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";
import { useAvailabilityHeartbeat } from "@/hooks/useAvailabilityHeartbeat";
import { AvailabilityStatus, getMyAvailability, updateMyAvailability } from "@/services/supportApi";

export function AvailabilityToggle() {
  const { darkMode } = usePreferences();
  const [status, setStatus] = useState<AvailabilityStatus>("offline");
  const [effective, setEffective] = useState<string>("offline");
  const [busy, setBusy] = useState(false);

  const heartbeatEnabled = status === "available";
  useAvailabilityHeartbeat(heartbeatEnabled);
  const statusLabel = formatAvailability(status);
  const effectiveLabel = formatAvailability(effective);
  const availabilityLabel =
    statusLabel.toLowerCase() === effectiveLabel.toLowerCase() ? statusLabel : `${statusLabel} · ${effectiveLabel}`;

  useEffect(() => {
    getMyAvailability()
      .then((res) => {
        const nextStatus = (res.availability?.status || "offline") as AvailabilityStatus;
        setStatus(nextStatus);
        setEffective(res.availability?.effectiveStatus || nextStatus);
      })
      .catch(() => {});
  }, []);

  async function toggle() {
    if (busy) return;
    const next = status === "available" ? "away" : "available";
    const previous = status;
    setBusy(true);
    setStatus(next);
    setEffective(next);
    try {
      await updateMyAvailability(next);
    } catch (error: any) {
      setStatus(previous);
      setEffective(previous);
      Alert.alert("Availability not updated", error?.message || "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <View>
        <Text style={[styles.label, darkMode && styles.mutedDark]}>Availability</Text>
        <Text style={[styles.status, darkMode && styles.textDark]}>{availabilityLabel}</Text>
      </View>
      <Pressable style={[styles.toggle, status === "available" ? styles.on : styles.off, busy && styles.disabled]} onPress={toggle} disabled={busy}>
        <Text style={styles.toggleText}>{status === "available" ? "Available" : "Go Available"}</Text>
      </Pressable>
    </View>
  );
}

function formatAvailability(value?: string) {
  const normalized = String(value || "offline").trim().replace(/_/g, " ");
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", padding: 16, borderRadius: 18, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDark: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
  label: { color: "#64748b", fontWeight: "700" },
  mutedDark: { color: "#94a3b8" },
  status: { color: "#0f172a", fontWeight: "800", textTransform: "capitalize", marginTop: 4 },
  textDark: { color: "#e5edf8" },
  toggle: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  on: { backgroundColor: "#16a34a" },
  off: { backgroundColor: "#2563eb" },
  disabled: { opacity: 0.55 },
  toggleText: { color: "white", fontWeight: "800" }
});
