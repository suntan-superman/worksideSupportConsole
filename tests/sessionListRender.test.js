import { describe, expect, it } from "vitest";
import { renderMessages, renderSessionList } from "../src/render/sessionList.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

describe("session list render helpers", () => {
  it("renders loading, access denied, and empty states", () => {
    expect(renderSessionList({ sessions: [], loadingSessions: true })).toContain("Loading sessions");
    expect(renderSessionList({ sessions: [], accessDenied: true })).toContain("does not have access");
    expect(renderSessionList({ sessions: [] })).toContain("No conversations match");
  });

  it("renders session cards with labels, status, and selected state", () => {
    const html = renderSessionList({
      sessions: [
        {
          id: "s1",
          status: "escalated",
          productKey: "merxus",
          tenantName: "Tenant A",
          leadEmail: "ada@example.com",
          inquiryUrgency: "high",
          assignedToName: "Stan Roy",
          updatedAt: "2026-05-03T18:00:00.000Z",
        },
      ],
      selectedSessionId: "s1",
      inferredContactNameForSession: () => "",
      hasRequiredLeadIdentity: () => false,
      abbreviateMiddle: (value) => value,
      productLabelFromKey: () => "Merxus AI",
      statusClass: () => "badge badge-escalated",
      statusLabel: () => "Needs Human",
      formatTimestamp: () => "May 3, 6:00 PM",
      escapeHtml,
    });

    expect(html).toContain("is-selected");
    expect(html).toContain('data-testid="session-row"');
    expect(html).toContain("ada@example.com");
    expect(html).toContain("Needs Human");
    expect(html).toContain("Merxus AI");
    expect(html).toContain("Lead missing");
    expect(html).toContain("Stan Roy");
  });

  it("renders messages and escapes unsafe bodies", () => {
    const html = renderMessages({
      messages: [{ sender: "visitor", body: "<hello>", createdAt: "2026-05-03T18:00:00.000Z" }],
      formatTimestamp: () => "May 3, 6:00 PM",
      escapeHtml,
    });

    expect(html).toContain("Visitor");
    expect(html).toContain("&lt;hello&gt;");
    expect(html).toContain("May 3, 6:00 PM");
  });
});
