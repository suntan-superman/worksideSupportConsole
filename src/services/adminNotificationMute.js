const CONSOLE_ALERT_CHANNELS = new Set(["all", "console_sound"]);

export function isAdminNotificationMuteActive(mutedUntil, now = Date.now()) {
  const timestamp = Date.parse(String(mutedUntil ?? "").trim());
  return Number.isFinite(timestamp) && timestamp > now;
}

export function shouldPlayConsoleAlert({ mutedUntil = "", channel = "all", now = Date.now() } = {}) {
  return !isAdminNotificationMuteActive(mutedUntil, now)
    || !CONSOLE_ALERT_CHANNELS.has(String(channel ?? "all").trim().toLowerCase());
}

export function adminAlertMuteUntil(minutes, now = Date.now()) {
  return new Date(now + Math.max(1, Number(minutes) || 60) * 60_000).toISOString();
}

export function adminAlertResumeAt(now = Date.now()) {
  // Use an already-expired timestamp so the existing authorized mute endpoint
  // clears the persisted mute without requiring a new backend route.
  return new Date(now - 60_000).toISOString();
}
