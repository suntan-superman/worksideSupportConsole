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

function isTruthyFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const raw = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on", "requested", "queued", "notified", "pending"].includes(raw);
}

function isTransferStatus(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return [
    "requested",
    "queued",
    "notified",
    "pending",
    "pending_human",
    "transfer_requested",
    "awaiting_human",
    "needs_human",
    "human_requested",
    "agent_notified",
    "team_notified",
  ].includes(raw);
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function isMeaningfulText(value) {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return !["undefined", "null", "[object object]"].includes(text.toLowerCase());
}

function pickTextFirst(...values) {
  for (const value of values) {
    if (isMeaningfulText(value)) {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeMessageSender(rawValue, fallback = "system") {
  const raw = String(rawValue ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (
    raw === "visitor" ||
    raw === "user" ||
    raw === "customer" ||
    raw === "contact" ||
    raw === "end_user" ||
    raw === "incoming" ||
    raw === "inbound" ||
    raw === "message.visitor" ||
    raw === "visitor_message" ||
    raw === "customer_message" ||
    raw === "user_message"
  ) {
    return "visitor";
  }
  if (
    raw === "assistant" ||
    raw === "ai" ||
    raw === "bot" ||
    raw === "ai_assistant" ||
    raw === "outgoing_ai" ||
    raw === "assistant_message" ||
    raw === "ai_message" ||
    raw === "ai_response" ||
    raw === "bot_reply"
  ) {
    return "ai";
  }
  if (
    raw === "human" ||
    raw === "agent" ||
    raw === "support" ||
    raw === "support_agent" ||
    raw === "operator" ||
    raw === "human_agent" ||
    raw === "agent_message" ||
    raw === "human_reply" ||
    raw === "support.reply" ||
    raw === "agent_reply_sent"
  ) {
    return "agent";
  }
  return fallback;
}

function splitLeadName(fullName) {
  const clean = String(fullName ?? "").trim();
  if (!clean) {
    return { firstName: "", lastName: "" };
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeAssignmentEntry(entry) {
  const item = entry ?? {};
  const assignedToRaw = pickFirst(item.assignedTo, item.assignee, item.user);
  const notificationRaw = item.notification && typeof item.notification === "object" ? item.notification : {};
  const assignedToUserId = pickFirst(
    item.assignedToUserId,
    item.assignedUserId,
    item.assignedToId,
    assignedToRaw?.id,
    assignedToRaw?.uid,
    assignedToRaw?.email,
  );
  const assignedToName = pickFirst(
    item.assignedToName,
    item.assignedToUserName,
    assignedToRaw?.name,
    assignedToRaw?.displayName,
    assignedToRaw?.email,
  );
  const assignedToEmail = pickFirst(item.assignedToEmail, item.assignedToUserEmail, assignedToRaw?.email);
  const departmentId = pickFirst(item.departmentId, item.department, item.departmentKey);
  const departmentLabel = pickFirst(item.departmentLabel, item.departmentName, departmentId);
  const assignedAt = pickFirst(item.assignedAt, item.createdAt, item.at, item.timestamp);

  return {
    id: String(pickFirst(item.id, item._id, `${assignedAt ?? "assignment"}-${assignedToUserId ?? "unknown"}`)),
    departmentId: departmentId ? String(departmentId) : "",
    departmentLabel: departmentLabel ? String(departmentLabel) : "",
    assignedToUserId: assignedToUserId ? String(assignedToUserId) : "",
    assignedToName: assignedToName ? String(assignedToName) : "",
    assignedToEmail: assignedToEmail ? String(assignedToEmail) : "",
    assignedBy: String(pickFirst(item.assignedByName, item.assignedBy, item.createdBy, "")),
    note: String(pickFirst(item.note, item.assignmentNote, item.message, "")),
    assignedAt: assignedAt ? String(assignedAt) : "",
    notificationAttempted: Boolean(pickFirst(notificationRaw.attempted, item.notificationAttempted, false)),
    notificationSent: Boolean(pickFirst(notificationRaw.sent, item.notificationSent, false)),
  };
}

function normalizeAssignmentHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeAssignmentEntry(item)).filter((item) => item.assignedToUserId || item.assignedAt);
}

function normalizeTranscriptReceipt(value) {
  const item = value && typeof value === "object" ? value : {};
  const sentAt = pickFirst(item.sentAt, item.createdAt, item.at, item.timestamp);
  const to = pickFirst(item.to, item.email, item.recipient, item.lastTranscriptSentTo);
  if (!sentAt && !to) return null;
  return {
    sentAt: sentAt ? String(sentAt) : "",
    to: to ? String(to) : "",
    provider: String(pickFirst(item.provider, "")),
    messageId: String(pickFirst(item.messageId, item.id, "")),
  };
}

function normalizeSupportNote(entry) {
  const item = entry && typeof entry === "object" ? entry : {};
  const note = pickTextFirst(item.note, item.text, item.body, item.message, item.resolutionNote);
  const createdAt = pickFirst(item.createdAt, item.created_at, item.at, item.timestamp);
  if (!note && !createdAt) return null;

  return {
    id: String(pickFirst(item.id, item._id, `${createdAt ?? "note"}-${note.slice(0, 24)}`)),
    type: String(pickFirst(item.type, item.noteType, "internal")),
    note,
    createdAt: createdAt ? String(createdAt) : "",
    createdByUserId: String(pickFirst(item.createdByUserId, item.createdById, item.userId, "")),
    createdByName: String(pickFirst(item.createdByName, item.createdByDisplayName, item.authorName, item.name, "")),
    createdByEmail: String(pickFirst(item.createdByEmail, item.authorEmail, item.email, "")),
  };
}

function normalizeSupportNotes(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeSupportNote(item)).filter(Boolean);
}

function normalizeSession(rawSession) {
  const session = rawSession ?? {};
  const id = pickFirst(session.id, session._id, session.sessionId);
  const rawStatus = pickFirst(session.status, session.sessionStatus, session.state, "active_ai");
  const normalizedStatus = normalizeStatus(rawStatus);

  const leadComposedName = [session.lead?.firstName, session.lead?.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  const leadSnakeComposedName = [session.lead?.first_name, session.lead?.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  const leadName = pickFirst(
    session.leadName,
    session.lead_name,
    session.lead?.name,
    session.lead?.fullName,
    session.lead?.full_name,
    session.lead?.displayName,
    session.lead?.display_name,
    session.lead?.contactName,
    session.lead?.contact_name,
    leadComposedName,
    leadSnakeComposedName,
    session.contact?.name,
    session.contact?.fullName,
    session.contact?.full_name,
    session.visitor?.name,
    session.visitor?.fullName,
    session.customer?.contactName,
    session.contactName,
    session.customerContactName,
    session.visitorName,
    session.name,
  );
  const leadEmail = pickFirst(
    session.leadEmail,
    session.lead_email,
    session.lead?.email,
    session.lead?.email_address,
    session.lead?.emailAddress,
    session.lead?.emailAddress,
    session.lead?.primaryEmail,
    session.contact?.emailAddress,
    session.contact?.email_address,
    session.contact?.email,
    session.visitor?.email,
    session.customer?.email,
    session.visitorEmail,
    session.customerEmail,
    session.email,
  );
  const leadPhone = pickFirst(
    session.leadPhone,
    session.lead_phone,
    session.lead?.phone,
    session.lead?.phone_number,
    session.lead?.telephone,
    session.lead?.phoneNumber,
    session.lead?.mobile,
    session.contact?.phoneNumber,
    session.contact?.phone_number,
    session.contact?.phone,
    session.visitor?.phone,
    session.customer?.phone,
    session.visitorPhone,
    session.customerPhone,
    session.phone,
  );
  const leadCompany = pickFirst(
    session.leadCompany,
    session.lead_company,
    session.company,
    session.visitorCompany,
    session.organizationName,
    session.lead?.company,
    session.lead?.organization,
  );
  const inquirySummary = pickFirst(
    session.inquiry?.messageSummary,
    session.inquiry?.summary,
    session.inquiry?.rawUserDescription,
    session.inquiry?.details?.messageSummary,
    session.inquiry?.details?.summary,
    session.inquiry?.details?.rawUserDescription,
    session.support?.inquiry?.latest?.summary,
    session.support?.inquiry?.latest?.messageSummary,
    session.support?.inquiry?.latest?.rawUserDescription,
    session.support?.inquiry?.latest?.details?.messageSummary,
    session.support?.inquiry?.latest?.details?.summary,
    session.support?.inquiry?.latest?.details?.rawUserDescription,
    session.inquiryMessageSummary,
    session.inquirySummary,
    session.summary,
  );
  const inquiryUrgency = pickFirst(
    session.inquiry?.urgency,
    session.inquiry?.details?.urgency,
    session.support?.inquiry?.latest?.urgency,
    session.support?.inquiry?.latest?.details?.urgency,
    session.inquiryUrgency,
    "medium",
  );
  const inquiryIntent = pickFirst(
    session.inquiry?.intent,
    session.inquiry?.details?.intent,
    session.support?.inquiry?.latest?.intent,
    session.support?.inquiry?.latest?.details?.intent,
    session.inquiryIntent,
    "general",
  );
  const escalationReason = pickFirst(
    session.escalationReason,
    session.reason,
    session.transfer?.reason,
    session.escalation?.reason,
    session.handoff?.reason,
    session.support?.transferReason,
    session.support?.handoffReason,
    session.transferReason,
  );
  const transferRequested = isTruthyFlag(
    pickFirst(
      session.transferRequested,
      session.transfer_requested,
      session.needsHuman,
      session.needs_human,
      session.humanRequested,
      session.human_requested,
      session.requestedHuman,
      session.request_human,
      session.agentRequested,
      session.agent_requested,
      session.supportRequested,
      session.support_requested,
      session.handoffRequested,
      session.handoff_requested,
      session.humanHandoffRequested,
      session.human_handoff_requested,
      session.escalated,
      session.transfer?.requested,
      session.transfer?.transferRequested,
      session.transfer?.humanRequested,
      session.transfer?.teamNotified,
      session.transfer?.agentNotified,
      session.escalation?.requested,
      session.escalation?.teamNotified,
      session.handoff?.requested,
      session.handoff?.teamNotified,
      session.support?.transferRequested,
      session.support?.needsHuman,
      session.support?.humanRequested,
      session.support?.handoffRequested,
      session.support?.teamNotified,
      session.support?.agentNotified,
      session.support?.notification?.teamNotified,
      session.support?.notification?.agentNotified,
      session.notification?.teamNotified,
      session.notification?.agentNotified,
    ),
  );
  const transferStatusRequested =
    isTransferStatus(rawStatus) ||
    isTransferStatus(session.transfer?.status) ||
    isTransferStatus(session.escalation?.status) ||
    isTransferStatus(session.handoff?.status) ||
    isTransferStatus(session.support?.transferStatus) ||
    isTransferStatus(session.support?.handoffStatus) ||
    isTransferStatus(session.support?.notification?.status) ||
    isTransferStatus(session.notification?.status);
  const transferFlagRequested =
    transferRequested ||
    isTruthyFlag(session.teamNotified) ||
    isTruthyFlag(session.team_notified) ||
    isTruthyFlag(session.agentNotified) ||
    isTruthyFlag(session.agent_notified) ||
    transferStatusRequested;
  const status =
    transferFlagRequested && normalizedStatus !== "active_human" && normalizedStatus !== "closed"
      ? "escalated"
      : normalizedStatus;
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
  const tenantId = String(
    pickFirst(
      session.tenantId,
      session.tenant_id,
      session.tenant,
      session.tenant?.id,
      session.tenant?._id,
      session.tenant?.tenantId,
      session.customerId,
      session.customer_id,
      session.customer?.id,
      session.customer?._id,
      session.customer?.tenantId,
    ),
  );
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
  const allowAnonymousNoFollowUpClose = pickFirst(
    session.allowAnonymousNoFollowUpClose,
    session.allowAnonymousCloseNoFollowUp,
    session.allowAnonymousClose,
    session.permissions?.allowAnonymousNoFollowUpClose,
    session.authorization?.allowAnonymousNoFollowUpClose,
    session.tenantConfig?.allowAnonymousNoFollowUpClose,
    session.chatConfig?.allowAnonymousNoFollowUpClose,
    session.features?.allowAnonymousNoFollowUpClose,
  );
  const assignedToRaw = pickFirst(session.assignedTo, session.support?.assignedTo, session.assignment?.assignedTo);
  const assignedToUserId = pickFirst(
    session.assignedToUserId,
    session.assignedUserId,
    session.assignedToId,
    assignedToRaw?.uid,
    assignedToRaw?.id,
    assignedToRaw?.email,
  );
  const assignedToName = pickFirst(
    session.assignedToName,
    session.assignedToUserName,
    assignedToRaw?.name,
    assignedToRaw?.displayName,
    assignedToRaw?.email,
  );
  const assignedToEmail = pickFirst(
    session.assignedToEmail,
    session.assignedToUserEmail,
    assignedToRaw?.email,
  );
  const lastMessageSender = pickFirst(
    session.lastMessageSender,
    session.last_message_sender,
    session.lastMessage?.sender,
    session.lastMessage?.senderType,
    session.lastMessage?.role,
    session.lastInteractionSender,
    session.last_interaction_sender,
    session.lastInteraction?.sender,
  );
  const lastAgentReplyAt = pickFirst(
    session.lastAgentReplyAt,
    session.last_agent_reply_at,
    session.support?.lastAgentReplyAt,
    session.lastAgentMessageAt,
  );
  const lastVisitorMessageAt = pickFirst(
    session.lastVisitorMessageAt,
    session.last_visitor_message_at,
    session.support?.lastVisitorMessageAt,
    session.lastCustomerMessageAt,
  );
  const unreadForAssignee = Number(
    pickFirst(
      session.unreadForAssignee,
      session.unread_for_assignee,
      session.unreadCount,
      session.unread_count,
      session.support?.unreadForAssignee,
      0,
    ),
  );
  const departmentId = pickFirst(session.departmentId, session.support?.departmentId, session.assignment?.departmentId);
  const departmentLabel = pickFirst(
    session.departmentLabel,
    session.support?.departmentLabel,
    session.assignment?.departmentLabel,
    departmentId,
  );
  const assignmentHistory = normalizeAssignmentHistory(
    pickFirst(session.assignmentHistory, session.support?.assignmentHistory, session.assignment?.history, []),
  );
  const latestAssignment = assignmentHistory[assignmentHistory.length - 1];
  const transcriptReceipt = normalizeTranscriptReceipt(
    pickFirst(
      session.transcriptEmail,
      session.lastTranscript,
      session.transcript?.lastSent,
      session.support?.transcriptEmail,
      session.support?.lastTranscript,
      session.support?.lastTranscriptEmail,
      {
        sentAt: session.support?.lastTranscriptSentAt ?? session.lastTranscriptSentAt,
        to: session.support?.lastTranscriptSentTo ?? session.lastTranscriptSentTo,
      },
    ),
  );
  const supportNotes = normalizeSupportNotes(
    pickFirst(
      session.supportNotes,
      session.notes,
      session.internalNotes,
      session.support?.notes,
      session.support?.internalNotes,
      [],
    ),
  );

  return {
    id: id ? String(id) : undefined,
    tenantId,
    tenantName: tenantName ? String(tenantName) : "",
    organizationName: organizationName ? String(organizationName) : "",
    status,
    source: pickFirst(session.source, sourceApp, "website"),
    sourceApp: String(sourceApp),
    productKey,
    assignedToUserId: assignedToUserId ? String(assignedToUserId) : "",
    assignedToName: assignedToName ? String(assignedToName) : "",
    assignedToEmail: assignedToEmail ? String(assignedToEmail) : "",
    lastMessageSender: lastMessageSender ? String(lastMessageSender).toLowerCase() : "",
    lastAgentReplyAt: lastAgentReplyAt ? String(lastAgentReplyAt) : "",
    lastVisitorMessageAt: lastVisitorMessageAt ? String(lastVisitorMessageAt) : "",
    unreadForAssignee: Number.isFinite(unreadForAssignee) ? unreadForAssignee : 0,
    departmentId: departmentId ? String(departmentId) : "",
    departmentLabel: departmentLabel ? String(departmentLabel) : "",
    assignmentHistory,
    latestAssignment: latestAssignment ?? null,
    lastTranscriptSentAt: transcriptReceipt?.sentAt ?? "",
    lastTranscriptSentTo: transcriptReceipt?.to ?? "",
    lastTranscriptProvider: transcriptReceipt?.provider ?? "",
    lastTranscriptMessageId: transcriptReceipt?.messageId ?? "",
    supportNotes,
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
      pickFirst(
        session.inquiryCaptured,
        session.hasInquiry,
        session.inquiryId,
        session.inquiry?.id,
        session.inquiry?.captured,
        session.support?.inquiry?.captured,
        session.support?.inquiry?.latest,
      ),
    ),
    requiresInquiryCapture: Boolean(
      pickFirst(
        session.requiresInquiryCapture,
        session.inquiryRequired,
        session.afterHours,
        session.offlineFlow,
        session.inquiry?.required,
        session.support?.inquiry?.required,
      ),
    ),
    inquirySummary: inquirySummary ? String(inquirySummary) : "",
    inquiryUrgency: String(inquiryUrgency),
    inquiryIntent: String(inquiryIntent),
    escalationReason: escalationReason ? String(escalationReason) : "",
    transferRequested: transferFlagRequested,
    allowAnonymousNoFollowUpClose:
      typeof allowAnonymousNoFollowUpClose === "boolean" ? allowAnonymousNoFollowUpClose : null,
    lastMessagePreview: String(lastMessagePreview ?? ""),
    messageCount: Number.isFinite(messageCount) ? messageCount : 0,
    createdAt: pickFirst(
      session.createdAt,
      session.created_at,
      session.startedAt,
      session.started_at,
      session.initialDate,
      session.initial_date,
      session.updatedAt,
      session.updated_at,
      "",
    ),
    updatedAt: pickFirst(
      session.updatedAt,
      session.updated_at,
      session.lastInteractionAt,
      session.last_interaction_at,
      session.lastInteraction,
      session.last_interaction,
      session.lastMessageAt,
      session.last_message_at,
      session.createdAt,
      session.created_at,
      session.startedAt,
      session.started_at,
      "",
    ),
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

function normalizeSupportUser(entry) {
  const item = entry ?? {};
  const id = pickFirst(item.id, item.uid, item.userId, item.email);
  if (!id) return null;
  return {
    id: String(id),
    name: String(pickFirst(item.name, item.displayName, item.email, id)),
    email: String(pickFirst(item.email, "")),
    phone: String(pickFirst(item.phone, item.phoneNumber, item.smsPhone, item.mobile, "")),
    role: String(pickFirst(item.role, "support_agent")),
    departments: Array.isArray(item.departments) ? item.departments.map(String) : [],
    allowedProducts: Array.isArray(item.allowedProducts) ? item.allowedProducts.map(String) : [],
    allowedTenantIds: Array.isArray(item.allowedTenantIds) ? item.allowedTenantIds.map(String) : [],
    active: item.active !== false,
  };
}

function normalizeSupportDepartment(entry) {
  const item = entry ?? {};
  const id = pickFirst(item.id, item.departmentId, item.key, item.slug);
  if (!id) return null;
  return {
    id: String(id),
    label: String(pickFirst(item.label, item.name, id)),
    product: String(pickFirst(item.product, item.productKey, "")),
    active: item.active !== false,
    defaultAssigneeIds: Array.isArray(item.defaultAssigneeIds)
      ? item.defaultAssigneeIds.map(String)
      : Array.isArray(item.defaultAssignees)
        ? item.defaultAssignees.map(String)
        : [],
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

function normalizeSupportUsers(payload) {
  return normalizeSupportCollection(payload)
    .map((item) => normalizeSupportUser(item))
    .filter(Boolean);
}

function normalizeSupportDepartments(payload) {
  return normalizeSupportCollection(payload)
    .map((item) => normalizeSupportDepartment(item))
    .filter(Boolean);
}

function normalizeMessage(rawMessage, fallbackTenantId, fallbackSessionId) {
  const message = rawMessage ?? {};
  const body = pickTextFirst(
    message.body,
    message.message,
    message.text,
    message.content,
    message.reply,
    message.displayText,
  );
  if (!body) return null;

  const senderRaw = pickFirst(
    message.sender,
    message.role,
    message.from,
    message.senderType,
    message.authorType,
    message.author,
    message.source,
    message.direction,
    message.type,
    message.eventType,
    message.messageType,
  );
  const sender = normalizeMessageSender(senderRaw);

  return {
    id: pickFirst(message.id, message._id, crypto.randomUUID()),
    sessionId: pickFirst(message.sessionId, message.session_id, fallbackSessionId),
    tenantId: pickFirst(message.tenantId, message.tenant_id, fallbackTenantId),
    sender,
    body,
    createdAt: pickFirst(message.createdAt, message.created_at, new Date().toISOString()),
  };
}

function normalizeActionMessage(rawAction, fallbackTenantId, fallbackSessionId) {
  const action = rawAction ?? {};
  const actionType = String(pickFirst(action.action, action.type, action.eventType, "")).toLowerCase();
  const data = action.data && typeof action.data === "object" ? action.data : {};
  const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
  const result = action.result && typeof action.result === "object" ? action.result : {};
  const body = pickTextFirst(
    action.message,
    action.text,
    action.body,
    data.message,
    data.text,
    data.reply,
    payload.message,
    payload.text,
    result.message,
  );
  if (!body) return null;

  const sender = normalizeMessageSender(actionType);

  return {
    id: String(pickFirst(action.id, action._id, `action-${crypto.randomUUID()}`)),
    sessionId: pickFirst(action.sessionId, action.session_id, fallbackSessionId),
    tenantId: pickFirst(action.tenantId, action.tenant_id, fallbackTenantId),
    sender,
    body,
    createdAt: pickFirst(action.createdAt, action.created_at, action.at, new Date().toISOString()),
  };
}

function normalizeActionMessages(rawActions, fallbackTenantId, fallbackSessionId) {
  if (!Array.isArray(rawActions)) return [];
  return rawActions
    .map((item) => normalizeActionMessage(item, fallbackTenantId, fallbackSessionId))
    .filter(Boolean);
}

function normalizeSessionAndMessages(payload) {
  const root = payload ?? {};
  const sessionRaw = pickFirst(root.session, root.data?.session, root.item, root);
  const messagesRaw = pickFirst(root.messages, root.data?.messages, sessionRaw?.messages, []);
  const actionsRaw = pickFirst(root.actions, root.data?.actions, sessionRaw?.actions, sessionRaw?.supportActions, []);

  const session = normalizeSession(sessionRaw);
  const messages = [
    ...(Array.isArray(messagesRaw) ? messagesRaw : []).map((item) =>
      normalizeMessage(item, session.tenantId, session.id),
    ),
    ...normalizeActionMessages(actionsRaw, session.tenantId, session.id),
  ].filter(Boolean);

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
  if (normalized?.session?.id && normalized.messages?.length) {
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
  sortBy,
  sortDirection,
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
        sortBy,
        sortDirection,
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

export async function listSupportUsers({ product, tenantId, departmentId, admin = false } = {}) {
  const payload = await requestSupport(
    admin ? "/support/admin/users" : "/support/users",
    {
      method: "GET",
      query: {
        product,
        tenantId,
        tenant: tenantId,
        departmentId,
      },
    },
    admin ? "list_admin_support_users" : "list_support_users",
  );

  return normalizeSupportUsers(payload);
}

export async function listSupportDepartments({ product, tenantId, admin = false } = {}) {
  const payload = await requestSupport(
    admin ? "/support/admin/departments" : "/support/departments",
    {
      method: "GET",
      query: {
        product,
        tenantId,
        tenant: tenantId,
      },
    },
    admin ? "list_admin_support_departments" : "list_support_departments",
  );

  return normalizeSupportDepartments(payload);
}

export async function createSupportUser(body = {}) {
  const payload = await requestSupport(
    "/support/admin/users",
    {
      method: "POST",
      body,
    },
    "create_admin_support_user",
  );
  return normalizeSupportUser(pickFirst(payload?.user, payload?.item, payload?.data?.user, payload?.data, payload));
}

export async function updateSupportUser(userId, body = {}) {
  const payload = await requestSupport(
    `/support/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body,
    },
    "update_admin_support_user",
  );
  return normalizeSupportUser(pickFirst(payload?.user, payload?.item, payload?.data?.user, payload?.data, payload));
}

export async function sendSupportUserInvite(userId) {
  return requestSupport(
    `/support/admin/users/${encodeURIComponent(userId)}/invite`,
    {
      method: "POST",
    },
    "send_admin_support_user_invite",
  );
}

export async function sendSupportUserPasswordReset(userId) {
  return requestSupport(
    `/support/admin/users/${encodeURIComponent(userId)}/reset-password`,
    {
      method: "POST",
    },
    "send_admin_support_user_password_reset",
  );
}

export async function sendSupportUserRoleNotice(userId) {
  return requestSupport(
    `/support/admin/users/${encodeURIComponent(userId)}/notify-role-change`,
    {
      method: "POST",
    },
    "send_admin_support_user_role_notice",
  );
}

export async function createSupportDepartment(body = {}) {
  const payload = await requestSupport(
    "/support/admin/departments",
    {
      method: "POST",
      body,
    },
    "create_admin_support_department",
  );
  return normalizeSupportDepartment(
    pickFirst(payload?.department, payload?.item, payload?.data?.department, payload?.data, payload),
  );
}

export async function updateSupportDepartment(departmentId, body = {}) {
  const payload = await requestSupport(
    `/support/admin/departments/${encodeURIComponent(departmentId)}`,
    {
      method: "PATCH",
      body,
    },
    "update_admin_support_department",
  );
  return normalizeSupportDepartment(
    pickFirst(payload?.department, payload?.item, payload?.data?.department, payload?.data, payload),
  );
}

export async function deleteSupportDepartment(departmentId) {
  const payload = await requestSupport(
    `/support/admin/departments/${encodeURIComponent(departmentId)}`,
    {
      method: "DELETE",
    },
    "delete_admin_support_department",
  );
  return payload ?? {};
}

export async function getSupportSession(sessionId, tenantId, product) {
  const payload = await requestSupport(
    `/support/sessions/${sessionId}`,
    {
      method: "GET",
      query: { tenantId, tenant: tenantId, product },
    },
    "get_support_session",
  );

  return normalizeSessionAndMessages(payload);
}

export async function takeOverSession({ sessionId, tenantId, product, agentName, agentId }) {
  const body = {
    tenantId,
    tenant: tenantId,
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
    tenant: tenantId,
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

export async function saveSupportNote({ sessionId, tenantId, product, note, type = "internal" }) {
  const payload = await requestSupport(
    `/support/sessions/${sessionId}/notes`,
    {
      method: "POST",
      body: {
        tenantId,
        tenant: tenantId,
        product,
        type,
        note,
      },
    },
    "save_support_note",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function closeSupportSession({
  sessionId,
  tenantId,
  product,
  reason,
  resolutionNote,
  confirmNoFollowUp,
}) {
  const body = {
    tenantId,
    tenant: tenantId,
    product,
  };
  if (reason) body.reason = reason;
  if (resolutionNote) body.resolutionNote = resolutionNote;
  if (typeof confirmNoFollowUp === "boolean") body.confirmNoFollowUp = confirmNoFollowUp;

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
    tenant: tenantId,
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
  const nameParts = splitLeadName(name);
  const body = {
    tenantId,
    tenant: tenantId,
    product,
    name,
    email,
    phone,
    company,
    // Compatibility aliases for backend variants.
    leadName: name,
    leadEmail: email,
    leadPhone: phone,
    leadCompany: company,
    fullName: name,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    lead: {
      name,
      email,
      phone,
      company,
      fullName: name,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
    },
    contact: {
      name,
      email,
      phone,
      company,
    },
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
    tenant: tenantId,
    product,
    message: messageSummary,
    summary: messageSummary,
    messageSummary,
    rawUserDescription: messageSummary,
    urgency,
    intent,
    inquiry: {
      summary: messageSummary,
      messageSummary,
      rawUserDescription: messageSummary,
      urgency,
      intent,
    },
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

export async function sendTranscriptForSession({
  sessionId,
  tenantId,
  product,
  to,
  includeCustomerMessages = true,
  includeHumanMessages = true,
  includeAiMessages = false,
  includeAgentMessages = true,
  includeSystemMessages = false,
  includeInternalNotes = false,
  subject,
}) {
  const body = {
    tenantId,
    tenant: tenantId,
    product,
    to,
    includeCustomerMessages,
    includeHumanMessages,
    includeAiMessages,
    includeAgentMessages,
    includeSystemMessages,
    includeInternalNotes,
  };
  if (subject) body.subject = subject;

  let payload;
  try {
    payload = await requestSupport(
      `/support/sessions/${sessionId}/transcript`,
      {
        method: "POST",
        body,
      },
      "send_session_transcript",
    );
  } catch (error) {
    if (error?.status !== 404 && error?.status !== 405) {
      throw error;
    }
    payload = await requestSupport(
      `/support/sessions/${sessionId}/send-transcript`,
      {
        method: "POST",
        body,
      },
      "send_session_transcript",
    );
  }

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}

export async function assignSupportSession({
  sessionId,
  tenantId,
  product,
  departmentId,
  assignedToUserId,
  note,
  notifyAssignee = true,
  includeTranscriptSummary = true,
}) {
  const payload = await requestSupport(
    `/support/sessions/${sessionId}/assign`,
    {
      method: "POST",
      body: {
        tenantId,
        tenant: tenantId,
        product,
        departmentId,
        assignedToUserId,
        note,
        notifyAssignee,
        includeTranscriptSummary,
      },
    },
    "assign_support_session",
  );

  return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
}
