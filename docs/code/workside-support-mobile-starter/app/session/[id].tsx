import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MessageBubble } from "@/components/MessageBubble";
import { usePolling } from "@/hooks/usePolling";
import { closeSupportSession, getSupportSessionDetail, replyToSupportSession, requestTransfer, SupportMessage, SupportSession, takeoverSupportSession } from "@/services/supportApi";

export default function SessionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");

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
    if (!id) return;
    await takeoverSupportSession(id);
    await loadDetail();
  }

  async function handleReply() {
    if (!id || !text.trim()) return;
    const message = text.trim();
    setText("");
    try {
      await replyToSupportSession(id, message);
      await loadDetail();
    } catch (error: any) {
      Alert.alert("Reply blocked", error?.message || "Unable to send reply.");
    }
  }

  async function handleClose() {
    if (!id) return;
    try {
      await closeSupportSession(id, "Closed from mobile support app.");
      router.back();
    } catch (error: any) {
      Alert.alert("Close blocked", error?.message || "Unable to close this session.");
    }
  }

  async function handleEscalate() {
    if (!id) return;
    await requestTransfer(id, "Escalated from mobile support app.");
    await loadDetail();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: "padding", android: undefined })}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>{session?.leadName || session?.visitorName || "Visitor"}</Text>
        <Text style={styles.subtitle}>{session?.product || "merxus"} · {session?.status || "loading"}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={handleTakeover}><Text style={styles.secondaryText}>Accept</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleEscalate}><Text style={styles.secondaryText}>Escalate</Text></Pressable>
        <Pressable style={styles.dangerButton} onPress={handleClose}><Text style={styles.dangerText}>Close</Text></Pressable>
      </View>

      <FlatList data={messages} keyExtractor={(item, index) => item.id || `${index}`} renderItem={({ item }) => <MessageBubble message={item} />} contentContainerStyle={styles.messages} />

      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Type a reply..." style={styles.input} multiline />
        <Pressable style={styles.sendButton} onPress={handleReply}><Text style={styles.sendText}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: 54 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  back: { color: "#2563eb", fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, padding: 12 },
  secondaryButton: { backgroundColor: "#e0ecff", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  secondaryText: { color: "#1d4ed8", fontWeight: "800" },
  dangerButton: { backgroundColor: "#fee2e2", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  dangerText: { color: "#b91c1c", fontWeight: "800" },
  messages: { padding: 16, gap: 10 },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "white" },
  input: { flex: 1, borderWidth: 1, borderColor: "#d0d5dd", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100 },
  sendButton: { backgroundColor: "#2563eb", borderRadius: 18, paddingHorizontal: 16, justifyContent: "center" },
  sendText: { color: "white", fontWeight: "800" }
});
