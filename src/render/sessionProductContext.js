function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

export function renderSessionProductContext({ diagnostics, escapeHtml } = {}) {
  if (!diagnostics) return "";
  const health = diagnostics.health;
  const release = diagnostics.latestRelease;
  const warnings = diagnostics.warnings ?? [];

  return `
    <section class="detail-section">
      <h3>Product Context</h3>
      <div class="summary-grid">
        <div><span>Product</span><strong>${safe(diagnostics.product || "Unknown", escapeHtml)}</strong></div>
        <div><span>Health</span><strong>${safe(health?.status || "Unknown", escapeHtml)}</strong></div>
        <div><span>Latest Release</span><strong>${safe(release?.version || release?.id || "Unknown", escapeHtml)}</strong></div>
        <div><span>Readiness</span><strong>${release?.readinessScore ?? health?.readinessScore ?? "N/A"}</strong></div>
      </div>
      ${warnings.length ? `<ul>${warnings.map((warning) => `<li>${safe(warning, escapeHtml)}</li>`).join("")}</ul>` : ""}
    </section>
  `;
}
