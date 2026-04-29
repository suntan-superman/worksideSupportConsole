import { ApiError } from "./api";

function normalizeErrorCode(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  return raw.replace(/[\s-]+/g, "_").toUpperCase();
}

function normalizeRequiredAction(action) {
  const raw = String(action ?? "").trim();
  if (!raw) return null;
  return raw.replace(/[\s-]+/g, "_").toLowerCase();
}

function resolveBackendError(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.error && typeof payload.error === "object") {
    return payload.error;
  }

  const details = payload.details && typeof payload.details === "object" ? payload.details : null;
  return {
    message:
      (typeof payload.error === "string" ? payload.error : null) ||
      (typeof payload.message === "string" ? payload.message : null) ||
      null,
    code:
      (typeof payload.code === "string" ? payload.code : null) ||
      (typeof details?.code === "string" ? details.code : null) ||
      null,
    requiredAction:
      (typeof payload.requiredAction === "string" ? payload.requiredAction : null) ||
      (typeof details?.requiredAction === "string" ? details.requiredAction : null) ||
      null,
    missingFields: Array.isArray(payload.missingFields)
      ? payload.missingFields
      : Array.isArray(details?.missingFields)
        ? details.missingFields
        : [],
    sessionId:
      (typeof payload.sessionId === "string" ? payload.sessionId : null) ||
      (typeof details?.sessionId === "string" ? details.sessionId : null) ||
      null,
  };
}

export function parseChatApiError(error) {
  const payload = error?.details ?? null;
  const backendError = resolveBackendError(payload);
  const code = normalizeErrorCode(backendError?.code ?? error?.code);
  const requiredAction = normalizeRequiredAction(backendError?.requiredAction ?? error?.requiredAction);
  const missingFields = Array.isArray(backendError?.missingFields)
    ? backendError.missingFields
    : Array.isArray(error?.missingFields)
      ? error.missingFields
      : [];

  const sessionId = backendError?.sessionId ?? error?.sessionId ?? null;
  const message =
    backendError?.message ??
    (payload && typeof payload === "object" && typeof payload.message === "string" ? payload.message : null) ??
    (typeof error?.message === "string" ? error.message : "Request failed");

  return {
    status: error?.status ?? null,
    code,
    requiredAction,
    missingFields,
    sessionId,
    message,
    isApiError: error instanceof ApiError,
  };
}

export function isAuthErrorCode(code) {
  return (
    code === "AUTH_REQUIRED" ||
    code === "INVALID_AUTH_TOKEN" ||
    code === "UNAUTHORIZED" ||
    code === "AUTH_UNAVAILABLE"
  );
}

export function shouldRefreshSession(requiredAction, code) {
  return normalizeRequiredAction(requiredAction) === "refresh_session" || normalizeErrorCode(code) === "INVALID_SESSION_STATE";
}
