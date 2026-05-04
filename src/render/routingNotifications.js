export function notificationStatusLabel(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "Unknown";
  return raw.replace(/_/g, " ");
}

export function renderSessionOperationsSummary({
  session,
  formatTimestamp = (value) => value,
  escapeHtml = (value) => String(value ?? ""),
  isSessionEscalated = () => false,
}) {
  const latestAssignment = session.latestAssignment;
  const assignmentLabel = latestAssignment
    ? latestAssignment.assignedToName ||
      latestAssignment.assignedToEmail ||
      latestAssignment.assignedToUserId ||
      "Assigned"
    : session.assignedToName || session.assignedToEmail || session.assignedToUserId || "Unassigned";
  const assignmentMeta = latestAssignment?.assignedAt
    ? `Updated ${formatTimestamp(latestAssignment.assignedAt)}`
    : session.departmentLabel
      ? "Current routing"
      : "No assignment history";
  const transcriptLabel = session.lastTranscriptSentAt
    ? `Sent ${formatTimestamp(session.lastTranscriptSentAt)}`
    : "Not sent";
  const transcriptMeta = session.lastTranscriptSentTo
    ? `To ${session.lastTranscriptSentTo}`
    : "No transcript email recorded";
  const routingLabel = session.routingStatus
    ? session.routingStatus.replace(/_/g, " ")
    : isSessionEscalated(session)
      ? "waiting acceptance"
      : "unassigned";
  const routingMeta = session.availabilityOutcome
    ? session.availabilityOutcome.replace(/_/g, " ")
    : session.intent
      ? `Intent: ${session.intent}`
      : "No routing outcome";

  return `
    <section class="operations-summary" aria-label="Assignment and transcript status">
      <article>
        <span>Assignment</span>
        <strong>${escapeHtml(assignmentLabel)}</strong>
        <p>${escapeHtml(assignmentMeta)}</p>
      </article>
      <article>
        <span>Department</span>
        <strong>${escapeHtml(latestAssignment?.departmentLabel || session.departmentLabel || "Unassigned")}</strong>
        <p>${escapeHtml(latestAssignment?.note || "No assignment note")}</p>
      </article>
      <article>
        <span>Routing</span>
        <strong>${escapeHtml(routingLabel)}</strong>
        <p>${escapeHtml(routingMeta)}</p>
      </article>
      <article>
        <span>Transcript</span>
        <strong>${escapeHtml(transcriptLabel)}</strong>
        <p>${escapeHtml(transcriptMeta)}</p>
      </article>
    </section>
  `;
}

export function renderRoutingNotificationsPanel({
  session,
  formatTimestamp = (value) => value,
  escapeHtml = (value) => String(value ?? ""),
}) {
  const notificationStatus = session.notificationStatus || {};
  const timeline = Array.isArray(session.notificationTimeline) ? session.notificationTimeline : [];
  const assignedTo = session.assignedToName || session.assignedToEmail || session.assignedToUserId || "Unassigned";
  const department = session.departmentLabel || session.departmentId || "Unassigned";
  const routing = session.routingStatus ? session.routingStatus.replace(/_/g, " ") : "unassigned";
  const availability = session.availabilityOutcome
    ? session.availabilityOutcome.replace(/_/g, " ")
    : "No outcome recorded";
  const attempted = notificationStatus.attempted ? "Attempted" : "Not attempted";
  const muted = notificationStatus.muted ? "Muted" : "Not muted";

  return `
    <section class="routing-notifications" aria-label="Routing and notifications">
      <header>
        <div>
          <h3>Routing / Notifications</h3>
          <p>Backend routing, assignment, and human handoff notification results.</p>
        </div>
      </header>
      <div class="routing-notifications-grid">
        <article>
          <span>Routing status</span>
          <strong>${escapeHtml(routing)}</strong>
          <p>${escapeHtml(availability)}</p>
        </article>
        <article>
          <span>Assigned user</span>
          <strong>${escapeHtml(assignedTo)}</strong>
          <p>${escapeHtml(department)}</p>
        </article>
        <article>
          <span>Notification</span>
          <strong>${escapeHtml(attempted)}</strong>
          <p>${escapeHtml(notificationStatus.reason || muted)}</p>
        </article>
      </div>
      <div class="notification-timeline">
        ${
          timeline.length
            ? timeline
                .map((item) => {
                  const label = [item.channel || "notification", item.recipient ? `to ${item.recipient}` : ""]
                    .filter(Boolean)
                    .join(" ");
                  const status = notificationStatusLabel(item.status);
                  const detail = item.reason || item.error || item.provider || item.messageId || "No additional detail";
                  return `
                    <article>
                      <strong>${escapeHtml(label)}</strong>
                      <span>${escapeHtml(status)}${item.attemptedAt ? ` | ${escapeHtml(formatTimestamp(item.attemptedAt))}` : ""}</span>
                      <p>${escapeHtml(detail)}</p>
                    </article>
                  `;
                })
                .join("")
            : `<p class="notification-empty">No notification attempts have been recorded for this session.</p>`
        }
      </div>
    </section>
  `;
}
