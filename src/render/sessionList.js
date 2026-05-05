export function renderSessionList({
  sessions = [],
  loadingSessions = false,
  accessDenied = false,
  selectedSessionId = "",
  inferredContactNameForSession,
  hasRequiredLeadIdentity,
  abbreviateMiddle,
  productLabelFromKey,
  statusClass,
  statusLabel,
  formatTimestamp,
  escapeHtml,
} = {}) {
  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  if (loadingSessions && sessions.length === 0) {
    return `<div class="empty-state">Loading sessions...</div>`;
  }

  if (accessDenied) {
    return `<div class="empty-state">You are signed in, but your account does not have access to support sessions.</div>`;
  }

  if (sessions.length === 0) {
    return `<div class="empty-state">No conversations match the selected filters.</div>`;
  }

  return sessions
    .map((session) => {
      const inferredContactName =
        typeof inferredContactNameForSession === "function" ? inferredContactNameForSession(session) : "";
      const label = session.leadName || inferredContactName || session.leadEmail || "Anonymous visitor";
      const leadCaptured =
        typeof hasRequiredLeadIdentity === "function" ? hasRequiredLeadIdentity(session) : Boolean(session.leadCaptured);
      const leadState = leadCaptured ? "Lead captured" : "Lead missing";
      const tenantLabel = session.tenantName || session.organizationName || session.tenantId || "Unknown tenant";
      const compactTenantLabel =
        typeof abbreviateMiddle === "function"
          ? abbreviateMiddle(tenantLabel, { max: 28, keep: 8 })
          : tenantLabel;
      const assignedTo = session.assignedToName || session.assignedToEmail || session.assignedToUserId || "Unassigned";
      const isSelected = session.id === selectedSessionId;
      return `
        <button
          class="session-card ${isSelected ? "is-selected" : ""}"
          data-testid="session-row"
          data-session-id="${safeEscape(session.id)}"
        >
          <div class="session-card-row">
            <strong class="session-title">${safeEscape(label)}</strong>
            <span class="${
              typeof statusClass === "function" ? statusClass(session.status) : "badge"
            }">${safeEscape(typeof statusLabel === "function" ? statusLabel(session.status) : session.status)}</span>
          </div>
          <div class="session-card-row">
            <span class="badge badge-product">${safeEscape(
              typeof productLabelFromKey === "function" ? productLabelFromKey(session.productKey) : session.productKey,
            )}</span>
            <span class="session-tenant" title="${safeEscape(tenantLabel)}">${safeEscape(compactTenantLabel)}</span>
          </div>
          <div class="session-subline">
            <span>${safeEscape(leadState)} | ${safeEscape(session.inquiryUrgency || "n/a")} urgency</span>
            <span>${safeEscape(assignedTo)}</span>
          </div>
          <p class="session-preview">${safeEscape(session.lastMessagePreview || "No message preview available.")}</p>
          <div class="session-time">${
            typeof formatTimestamp === "function" ? safeEscape(formatTimestamp(session.updatedAt)) : ""
          }</div>
        </button>
      `;
    })
    .join("");
}

export function renderMessages({ messages = [], visitorLabel = "Visitor", formatTimestamp, escapeHtml } = {}) {
  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  const safeVisitorLabel = String(visitorLabel ?? "").trim() || "Visitor";
  if (!messages.length) {
    return `<div class="empty-state">No conversation messages yet.</div>`;
  }

  return messages
    .map((message) => {
      const bubbleClass = `message message-${message.sender}`;
      const senderLabel =
        message.sender === "visitor"
          ? safeVisitorLabel
          : message.sender === "agent"
            ? "Agent"
            : message.sender === "ai"
              ? "AI"
              : "System";
      return `
        <article class="${bubbleClass}">
          <header>
            <span>${senderLabel}</span>
            <time>${typeof formatTimestamp === "function" ? safeEscape(formatTimestamp(message.createdAt)) : ""}</time>
          </header>
          <p>${safeEscape(message.body || "(empty message)")}</p>
        </article>
      `;
    })
    .join("");
}
