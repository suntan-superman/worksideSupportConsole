import { apiRequest } from "@/services/apiClient";

type AnyRecord = Record<string, any>;

function pickFirst<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && value !== "") as T | undefined;
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function meaningfulText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text.toLowerCase() === "[object object]" ? "" : text;
  }
  if (Array.isArray(value)) {
    return value.map(meaningfulText).filter(Boolean).join(" ").trim();
  }
  if (typeof value === "object") {
    const record = value as AnyRecord;
    return meaningfulText(
      pickFirst(record.text, record.message, record.content, record.body, record.value, record.summary, record.messageSummary)
    );
  }
  return "";
}

export function formatStatus(value?: string) {
  const status = String(value || "").trim();
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function productLabel(value?: string) {
  const product = String(value || "").trim().toLowerCase();
  if (product === "merxus") return "Merxus AI";
  if (product === "home_advisor") return "Home Advisor";
  if (product === "workside_logistics") return "Workside Logistics";
  return product ? product.replace(/_/g, " ") : "Unknown Product";
}

function normalizeStatus(value: unknown, source: AnyRecord = {}) {
  const raw = String(value || "").trim().toLowerCase();
  const transferRequested = Boolean(
    pickFirst(
      source.transferRequested,
      source.transfer_requested,
      source.handoff?.requested,
      source.transfer?.requested,
      source.support?.transferRequested,
      source.support?.notification?.teamNotified,
      source.notification?.teamNotified
    )
  );
  if (raw === "resolved") return "closed";
  if (raw === "active_human" || raw === "human") return "active_human";
  if (raw === "escalated" || raw === "transfer_requested" || raw === "transferring" || transferRequested) {
    return "escalated";
  }
  return raw || "active_ai";
}

export type SupportSession = {
  id: string;
  product?: string;
  productKey?: string;
  tenantId?: string;
  status: string;
  routingStatus?: string;
  availabilityOutcome?: string;
  urgency?: string;
  assignedTo?: string;
  ownerName?: string;
  leadName?: string;
  visitorName?: string;
  leadEmail?: string;
  leadCaptured?: boolean;
  inquiryCaptured?: boolean;
  transferRequested?: boolean;
  lastMessagePreview?: string;
  createdAt?: string;
  startedAt?: string;
  updatedAt?: string;
  lastInteractionAt?: string;
};

export type SupportMessage = {
  id?: string;
  role?: "visitor" | "assistant" | "agent" | "support" | "system";
  sender?: string;
  text?: string;
  message?: string;
  content?: string;
  createdAt?: string;
};

export type AvailabilityStatus = "available" | "away" | "busy" | "offline" | "do_not_disturb";

export type Availability = {
  status: AvailabilityStatus;
  effectiveStatus: string;
  heartbeatAgeSeconds?: number;
  assignable?: boolean;
  lastSeenAt?: string;
};

function normalizeSession(raw: AnyRecord): SupportSession {
  const id = String(pickFirst(raw.id, raw._id, raw.sessionId) || "");
  const product = meaningfulText(pickFirst(raw.product, raw.productKey, raw.support?.product, "merxus")) || "merxus";
  const status = normalizeStatus(pickFirst(raw.status, raw.state, raw.support?.status), raw);
  return {
    id,
    product,
    productKey: meaningfulText(pickFirst(raw.productKey, raw.product, product)) || product,
    tenantId: meaningfulText(pickFirst(raw.tenantId, raw.tenant, raw.customerId, raw.support?.tenantId, "")),
    status,
    routingStatus: meaningfulText(pickFirst(raw.routingStatus, raw.support?.routingStatus, raw.support?.routing?.status, "")),
    availabilityOutcome: meaningfulText(
      pickFirst(raw.availabilityOutcome, raw.support?.availabilityOutcome, raw.support?.routing?.availabilityOutcome, "")
    ),
    urgency: meaningfulText(pickFirst(raw.urgency, raw.inquiry?.urgency, raw.support?.urgency, "medium")) || "medium",
    assignedTo: meaningfulText(pickFirst(raw.assignedTo, raw.assignedToUserId, raw.support?.assignedTo, "")),
    ownerName: meaningfulText(pickFirst(raw.ownerName, raw.agentName, raw.support?.ownerName, raw.support?.agentName, "")),
    leadName: meaningfulText(pickFirst(raw.leadName, raw.contactName, raw.lead?.name, raw.customer?.name, "")),
    visitorName: meaningfulText(pickFirst(raw.visitorName, raw.visitor?.name, raw.metadata?.visitorName, "")),
    leadEmail: meaningfulText(pickFirst(raw.leadEmail, raw.contactEmail, raw.lead?.email, raw.customer?.email, "")),
    leadCaptured: Boolean(pickFirst(raw.leadCaptured, raw.lead?.captured, raw.leadName || raw.leadEmail, false)),
    inquiryCaptured: Boolean(pickFirst(raw.inquiryCaptured, raw.inquiry?.captured, raw.inquiry?.messageSummary, false)),
    transferRequested: status === "escalated",
    lastMessagePreview: meaningfulText(pickFirst(raw.lastMessagePreview, raw.preview, raw.lastMessage, raw.lastMessage?.text, raw.lastMessage?.message)),
    createdAt: meaningfulText(pickFirst(raw.createdAt, raw.initialDate, raw.startedAt, "")),
    startedAt: meaningfulText(pickFirst(raw.startedAt, raw.initialDate, raw.createdAt, "")),
    updatedAt: meaningfulText(pickFirst(raw.updatedAt, raw.lastUpdatedAt, raw.lastInteractionAt, "")),
    lastInteractionAt: meaningfulText(pickFirst(raw.lastInteractionAt, raw.lastMessageAt, raw.updatedAt, ""))
  };
}

function normalizeMessage(raw: AnyRecord, index: number): SupportMessage {
  const role = String(pickFirst(raw.role, raw.sender, raw.author, raw.type, "visitor") || "visitor").toLowerCase();
  const text = meaningfulText(pickFirst(raw.text, raw.message, raw.content, raw.body, raw.parts, ""));
  return {
    id: String(pickFirst(raw.id, raw._id, `${index}`) || `${index}`),
    role: role as SupportMessage["role"],
    sender: meaningfulText(pickFirst(raw.sender, raw.authorName, "")),
    text,
    message: text,
    content: text,
    createdAt: String(pickFirst(raw.createdAt, raw.timestamp, raw.sentAt, "") || "")
  };
}

function sessionListFromPayload(payload: AnyRecord) {
  const source = pickFirst(payload.sessions, payload.items, payload.data?.sessions, payload.data?.items, payload.data, []);
  return asArray<AnyRecord>(source).map(normalizeSession).filter((session) => session.id);
}

function detailFromPayload(payload: AnyRecord, sessionId: string) {
  const sessionRaw = pickFirst(payload.session, payload.data?.session, payload.item, payload.data, payload) as AnyRecord;
  const messagesRaw = pickFirst(payload.messages, payload.data?.messages, sessionRaw?.messages, []) as AnyRecord[];
  return {
    session: normalizeSession({ ...sessionRaw, id: pickFirst(sessionRaw?.id, sessionRaw?._id, sessionId) }),
    messages: asArray<AnyRecord>(messagesRaw).map(normalizeMessage).filter((message) => meaningfulText(message.text))
  };
}

export function isWaitingForTakeover(session?: SupportSession | null) {
  return session?.status === "escalated" || Boolean(session?.transferRequested);
}

export function isHumanActive(session?: SupportSession | null) {
  return session?.status === "active_human";
}

export async function getSupportSessions(filters: { product?: string } = {}) {
  const payload = await apiRequest<AnyRecord>("/support/sessions", {
    query: { product: filters.product }
  });
  return { sessions: sessionListFromPayload(payload) };
}

export async function getSupportSessionDetail(sessionId: string) {
  const payload = await apiRequest<AnyRecord>(`/support/sessions/${sessionId}`);
  return detailFromPayload(payload, sessionId);
}

function sessionRouteBody(session?: SupportSession | null, extra: AnyRecord = {}) {
  return {
    tenantId: session?.tenantId || undefined,
    tenant: session?.tenantId || undefined,
    product: session?.productKey || session?.product || undefined,
    ...extra
  };
}

export async function takeoverSupportSession(sessionId: string, session?: SupportSession | null, agentName?: string) {
  return apiRequest(`/support/sessions/${sessionId}/takeover`, {
    method: "POST",
    body: sessionRouteBody(session, { agentName })
  });
}

export async function replyToSupportSession(sessionId: string, message: string, session?: SupportSession | null) {
  return apiRequest(`/support/sessions/${sessionId}/reply`, {
    method: "POST",
    body: sessionRouteBody(session, { message, text: message })
  });
}

export async function closeSupportSession(sessionId: string, resolutionNote: string, session?: SupportSession | null) {
  return apiRequest(`/support/sessions/${sessionId}/close`, {
    method: "POST",
    body: sessionRouteBody(session, { resolutionNote, reason: "closed_by_support" })
  });
}

export async function requestTransfer(sessionId: string, reason: string, session?: SupportSession | null) {
  return apiRequest(`/support/sessions/${sessionId}/request-transfer`, {
    method: "POST",
    body: sessionRouteBody(session, { reason, note: "Escalated from mobile support app." })
  });
}

export async function getMyAvailability() {
  const payload = await apiRequest<AnyRecord>("/support/users/me/availability");
  const raw = (pickFirst(payload.availability, payload.data?.availability, payload.data, payload) || {}) as AnyRecord;
  const status = String(pickFirst(raw.status, "offline") || "offline") as AvailabilityStatus;
  const availability: Availability = {
    status,
    effectiveStatus: String(pickFirst(raw.effectiveStatus, raw.effective, status) || status),
    heartbeatAgeSeconds: raw.heartbeatAgeSeconds,
    assignable: Boolean(pickFirst(raw.assignable, false)),
    lastSeenAt: String(pickFirst(raw.lastSeenAt, raw.updatedAt, "") || "")
  };
  return { availability };
}

export async function updateMyAvailability(status: AvailabilityStatus) {
  return apiRequest("/support/users/me/availability", { method: "POST", body: { status } });
}

export async function sendHeartbeat() {
  return apiRequest("/support/users/me/heartbeat", { method: "POST", body: {} });
}
