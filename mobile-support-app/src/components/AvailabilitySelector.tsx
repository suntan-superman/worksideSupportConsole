import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";
import { useAvailabilityHeartbeat } from "@/hooks/useAvailabilityHeartbeat";
import { AvailabilityStatus, getMyAvailability, updateMyAvailability } from "@/services/supportApi";

const OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "away", label: "Away" },
  { value: "offline", label: "Offline" },
  { value: "do_not_disturb", label: "DND" }
];

export function AvailabilitySelector() {
  const { darkMode } = usePreferences();
  const [status, setStatus] = useState<AvailabilityStatus>("offline");
  const [effective, setEffective] = useState<string>("offline");
  const [busy, setBusy] = useState(false);

  useAvailabilityHeartbeat(status === "available");

  useEffect(() => {
    getMyAvailability()
      .then((res) => {
        const nextStatus = (res.availability?.status || "offline") as AvailabilityStatus;
        setStatus(nextStatus);
        setEffective(res.availability?.effectiveStatus || nextStatus);
      })
      .catch(() => {});
  }, []);

  async function select(next: AvailabilityStatus) {
    if (busy || next === status) return;
    const previous = status;
    const previousEffective = effective;
    setBusy(true);
    setStatus(next);
    setEffective(next);
    try {
      await updateMyAvailability(next);
    } catch (error: any) {
      setStatus(previous);
      setEffective(previousEffective);
      Alert.alert("Availability not updated", error?.message || "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, darkMode && styles.cardDark]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.label, darkMode && styles.mutedDark]}>Availability</Text>
          <Text style={[styles.status, darkMode && styles.textDark]}>
            {formatAvailability(status)}
            {effective && effective !== status ? ` · ${formatAvailability(effective)}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.option, status === option.value && styles.optionActive, busy && styles.disabled]}
            onPress={() => select(option.value)}
            disabled={busy}
          >
            <Text style={[styles.optionText, status === option.value && styles.optionTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function formatAvailability(value?: string) {
  return String(value || "offline")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", padding: 16, borderRadius: 18, marginBottom: 14 },
  cardDark: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  label: { color: "#64748b", fontWeight: "700" },
  mutedDark: { color: "#94a3b8" },
  status: { color: "#0f172a", fontWeight: "800", textTransform: "capitalize", marginTop: 4 },
  textDark: { color: "#e5edf8" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  optionActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  optionText: { color: "#1d4ed8", fontWeight: "800", fontSize: 12 },
  optionTextActive: { color: "white" },
  disabled: { opacity: 0.55 }
});
