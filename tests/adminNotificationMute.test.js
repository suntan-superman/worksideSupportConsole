import { describe, expect, it } from "vitest";
import {
  adminAlertMuteUntil,
  adminAlertResumeAt,
  isAdminNotificationMuteActive,
  shouldPlayConsoleAlert,
} from "../src/services/adminNotificationMute.js";

describe("admin notification mute controls", () => {
  it("suppresses console alert sounds for active all and console-sound mutes", () => {
    const now = Date.parse("2026-11-17T23:00:00.000Z");
    const mutedUntil = new Date(now + 60_000).toISOString();
    expect(shouldPlayConsoleAlert({ mutedUntil, channel: "all", now })).toBe(false);
    expect(shouldPlayConsoleAlert({ mutedUntil, channel: "console_sound", now })).toBe(false);
    expect(shouldPlayConsoleAlert({ mutedUntil, channel: "email", now })).toBe(true);
  });

  it("allows alerts after the mute expires or is explicitly resumed", () => {
    const now = Date.parse("2026-11-17T23:00:00.000Z");
    expect(isAdminNotificationMuteActive(new Date(now - 1).toISOString(), now)).toBe(false);
    expect(shouldPlayConsoleAlert({ mutedUntil: new Date(now - 1).toISOString(), now })).toBe(true);
    expect(isAdminNotificationMuteActive(adminAlertResumeAt(now), now)).toBe(false);
  });

  it("creates a bounded future mute timestamp", () => {
    const now = Date.parse("2026-11-17T23:00:00.000Z");
    expect(adminAlertMuteUntil(60, now)).toBe(new Date(now + 60 * 60_000).toISOString());
  });
});
