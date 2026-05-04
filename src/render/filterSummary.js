function supportUserLabelFromId(value, supportUsers = []) {
  const selected = String(value ?? "").trim();
  if (!selected) return "All";
  if (selected === "unassigned") return "Unassigned";
  const normalized = selected.toLowerCase();
  const user = supportUsers.find((item) => {
    return (
      String(item.id ?? "").toLowerCase() === normalized ||
      String(item.email ?? "").toLowerCase() === normalized ||
      String(item.name ?? "").toLowerCase() === normalized
    );
  });
  return user?.name || user?.email || selected;
}

function tenantLabelFromId(value, tenants = []) {
  const selected = String(value ?? "").trim();
  if (!selected) return "All";
  return tenants.find((item) => item.id === selected)?.name || selected;
}

function productFilterLabel(value, products = [], productLabelFromKey = (item) => item) {
  const selected = String(value ?? "").trim();
  if (!selected) return "All";
  return products.find((item) => item.id === selected)?.label || productLabelFromKey(selected);
}

export function hasActiveSupportFilters({ filters = {}, search = "" } = {}) {
  return Boolean(
    filters.product ||
      filters.tenantId ||
      filters.status ||
      filters.urgency ||
      filters.assignedTo ||
      String(search ?? "").trim(),
  );
}

export function renderActiveFilterSummary({
  filters = {},
  search = "",
  products = [],
  tenants = [],
  supportUsers = [],
  productLabelFromKey,
  statusLabel,
  escapeHtml,
} = {}) {
  const safeEscape = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value ?? "");
  const safeProductLabel = typeof productLabelFromKey === "function" ? productLabelFromKey : (value) => value;
  const safeStatusLabel = typeof statusLabel === "function" ? statusLabel : (value) => value || "All";
  const trimmedSearch = String(search ?? "").trim();
  const parts = [
    `Product = ${productFilterLabel(filters.product, products, safeProductLabel)}`,
    `Tenant = ${tenantLabelFromId(filters.tenantId, tenants)}`,
    `Status = ${filters.status ? safeStatusLabel(filters.status) : "All"}`,
    `Urgency = ${filters.urgency || "All"}`,
    `Assigned = ${supportUserLabelFromId(filters.assignedTo, supportUsers)}`,
  ];
  if (trimmedSearch) {
    parts.push(`Search = ${trimmedSearch}`);
  }
  return `
    <div class="filter-summary">
      <span>Filters: ${safeEscape(parts.join(" | "))}</span>
      ${
        hasActiveSupportFilters({ filters, search })
          ? `<button id="clear-filters-button" class="button button-compact button-quiet" type="button">Clear filters</button>`
          : ""
      }
    </div>
  `;
}
