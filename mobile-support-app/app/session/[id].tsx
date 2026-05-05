import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MessageBubble } from "@/components/MessageBubble";
import { useAuth } from "@/context/AuthContext";
import { usePreferences } from "@/context/PreferencesContext";
import { usePolling } from "@/hooks/usePolling";
import {
  closeSupportSession,
  getSupportSessionDetail,
  isHumanActive,
  isWaitingForTakeover,
  replyToSupportSession,
  requestTransfer,
  SupportMessage,
  SupportSession,
  takeoverSupportSession
} from "@/services/supportApi";

export default function SessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { darkMode } = usePreferences();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<SupportMessage>>(null);

  async function loadDetail() {
    if (!id) return;
    const detail = await getSupportSessionDetail(id);
    setSession(detail.session);
    setMessages(detail.messages || []);
  }

  useEffect(() => {
    loadDetail().catch(() => {});
  }, [id]);

  usePolling(loadDetail, 5000);

  async function handleTakeover() {
    if (!id || busy) return;
    setBusy(true);
    try {
      await takeoverSupportSession(id, session, user?.displayName || user?.email || "Mobile agent");
      await loadDetail();
    } catch (error: any) {
      Alert.alert("Accept transfer blocked", error?.message || "Unable to accept this transfer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReply() {
    if (!id || !text.trim() || busy) return;
    const message = text.trim();
    setText("");
    setBusy(true);
    try {
      await replyToSupportSession(id, message, session);
      await loadDetail();
    } catch (error: any) {
      Alert.alert("Reply blocked", error?.message || "Unable to send reply.");
      setText(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!id || busy) return;
    try {
      setBusy(true);
      await closeSupportSession(id, "Closed from mobile support app.", session);
      router.back();
    } catch (error: any) {
      Alert.alert("Close blocked", error?.message || "Unable to close this session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEscalate() {
    if (!id || busy) return;
    setBusy(true);
    try {
      await requestTransfer(id, "manual", session);
      await loadDetail();
    } catch (error: any) {
      Alert.alert("Escalation blocked", error?.message || "Unable to request transfer.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = isWaitingForTakeover(session);
  const humanActive = isHumanActive(session);
  const canReply = humanActive && session?.status !== "closed";

  return (
    <KeyboardAvoidingView style={[styles.container, darkMode && styles.containerDark]} behavior={Platform.select({ ios: "padding", android: "height" })}>
      <View style={[styles.header, darkMode && styles.headerDark]}>
        <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, darkMode && styles.textDark]}>{session?.leadName || session?.visitorName || "Visitor"}</Text>
        <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>{session?.product || "merxus"} · {session?.status || "loading"}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.secondaryButton, (!waiting || busy) && styles.disabled]} onPress={handleTakeover} disabled={!waiting || busy}>
          <Text style={styles.secondaryText}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, (waiting || humanActive || busy) && styles.disabled]} onPress={handleEscalate} disabled={waiting || humanActive || busy}>
          <Text style={styles.secondaryText}>Escalate</Text>
        </Pressable>
        <Pressable style={[styles.dangerButton, busy && styles.disabled]} onPress={handleClose} disabled={busy}>
          <Text style={styles.dangerText}>Close</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messages}
        ListEmptyComponent={<Text style={[styles.empty, darkMode && styles.mutedDark]}>No readable messages yet.</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[styles.composer, darkMode && styles.composerDark]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={canReply ? "Type a reply..." : "Accept transfer before replying"}
          style={[styles.input, darkMode && styles.inputDark]}
          placeholderTextColor={darkMode ? "#94a3b8" : "#64748b"}
          multiline
          editable={canReply && !busy}
        />
        <Pressable style={[styles.sendButton, (!canReply || busy || !text.trim()) && styles.disabled]} onPress={handleReply} disabled={!canReply || busy || !text.trim()}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 54 },
  containerDark: { backgroundColor: "#0f172a" },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerDark: { borderBottomColor: "#334155" },
  back: { color: "#2563eb", fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  textDark: { color: "#e5edf8" },
  subtitle: { color: "#64748b", marginTop: 2 },
  mutedDark: { color: "#94a3b8" },
  actions: { flexDirection: "row", gap: 8, padding: 12 },
  secondaryButton: { backgroundColor: "#e0ecff", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  secondaryText: { color: "#1d4ed8", fontWeight: "800" },
  dangerButton: { backgroundColor: "#fee2e2", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  dangerText: { color: "#b91c1c", fontWeight: "800" },
  disabled: { opacity: 0.45 },
  messages: { padding: 16, gap: 10, paddingBottom: 36 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 24 },
  composer: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "white" },
  composerDark: { backgroundColor: "#1e293b", borderTopColor: "#334155" },
  input: { flex: 1, borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  inputDark: { backgroundColor: "#0f172a", borderColor: "#334155", color: "#e5edf8" },
  sendButton: { backgroundColor: "#2563eb", borderRadius: 18, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "white", fontWeight: "800" }
});
