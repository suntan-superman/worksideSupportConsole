import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "@/context/PreferencesContext";

type ConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onCancel,
  onConfirm
}: ConfirmSheetProps) {
  const { darkMode } = usePreferences();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View style={[styles.sheet, darkMode && styles.sheetDark]}>
          <Text style={[styles.title, darkMode && styles.textDark]}>{title}</Text>
          <Text style={[styles.message, darkMode && styles.messageDark]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton, darkMode && styles.cancelButtonDark]} onPress={onCancel} disabled={busy}>
              <Text style={[styles.cancelText, darkMode && styles.textDark]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, tone === "danger" ? styles.dangerButton : styles.confirmButton, busy && styles.disabled]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={styles.confirmText}>{busy ? "Working..." : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    padding: 16
  },
  sheet: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10
  },
  sheetDark: { backgroundColor: "#1e293b", borderColor: "#334155" },
  title: { color: "#0f172a", fontSize: 20, fontWeight: "900" },
  textDark: { color: "#e5edf8" },
  message: { color: "#475569", lineHeight: 21 },
  messageDark: { color: "#cbd5e1" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  button: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  cancelButton: { backgroundColor: "#f1f5f9" },
  cancelButtonDark: { backgroundColor: "#334155" },
  confirmButton: { backgroundColor: "#2563eb" },
  dangerButton: { backgroundColor: "#dc2626" },
  disabled: { opacity: 0.6 },
  cancelText: { color: "#0f172a", fontWeight: "900" },
  confirmText: { color: "white", fontWeight: "900" }
});
