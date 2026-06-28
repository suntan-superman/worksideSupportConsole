function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

export function renderNotificationTimeline({ receipts = [], escapeHtml, formatTimestamp } = {}) {
  if (!receipts.length) {
    return `<section class="detail-section"><h3>Notifications</h3><p>No notification receipts are available.</p></section>`;
  }

  return `
    <section class="detail-section">
      <h3>Notifications</h3>
      <ol class="timeline-list">
        ${receipts
          .map((receipt) => {
            const time = typeof formatTimestamp === "function" ? formatTimestamp(receipt.attemptedAt) : receipt.attemptedAt;
            const reason = receipt.errorMessage || receipt.skippedReason || receipt.errorCode || "";
            return `
              <li>
                <strong>${safe(receipt.channel, escapeHtml)} ${safe(receipt.status, escapeHtml)}</strong>
                <span>${safe(time, escapeHtml)}</span>
                <p>${safe([receipt.provider, receipt.recipientLabel, reason].filter(Boolean).join(" | "), escapeHtml)}</p>
              </li>
            `;
          })
          .join("")}
      </ol>
    </section>
  `;
}
