import { describe, expect, it } from "vitest";
import { __testing } from "../src/services/chat.js";
import { ApiError } from "../src/services/api.js";
import { parseChatApiError } from "../src/services/chatErrors.js";

const { normalizeAvailability, normalizeSession, normalizeSessionAndMessages, normalizeSessionList } = __testing;

describe("support chat normalization", () => {
  it("maps canonical and legacy session statuses", () => {
    expect(normalizeSession({ id: "s1", status: "ai" }).status).toBe("active_ai");
    expect(normalizeSession({ id: "s2", status: "pending_human" }).status).toBe("escalated");
    expect(normalizeSession({ id: "s3", status: "human_active" }).status).toBe("active_human");
    expect(normalizeSession({ id: "s4", status: "resolved" }).status).toBe("closed");
  });

  it("treats transfer request variants as escalated", () => {
    expect(normalizeSession({ id: "s1", status: "active_ai", support: { agentNotified: true } }).status).toBe(
      "escalated",
    );
    expect(normalizeSession({ id: "s2", transfer: { status: "agent_notified" } }).status).toBe("escalated");
    expect(normalizeSession({ id: "s3", handoff: { requested: "yes" } }).transferRequested).toBe(true);
  });

  it("normalizes routing, assigned user, and notification timeline fields", () => {
    const session = normalizeSession({
      id: "s1",
      tenantId: "tenantA",
      product: "merxus",
      support: {
        routing: {
          status: "assigned",
          availabilityOutcome: "available_agent_found",
          notificationStatus: {
            attempted: true,
            muted: false,
            channelResults: [
              {
                channel: "sms",
                recipient: "+15555551212",
                status: "sent",
                provider: "twilio",
                attemptedAt: "2026-05-03T10:42:00.000Z",
              },
              {
                channel: "email",
                recipient: "stan@example.com",
                status: "skipped",
                reason: "admin_notification_mute",
              },
            ],
          },
        },
      },
      assignedTo: { id: "userA", name: "Stan Roy", email: "stan@example.com" },
      departmentId: "sales",
      departmentLabel: "Sales",
    });

    expect(session).toMatchObject({
      routingStatus: "assigned",
      availabilityOutcome: "available_agent_found",
      assignedToUserId: "userA",
      assignedToName: "Stan Roy",
      assignedToEmail: "stan@example.com",
      departmentId: "sales",
      departmentLabel: "Sales",
      notificationStatus: {
        attempted: true,
        muted: false,
      },
    });
    expect(session.notificationTimeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "sms", status: "sent", recipient: "+15555551212" }),
        expect.objectContaining({ channel: "email", status: "skipped", reason: "admin_notification_mute" }),
      ]),
    );
  });

  it("normalizes support notes, transcript receipts, and lead/contact fallbacks", () => {
    const { session, messages } = normalizeSessionAndMessages({
      session: {
        id: "s1",
        tenantId: "tenantA",
        product: "merxus",
        contact: { name: "Ada Lovelace", email: "ada@example.com", phone: "5551231212" },
        support: {
          lastTranscript: { sentAt: "2026-05-03T11:00:00.000Z", to: "ada@example.com", provider: "sendgrid" },
          notes: [{ note: "Called once.", createdByName: "Stan", createdAt: "2026-05-03T11:05:00.000Z" }],
        },
      },
      messages: [{ sender: "customer", body: "Hello", createdAt: "2026-05-03T10:00:00.000Z" }],
    });

    expect(session.leadName).toBe("Ada Lovelace");
    expect(session.leadEmail).toBe("ada@example.com");
    expect(session.lastTranscriptSentTo).toBe("ada@example.com");
    expect(session.lastTranscriptProvider).toBe("sendgrid");
    expect(session.supportNotes[0]).toMatchObject({ note: "Called once.", createdByName: "Stan" });
    expect(messages[0]).toMatchObject({ sender: "visitor", body: "Hello" });
  });

  it("normalizes availability effective status from backend routing model", () => {
    expect(
      normalizeAvailability({
        availability: {
          status: "available",
          effectiveStatus: "stale",
          heartbeatAgeSeconds: 301,
          assignable: false,
          blockedReason: "stale_heartbeat",
        },
      }),
    ).toMatchObject({
      status: "available",
      effectiveStatus: "stale",
      heartbeatAgeSeconds: 301,
      assignable: false,
      blockedReason: "stale_heartbeat",
    });
  });

  it("normalizes list payloads and structured API errors", () => {
    expect(normalizeSessionList({ sessions: [{ _id: "s1", status: "open" }] })).toMatchObject([
      { id: "s1", status: "active_ai" },
    ]);

    const error = new ApiError(
      "Request failed",
      422,
      {
        ok: false,
        error: {
          code: "LEAD_CAPTURE_REQUIRED",
          message: "Name and email are required.",
          requiredAction: "collect_lead",
          missingFields: ["name", "email"],
        },
      },
      {},
    );
    expect(parseChatApiError(error)).toMatchObject({
      status: 422,
      code: "LEAD_CAPTURE_REQUIRED",
      requiredAction: "collect_lead",
      missingFields: ["name", "email"],
      message: "Name and email are required.",
    });
  });
});
