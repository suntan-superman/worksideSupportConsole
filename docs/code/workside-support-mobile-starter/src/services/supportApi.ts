import { apiRequest } from "@/services/apiClient";

export type SupportSession = {
  id: string;
  sessionId?: string;
  product?: string;
  tenantId?: string;
  status?: string;
  routingStatus?: string;
  availabilityOutcome?: string;
  leadName?: string;
  visitorName?: string;
  leadEmail?: string;
  leadCaptured?: boolean;
  inquiryCaptured?: boolean;
  lastMessagePreview?: string;
  updatedAt?: string;
};

export type SupportMessage = {
  id?: string;
  role?: "visitor" | "assistant" | "agent" | "system";
  sender?: string;
  text?: string;
  message?: string;
  createdAt?: string;
};

export async function getSupportSessions(filters: { product?: string } = {}) {
  return apiRequest<{ sessions: SupportSession[] }>("/support/sessions", {
    query: { product: filters.product }
  });
}

export async function getSupportSessionDetail(sessionId: string) {
  return apiRequest<{ session: SupportSession; messages: SupportMessage[] }>(`/support/sessions/${sessionId}`);
}

export async function takeoverSupportSession(sessionId: string) {
  return apiRequest(`/support/sessions/${sessionId}/takeover`, { method: "POST", body: {} });
}

export async function replyToSupportSession(sessionId: string, message: string) {
  return apiRequest(`/support/sessions/${sessionId}/reply`, { method: "POST", body: { message } });
}

export async function closeSupportSession(sessionId: string, resolutionNote: string) {
  return apiRequest(`/support/sessions/${sessionId}/close`, { method: "POST", body: { resolutionNote } });
}

export async function requestTransfer(sessionId: string, reason: string) {
  return apiRequest(`/support/sessions/${sessionId}/request-transfer`, { method: "POST", body: { reason } });
}

export async function getMyAvailability() {
  return apiRequest<{ availability?: { status?: string; effectiveStatus?: string; heartbeatAgeSeconds?: number; assignable?: boolean } }>("/support/users/me/availability");
}

export async function updateMyAvailability(status: "available" | "away" | "busy" | "offline") {
  return apiRequest("/support/users/me/availability", { method: "POST", body: { status } });
}

export async function sendHeartbeat() {
  return apiRequest("/support/users/me/heartbeat", { method: "POST", body: {} });
}
