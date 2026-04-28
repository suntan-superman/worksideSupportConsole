import { request } from "./api";

const endpointTrace = {};

function recordEndpointTrace(actionKey, payload) {
  if (!actionKey) return;
  endpointTrace[actionKey] = {
    ...payload,
    at: new Date().toISOString(),
  };
}

async function requestSupport(path, options, actionKey) {
  try {
    const response = await request(path, options);
    recordEndpointTrace(actionKey, {
      status: "ok",
      method: options?.method ?? "GET",
      path,
    });
    return response;
  } catch (error) {
    recordEndpointTrace(actionKey, {
      status: "error",
      method: options?.method ?? "GET",
      path,
      error: error?.message ?? "Request failed",
      code: error?.code,
      requiredAction: error?.requiredAction,
    });
    throw error;
  }
}

function normalizeStatus(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "ai" || raw === "active" || raw === "active_ai" || raw === "open") {
    return "active_ai";
  }
  if (raw === "human" || raw === "active_human" || raw === "assigned" || raw === "human_active") {
    return "active_human";
  }
  if (
    raw === "escalated" ||
    raw === "pending_human" ||
    raw === "transfer_requested" ||
    raw === "transferring" ||
    raw === "awaiting_human"
  ) {
    return "escalated";
  }
  if (raw === "after_hours_intake") {
    return "after_hours_intake";
  }
  if (raw === "closed" || raw === "resolved") {
    return "closed";
  }
  return raw || "unknown";
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeSession(rawSession) {
  const session = rawSession ?? {};
  const id = pickFirst(session.id, session._id, session.sessionId);
  const status = normalizeStatus(
    pickFirst(session.status, session.sessionStatus, session.state, "active_ai"),
  );

  const leadName = pickFirst(session.leadName, session.name, session.visitorName, session.lead?.name);
  const leadEmail = pickFirst(session.leadEmail, session.email, session.visitorEmail, session.lead?.email);
  const leadPhone = pickFirst(session.leadPhone, session.phone, session.visitorPhone, session.lead?.phone);
  const leadCompany = pickFirst(session.leadCompany, session.company, session.visitorCompany, session.lead?.company);
  const inquirySummary = pickFirst(
    session.inquiry?.messageSummary,
    session.inquiryMessageSummary,
    session.inquirySummary,
    session.summary,
  );
  const inquiryUrgency = pickFirst(session.inquiry?.urgency, session.inquiryUrgency, "medium");
  const inquiryIntent = pickFirst(session.inquiry?.intent, session.inquiryIntent, "general");
  const escalationReason = pickFirst(
    session.escalationReason,
    session.reason,
    session.transfer?.reason,
    session.escalation?.reason,
    session.transferReason,
  );
  const messageCount = Number(
    pickFirst(session.messageCount, Array.isArray(session.messages) ? session.messages.length : 0),
  );
  const lastMessagePreview = pickFirst(
    session.lastMessage?.body,
    session.lastMessage?.message,
    session.preview,
    "",
  );
  const productKey = String(pickFirst(session.productKey, session.product, "generic"));
  const tenantId = String(pickFirst(session.tenantId, session.tenant_id, "default"));
  const tenantName = pickFirst(
    session.tenantName,
    session.customerName,
    session.organizationName,
    session.tenant?.name,
    session.customer?.name,
  );
  const organizationName = pickFirst(
    session.organizationName,
    session.customerName,
    session.accountName,
    session.organization?.name,
    session.customer?.name,
  );
  const sourceApp = pickFirst(session.sourceApp, session.source, session.channel, "website");

  return {
    id: id ? String(id) : undefined,
    tenantId,
    tenantName: tenantName ? String(tenantName) : "",
    organizationName: organizationName ? String(organizationName) : "",
    status,
    source: pickFirst(session.source, sourceApp, "website"),
    sourceApp: String(sourceApp),
    productKey,
    assignedToUserId: pickFirst(session.assignedToUserId, session.assignedUserId, session.assignedTo),
    leadName,
    leadEmail,
    leadPhone,
    leadCompany,
    leadCaptured:
      Boolean(session.leadCaptured) ||
      Boolean(session.lead?.captured) ||
      Boolean(leadName) ||
      Boolean(leadEmail) ||
      Boolean(leadPhone),
    inquiryCaptured: Boolean(
      pickFirst(session.inquiryCaptured, session.hasInquiry, session.inquiryId, session.inquiry?.id, session.inquiry?.captured),
    ),
    requiresInquiryCapture: Boolean(
      pickFirst(session.requiresInquiryCapture, session.afterHours, session.offlineFlow, session.inquiry?.required),
    ),
    inquirySummary: inquirySummary ? String(inquirySummary) : "",
    inquiryUrgency: String(inquiryUrgency),
    inquiryIntent: String(inquiryIntent),
    escalationReason: escalationReason ? String(escalationReason) : "",
    transferRequested: Boolean(
      pickFirst(session.transferRequested, session.needsHuman, session.escalated, session.transfer?.requested),
    ),
    lastMessagePreview: String(lastMessagePreview ?? ""),
    messageCount: Number.isFinite(messageCount) ? messageCount : 0,
    createdAt: pickFirst(session.createdAt, session.created_at, new Date().toISOString()),
    updatedAt: pickFirst(session.updatedAt, session.updated_at, session.createdAt, new Date().toISOString()),
  };
}

function normalizeSupportProduct(entry) {
  const item = entry ?? {};
  const id = pickFirst(item.id, item.key, item.product, item.productId, item.slug);
  if (!id) return null;
  const label = pickFirst(item.label, item.name, item.displayName, item.title, id);
  return {
    id: String(id),
    label: String(label),
  };
}

function normalizeSupportTenant(entry) {
  const item = entry ?? {};
  const id = pickFirst(item.id, item.tenantId, item.tenant_id, item.customerId, item.accountId);
  if (!id) return null;
  const name = pickFirst(
    item.name,
    item.tenantName,
    item.customerName,
    item.organizationName,
    item.displayName,
    id,
  );
  const product = pickFirst(item.product, item.productKey, item.productId);
  return {
    id: String(id),
    name: String(name),
    product: product ? String(product) : "",
  };
}

function normalizeSupportCollection(payload) {
  const collection = pickFirst(
    payload?.items,
    payload?.products,
    payload?.tenants,
    payload?.data?.items,
    payload?.data?.products,
    payload?.data?.tenants,
    payload?.data,
    payload,
    [],
  );
  return Array.isArray(collection) ? collection : [];
}

function normalizeMessage(rawMessage, fallbackTenantId, fallbackSessionId) {
  const message = rawMessage ?? {};
  const senderRaw = String(pickFirst(message.sender, message.role, message.from, message.senderType, "system")).toLowerCase();

  let sender = "system";
  if (senderRaw === "visitor" || senderRaw === "user" || senderRaw === "customer") sender = "visitor";
  if (senderRaw === "assistant" || senderRaw === "ai" || senderRaw === "bot") sender = "ai";
  if (senderRaw === "human" || senderRaw === "agent" || senderRaw === "support") sender = "agent";

  return {
    id: pickFirst(message.id, message._id, crypto.randomUUID()),
    sessionId: pickFirst(message.sessionId, message.session_id, fallbackSessionId),
    tenantId: pickFirst(message.tenantId, message.tenant_id, fallbackTenantId),
    sender,
    body: String(pickFirst(message.body, message.message, message.text, "")),
    createdAt: pickFirst(message.createdAt, message.created_at, new Date().toISOString()),
  };
}

function normalizeSessionAndMessages(payload) {
  const root = payload ?? {};
  const sessionRaw = pickFirst(root.session, root.data?.session, root.item, root);
  const messagesRaw = pickFirst(root.messages, root.data?.messages, sessionRaw?.messages, []);

  const session = normalizeSession(sessionRaw);
  const messages = (Array.isArray(messagesRaw) ? messagesRaw : []).map((item) =>
    normalizeMessage(item, session.tenantId, session.id),
  );

  messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  return { session, messages };
}

function normalizeSessionList(payload) {
  const collection = pickFirst(
    payload?.items,
    payload?.sessions,
    payload?.data?.items,
    payload?.data?.sessions,
    payload?.data,
    payload,
    [],
  );
  if (!Array.isArray(collection)) return [];
  return collection.map((item) => normalizeSession(item)).filter((item) => Boolean(item.id));
}

async function ensureDetail(normalized, sessionId, tenantId, product) {
  if (normalized?.session?.id) {
    return normalized;
  }
  return getSupportSession(sessionId, tenantId, product);
}

export function isSessionEscalated(session) {
  return session?.status === "escalated" || Boolean(session?.transferRequested);
}

export function isHumanSession(session) {
  return session?.status === "active_human";
}

export function getChatEndpointTrace() {
  return { ...endpointTrace };
}

export async function listSupportSessions({
  tenantId,
  product,
  search = "",
  status,
  intent,
  urgency,
  assignedTo,
  leadCaptured,
  humanTakeover,
  page,
  pageSize,
} = {}) {
  const payload = await requestSupport(
    "/support/sessions",
    {
      method: "GET",
      query: {
        tenantId,
        product,
        search,
        status,
        intent,
        urgency,
        assignedTo,
        leadCaptured,
        humanTakeover,
        page,
        pageSize,
      },
    },
    "list_support_sessions",
  );

  return normalizeSessionList(payload);
}

export async function listSupportProducts() {
  const payload = await requestSupport(
    "/support/products",
    {
      method: "GET",
    },
    "list_support_products",
  );

  return normalizeSupportCollection(payload)
    .map((item) => normalizeSupportProduct(item))
    .filter(Boolean);
}

export async function listSupportTenants({ product } = {}) {
  const payload = await requestSupport(
    "/support/tenants",
    {
      method: "GET",
      query: {
        product,
      },
    },
    "list_support_tenants",
  );

  return normalizeSupportCollection(payload)
    .map((item) => normalizeSupportTenant(item))
    .filter(Boolean);
}

export async function getSupportSession(sessionId, tenantId, product) {
  const payload = await requestSupport(
    `/support/sessions/${sessionId}`,
    {
      method: "GET",
      query: { tenantId, product },
    },
    "get_support_session",
  );

  return normalizeSessionAndMessages(payload);
}

export async function takeOverSession({ sessionId, tenantId, product, agentName, agentId }) {
  const body = {
    tenantId,
    product,
    agentId: agentId ?? agentName,
    agentName,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/takeover`,
    {
      method: "POST",
      body,
    },
    "takeover_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function sendAgentReply({ sessionId, tenantId, product, message, agentName }) {
  const body = {
    tenantId,
    product,
    text: message,
    message,
    agentName,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/reply`,
    {
      method: "POST",
      body,
    },
    "send_agent_reply",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function closeSupportSession({ sessionId, tenantId, product, reason }) {
  const body = {
    tenantId,
    product,
    resolutionNote: reason,
    reason,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/close`,
    {
      method: "POST",
      body,
    },
    "close_support_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function escalateSupportSession({ sessionId, tenantId, product, reason, note }) {
  const body = {
    tenantId,
    product,
    reason: reason ?? "user_requested_human",
    note,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/request-transfer`,
    {
      method: "POST",
      body,
    },
    "escalate_support_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function saveLeadForSession({
  sessionId,
  tenantId,
  product,
  name,
  email,
  phone,
  company,
}) {
  const body = {
    tenantId,
    product,
    name,
    email,
    phone,
    company,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/lead`,
    {
      method: "PATCH",
      body,
    },
    "save_lead_for_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function saveInquiryForSession({
  sessionId,
  tenantId,
  product,
  messageSummary,
  urgency,
  intent,
}) {
  const body = {
    tenantId,
    product,
    messageSummary,
    rawUserDescription: messageSummary,
    urgency,
    intent,
  };

  const payload = await requestSupport(
    `/support/sessions/${sessionId}/inquiry`,
    {
      method: "POST",
      body,
    },
    "save_inquiry_for_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}
