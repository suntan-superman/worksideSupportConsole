import { describe, expect, it } from "vitest";
import {
  notificationStatusLabel,
  renderRoutingNotificationsPanel,
  renderSessionOperationsSummary,
} from "../src/render/routingNotifications.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

describe("routing and notification render helpers", () => {
  it("normalizes notification status labels", () => {
    expect(notificationStatusLabel("sent_email")).toBe("sent email");
    expect(notificationStatusLabel("")).toBe("Unknown");
  });

  it("renders operations summary with assignment, routing, and transcript status", () => {
    const html = renderSessionOperationsSummary({
      session: {
        latestAssignment: {
          assignedToName: "<Agent>",
          departmentLabel: "Support",
          assignedAt: "2026-05-03T18:00:00.000Z",
          note: "VIP queue",
        },
        routingStatus: "assigned_to_human",
        availabilityOutcome: "available_agent_found",
        lastTranscriptSentAt: "2026-05-03T18:05:00.000Z",
        lastTranscriptSentTo: "lead@example.com",
      },
      formatTimestamp: () => "May 3, 6:00 PM",
      escapeHtml,
      isSessionEscalated: () => false,
    });

    expect(html).toContain("&lt;Agent&gt;");
    expect(html).toContain("Updated May 3, 6:00 PM");
    expect(html).toContain("assigned to human");
    expect(html).toContain("available agent found");
    expect(html).toContain("To lead@example.com");
  });

  it("renders routing notifications with timeline attempts", () => {
    const html = renderRoutingNotificationsPanel({
      session: {
        assignedToEmail: "agent@example.com",
        departmentLabel: "Support",
        routingStatus: "waiting_acceptance",
        availabilityOutcome: "notification_sent",
        notificationStatus: { attempted: true, reason: "Email dispatched" },
        notificationTimeline: [
          {
            channel: "email",
            recipient: "<lead@example.com>",
            status: "provider_accepted",
            attemptedAt: "2026-05-03T18:01:00.000Z",
            provider: "mailgun",
          },
        ],
      },
      formatTimestamp: () => "May 3, 6:01 PM",
      escapeHtml,
    });

    expect(html).toContain("Routing / Notifications");
    expect(html).toContain("waiting acceptance");
    expect(html).toContain("agent@example.com");
    expect(html).toContain("Email dispatched");
    expect(html).toContain("email to &lt;lead@example.com&gt;");
    expect(html).toContain("provider accepted");
    expect(html).toContain("May 3, 6:01 PM");
  });

  it("renders an empty timeline state", () => {
    const html = renderRoutingNotificationsPanel({
      session: { notificationStatus: { muted: true } },
      escapeHtml,
    });

    expect(html).toContain("Not attempted");
    expect(html).toContain("Muted");
    expect(html).toContain("No notification attempts have been recorded");
  });
});
