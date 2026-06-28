import { request } from "./api";

export function normalizeNotificationReceipt(item = {}) {
  return {
    id: String(item.id ?? item._id ?? item.notificationId ?? ""),
    sessionId: String(item.sessionId ?? ""),
    product: String(item.product ?? item.productId ?? ""),
    channel: String(item.channel ?? item.type ?? "unknown"),
    provider: String(item.provider ?? ""),
    recipientLabel: String(item.recipientLabel ?? item.recipientName ?? item.recipient ?? ""),
    status: String(item.status ?? item.outcome ?? "unknown"),
    attemptedAt: String(item.attemptedAt ?? item.createdAt ?? item.timestamp ?? ""),
    deliveredAt: String(item.deliveredAt ?? item.sentAt ?? ""),
    muted: Boolean(item.muted ?? item.adminMuted ?? false),
    skippedReason: String(item.skippedReason ?? item.reason ?? ""),
    errorCode: String(item.errorCode ?? item.code ?? ""),
    errorMessage: String(item.errorMessage ?? item.error ?? ""),
    retryCount: Number(item.retryCount ?? 0),
  };
}

export async function listSessionNotificationReceipts(sessionId) {
  if (!sessionId) return [];
  const payload = await request(`/support/sessions/${encodeURIComponent(sessionId)}/notifications`, { method: "GET" });
  const items = payload?.items ?? payload?.receipts ?? payload?.notifications ?? payload?.data?.items ?? payload?.data ?? [];
  return Array.isArray(items) ? items.map(normalizeNotificationReceipt) : [];
}
