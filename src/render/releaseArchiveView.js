function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

export function renderReleaseArchiveView({ releases = [], escapeHtml } = {}) {
  if (!releases.length) {
    return `<section class="operations-panel"><h2>Release Archive</h2><p>No release archive records are available.</p></section>`;
  }

  return `
    <section class="operations-panel">
      <h2>Release Archive</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Date</th><th>Version</th><th>Score</th><th>Recommendation</th><th>Artifacts</th></tr>
          </thead>
          <tbody>
            ${releases
              .map(
                (release) => `
                  <tr>
                    <td>${safe(release.date || "Unknown", escapeHtml)}</td>
                    <td>${safe(release.version || release.id || "Unknown", escapeHtml)}</td>
                    <td>${release.readinessScore ?? "N/A"}</td>
                    <td>${safe(release.recommendation || "Unknown", escapeHtml)}</td>
                    <td>
                      ${release.htmlUrl ? `<a href="${safe(release.htmlUrl, escapeHtml)}" target="_blank" rel="noreferrer">HTML</a>` : ""}
                      ${release.jsonUrl ? `<a href="${safe(release.jsonUrl, escapeHtml)}" target="_blank" rel="noreferrer">JSON</a>` : ""}
                      ${release.pdfUrl ? `<a href="${safe(release.pdfUrl, escapeHtml)}" target="_blank" rel="noreferrer">PDF</a>` : ""}
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
