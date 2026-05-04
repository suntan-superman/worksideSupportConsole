import { describe, expect, it } from "vitest";
import {
  buildInactivityWarning,
  defaultInactivityWarning,
  formatDuration,
  getInactivityCheckResult,
} from "../src/state/inactivity.js";

describe("inactivity state helpers", () => {
  it("builds default and active warning state", () => {
    expect(defaultInactivityWarning()).toEqual({
      open: false,
      logoutAt: 0,
      remainingSeconds: 0,
    });

    expect(buildInactivityWarning({ now: 1000, warningMs: 300000 })).toEqual({
      open: true,
      logoutAt: 301000,
      remainingSeconds: 300,
    });
  });

  it("formats countdown durations", () => {
    expect(formatDuration(1)).toBe("1 second");
    expect(formatDuration(59)).toBe("59 seconds");
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(299)).toBe("4:59");
  });

  it("ignores checks when auth or auto logout is disabled", () => {
    expect(
      getInactivityCheckResult({
        isAuthenticated: false,
        autoLogoutEnabled: true,
        now: 2000,
        lastActivityAt: 0,
        idleMs: 1000,
      }),
    ).toEqual({ action: "idle" });

    expect(
      getInactivityCheckResult({
        isAuthenticated: true,
        autoLogoutEnabled: false,
        now: 2000,
        lastActivityAt: 0,
        idleMs: 1000,
      }),
    ).toEqual({ action: "idle" });
  });

  it("requests warning, countdown updates, and logout", () => {
    expect(
      getInactivityCheckResult({
        isAuthenticated: true,
        autoLogoutEnabled: true,
        now: 3000,
        lastActivityAt: 1000,
        idleMs: 1000,
      }),
    ).toEqual({ action: "warn" });

    expect(
      getInactivityCheckResult({
        isAuthenticated: true,
        autoLogoutEnabled: true,
        now: 2000,
        warning: { open: true, logoutAt: 4000, remainingSeconds: 3 },
        idleMs: 1000,
      }),
    ).toEqual({ action: "update_countdown", remainingSeconds: 2 });

    expect(
      getInactivityCheckResult({
        isAuthenticated: true,
        autoLogoutEnabled: true,
        now: 5000,
        warning: { open: true, logoutAt: 4000, remainingSeconds: 1 },
        idleMs: 1000,
      }),
    ).toEqual({ action: "logout", remainingSeconds: 0 });
  });
});
