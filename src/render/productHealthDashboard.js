function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

export function renderProductHealthDashboard({ products = [], escapeHtml } = {}) {
  const rows = products.length
    ? products
        .map(
          (product) => `
            <tr>
              <td>${safe(product.label, escapeHtml)}</td>
              <td><span class="badge">${safe(product.status, escapeHtml)}</span></td>
              <td>${safe(product.latestRelease || "Unknown", escapeHtml)}</td>
              <td>${safe(product.qa, escapeHtml)}</td>
              <td>${safe(product.meta, escapeHtml)}</td>
              <td>${safe(product.stripe, escapeHtml)}</td>
              <td>${safe(product.auth, escapeHtml)}</td>
              <td>${safe(product.email, escapeHtml)}</td>
              <td>${safe(product.notifications, escapeHtml)}</td>
              <td>${product.latestReportUrl ? `<a href="${safe(product.latestReportUrl, escapeHtml)}" target="_blank" rel="noreferrer">Open</a>` : "N/A"}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="10">No product health records are available.</td></tr>`;

  return `
    <section class="operations-panel">
      <header class="section-heading">
        <h2>Product Health</h2>
      </header>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th>Latest Release</th>
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
    </section>
  `;
}
