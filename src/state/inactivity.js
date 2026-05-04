export function defaultInactivityWarning() {
  return {
    open: false,
    logoutAt: 0,
    remainingSeconds: 0,
  };
}

export function buildInactivityWarning({ now = Date.now(), warningMs }) {
  return {
    open: true,
    logoutAt: now + warningMs,
    remainingSeconds: Math.ceil(warningMs / 1000),
  };
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (minutes <= 0) return `${remainder} second${remainder === 1 ? "" : "s"}`;
  if (remainder === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function getInactivityCheckResult({
  isAuthenticated,
  autoLogoutEnabled,
  warning,
  lastActivityAt,
  now = Date.now(),
  idleMs,
}) {
  if (!isAuthenticated || !autoLogoutEnabled) {
    return { action: "idle" };
  }

  if (warning?.open) {
    const remainingSeconds = Math.max(0, Math.ceil((warning.logoutAt - now) / 1000));
    if (remainingSeconds <= 0) {
      return { action: "logout", remainingSeconds };
    }
    if (remainingSeconds !== warning.remainingSeconds) {
      return { action: "update_countdown", remainingSeconds };
    }
    return { action: "idle" };
  }

  if (now - Number(lastActivityAt || 0) >= idleMs) {
    return { action: "warn" };
  }

  return { action: "idle" };
}
