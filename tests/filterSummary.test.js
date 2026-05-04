import { describe, expect, it } from "vitest";
import { hasActiveSupportFilters, renderActiveFilterSummary } from "../src/render/filterSummary.js";

const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

describe("filter summary render helper", () => {
  it("detects active filters and search text", () => {
    expect(hasActiveSupportFilters({ filters: {}, search: "" })).toBe(false);
    expect(hasActiveSupportFilters({ filters: { product: "merxus" }, search: "" })).toBe(true);
    expect(hasActiveSupportFilters({ filters: {}, search: "Ada" })).toBe(true);
  });

  it("renders labels and clear action for active filters", () => {
    const html = renderActiveFilterSummary({
      filters: {
        product: "merxus",
        tenantId: "tenantA",
        status: "escalated",
        urgency: "",
        assignedTo: "agentA",
      },
      search: "Ada",
      products: [{ id: "merxus", label: "Merxus AI" }],
      tenants: [{ id: "tenantA", name: "Tenant A" }],
      supportUsers: [{ id: "agentA", name: "Stan Roy" }],
      productLabelFromKey: (value) => value,
      statusLabel: (value) => (value === "escalated" ? "Needs Human" : value),
      escapeHtml,
    });

    expect(html).toContain("Product = Merxus AI");
    expect(html).toContain("Tenant = Tenant A");
    expect(html).toContain("Status = Needs Human");
    expect(html).toContain("Assigned = Stan Roy");
    expect(html).toContain("Search = Ada");
    expect(html).toContain("clear-filters-button");
  });
});
