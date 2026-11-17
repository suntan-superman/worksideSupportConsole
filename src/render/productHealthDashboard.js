function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

function safeReportUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : "";
  } catch {
    return "";
  }
}

function displayTimestamp(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function feedWarning(feedStatus = {}) {
  const lastUpdate = feedStatus.lastSuccessfulAt
    ? ` Last successful update: ${displayTimestamp(feedStatus.lastSuccessfulAt)}.`
    : " No successful update in this session.";
  const messages = [];
  if (["unauthorized", "not_found", "unavailable", "network_error", "timeout", "malformed"].includes(feedStatus.state)) {
    const reason = {
      unauthorized: "You are not authorized to view current product health data.",
      not_found: "The product health endpoint is unavailable.",
      malformed: "The product health feed returned an invalid response.",
    }[feedStatus.state] ?? "Product health data is temporarily unavailable.";
    messages.push(`${reason}${lastUpdate}`);
  }
  if (feedStatus.missingProducts?.length) {
    messages.push(`No health record is available for: ${feedStatus.missingProducts.join(", ")}.`);
  }
  if (feedStatus.staleProducts?.length) {
    messages.push(`Health data is stale for: ${feedStatus.staleProducts.join(", ")}.`);
  }
  if (feedStatus.unavailableProducts?.length) {
    messages.push(`Health sources are unavailable for: ${feedStatus.unavailableProducts.join(", ")}.`);
  }
  if (feedStatus.unknownFreshnessProducts?.length) {
    messages.push(`Freshness could not be confirmed for: ${feedStatus.unknownFreshnessProducts.join(", ")}.`);
  }
  return messages.join(" ");
}

export function renderProductHealthDashboard({ products = [], feedStatus = {}, expanded = false, escapeHtml } = {}) {
  const warning = feedWarning(feedStatus);
  const healthSummary = products.length && products.every((product) => product.status === "unknown")
    ? "Health data is currently unknown"
    : "Expand for details";
  const rows = products.length
    ? products
        .map(
          (product) => `
            <tr>
              <td>${safe(product.label, escapeHtml)}</td>
              <td><span class="badge">${safe(product.status, escapeHtml)}</span></td>
              <td>${safe(product.latestRelease || "Unknown", escapeHtml)}</td>
              <td title="${safe(product.updatedAt || "", escapeHtml)}">${safe(product.freshness || "unknown", escapeHtml)}${product.updatedAt ? ` · ${safe(displayTimestamp(product.updatedAt), escapeHtml)}` : ""}</td>
              <td>${safe(product.qa, escapeHtml)}</td>
              <td>${safe(product.meta, escapeHtml)}</td>
              <td>${safe(product.stripe, escapeHtml)}</td>
              <td>${safe(product.auth, escapeHtml)}</td>
              <td>${safe(product.email, escapeHtml)}</td>
              <td>${safe(product.notifications, escapeHtml)}</td>
              <td>${safeReportUrl(product.latestReportUrl) ? `<a href="${safe(safeReportUrl(product.latestReportUrl), escapeHtml)}" target="_blank" rel="noreferrer">Open</a>` : "N/A"}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="11">No product health records are available.</td></tr>`;

  return `
    <section id="product-health-panel" class="operations-panel product-health-panel">
      <button id="product-health-toggle" type="button" class="product-health-summary" aria-expanded="${expanded}" aria-controls="product-health-content">
        <strong>Product Health</strong>
        <span>${safe(healthSummary, escapeHtml)}</span>
        <span class="product-health-toggle-icon" aria-hidden="true">${expanded ? "−" : "＋"}</span>
      </button>
      <div id="product-health-content" class="product-health-content" ${expanded ? "" : "hidden"}>
        ${warning ? `<div class="banner banner-warning" role="status">${safe(warning, escapeHtml)}</div>` : ""}
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Latest Release</th>
                <th>Data Freshness</th>
                <th>QA</th>
                <th>Meta</th>
                <th>Stripe</th>
                <th>Auth</th>
                <th>Email</th>
                <th>Notifications</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}
