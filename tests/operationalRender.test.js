import { describe, expect, it } from "vitest";
import { renderNotificationTimeline } from "../src/render/notificationTimeline.js";
import { renderProductHealthDashboard } from "../src/render/productHealthDashboard.js";
import { renderReleaseArchiveView } from "../src/render/releaseArchiveView.js";
import { renderSessionProductContext } from "../src/render/sessionProductContext.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

describe("operational platform render helpers", () => {
  it("renders product health rows with escaped labels and report links", () => {
    const html = renderProductHealthDashboard({
      escapeHtml,
      products: [
        {
          label: "<Merxus>",
          status: "healthy",
          latestRelease: "2026.06.28",
          qa: "healthy",
          meta: "unknown",
          stripe: "healthy",
          auth: "healthy",
          email: "healthy",
          notifications: "warning",
          latestReportUrl: "/reports/latest.html",
          updatedAt: "2026-11-17T18:00:00.000Z",
          freshness: "current",
        },
      ],
    });

    expect(html).toContain("Product Health");
    expect(html).toContain("&lt;Merxus&gt;");
    expect(html).toContain("2026.06.28");
    expect(html).toContain("/reports/latest.html");
    expect(html).toContain("Data Freshness");
  });

  it("warns when health is unavailable and rejects unsafe report links", () => {
    const html = renderProductHealthDashboard({
      escapeHtml,
      feedStatus: { state: "not_found", lastSuccessfulAt: "2026-11-17T17:00:00.000Z" },
      products: [
        {
          label: "Route Logistics",
          status: "unknown",
          latestRelease: "2.4.0",
          qa: "unknown",
          meta: "unknown",
          stripe: "unknown",
          auth: "unknown",
          email: "unknown",
          notifications: "unknown",
          latestReportUrl: "javascript:alert(1)",
        },
      ],
    });

    expect(html).toContain("The product health endpoint is unavailable.");
    expect(html).toContain("Last successful update:");
    expect(html).toContain("Route Logistics");
    expect(html).toContain("2.4.0");
    expect(html).toContain("N/A");
    expect(html).not.toContain("href=\"javascript:");
  });

  it("renders notification receipts without exposing raw objects", () => {
    const html = renderNotificationTimeline({
      escapeHtml,
      formatTimestamp: () => "Jun 28",
      receipts: [
        {
          channel: "email",
          status: "failed",
          provider: "sendgrid",
          recipientLabel: "<agent@example.com>",
          errorMessage: "provider rejected",
          attemptedAt: "2026-06-28T00:00:00.000Z",
        },
      ],
    });

    expect(html).toContain("Notifications");
    expect(html).toContain("email failed");
    expect(html).toContain("sendgrid | &lt;agent@example.com&gt; | provider rejected");
    expect(html).toContain("Jun 28");
  });

  it("renders release archive artifacts", () => {
    const html = renderReleaseArchiveView({
      escapeHtml,
      products: [{ id: "merxus", label: "Merxus AI" }],
      selectedProductId: "merxus",
      releases: [
        {
          date: "2026-06-28",
          version: "1.2.3",
          readinessScore: 95,
          recommendation: "deploy",
          htmlUrl: "/report.html",
          jsonUrl: "/report.json",
          pdfUrl: "/cert.pdf",
        },
      ],
    });

    expect(html).toContain("Release Archive");
    expect(html).toContain("release-archive-product");
    expect(html).toContain("Merxus AI");
    expect(html).toContain("1.2.3");
    expect(html).toContain("95");
    expect(html).toContain("PDF");
  });

  it("renders session product context warnings", () => {
    const html = renderSessionProductContext({
      escapeHtml,
      diagnostics: {
        product: "merxus",
        health: { status: "warning", readinessScore: 88 },
        latestRelease: { version: "2026.06.28", readinessScore: 91 },
        warnings: ["Product health is warning."],
      },
    });

    expect(html).toContain("Product Context");
    expect(html).toContain("merxus");
    expect(html).toContain("warning");
    expect(html).toContain("2026.06.28");
    expect(html).toContain("Product health is warning.");
  });
});
