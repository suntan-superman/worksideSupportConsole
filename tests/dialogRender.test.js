import { describe, expect, it } from "vitest";
import { renderConfirmDialog, renderInactivityWarningDialog } from "../src/render/dialogs.js";

const escapeHtml = (value) => String(value ?? "").replace(/</g, "&lt;");

describe("dialog render helpers", () => {
  it("renders confirm dialog actions and escapes text", () => {
    const html = renderConfirmDialog({
      dialog: {
        open: true,
        title: "<Confirm>",
        lines: ["Line one"],
        confirmLabel: "Do it",
        cancelLabel: "Back",
        confirmTone: "warning",
      },
      escapeHtml,
    });

    expect(html).toContain("&lt;Confirm>");
    expect(html).toContain("Line one");
    expect(html).toContain("button-warning");
    expect(html).toContain("Do it");
    expect(html).toContain("Back");
  });

  it("renders inactivity warning countdown", () => {
    const html = renderInactivityWarningDialog({
      warning: { open: true, remainingSeconds: 300 },
      formatDuration: () => "5 minutes",
      escapeHtml,
    });

    expect(html).toContain("Inactivity Warning");
    expect(html).toContain("automatically logged out");
    expect(html).toContain("5 minutes");
    expect(html).toContain("Stay Signed In");
  });
});
