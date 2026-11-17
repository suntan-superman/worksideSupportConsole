function safe(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
}

function renderProductOptions({ products = [], selectedProductId = "", escapeHtml } = {}) {
  if (!products.length) return "";
  return products
    .map((product) => {
      const id = String(product.id ?? "").trim();
      if (!id) return "";
      const selected = id === selectedProductId ? "selected" : "";
      return `<option value="${safe(id, escapeHtml)}" ${selected}>${safe(product.label || id, escapeHtml)}</option>`;
    })
    .join("");
}

export function renderReleaseArchiveView({
  releases = [],
  products = [],
  selectedProductId = "",
  error = "",
  escapeHtml,
} = {}) {
  const productOptions = renderProductOptions({ products, selectedProductId, escapeHtml });
  const controls = productOptions
    ? `
      <div class="release-archive-controls">
        <label>
          Product
          <select id="release-archive-product">
            ${productOptions}
          </select>
        </label>
        <button id="release-archive-refresh-button" class="button button-compact" type="button">Refresh</button>
      </div>
    `
    : "";
  const errorMarkup = error ? `<p class="validation-note">${safe(error, escapeHtml)}</p>` : "";
  const body = !releases.length
    ? `<p>No release archive records are available.</p>`
    : `
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
    `;
  return `
    <section class="operations-panel">
      <div class="release-archive-header">
        <h2>Release Archive</h2>
        ${controls}
      </div>
      ${errorMarkup}
      ${body}
    </section>
  `;
}
