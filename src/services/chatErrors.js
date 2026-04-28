import { ApiError } from "./api";

export function parseChatApiError(error) {
  const payload = error?.details ?? null;
  const backendError =
    payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
      ? payload.error
      : null;

  const code = backendError?.code ?? error?.code ?? null;
  const requiredAction = backendError?.requiredAction ?? error?.requiredAction ?? null;
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
  return code === "AUTH_REQUIRED" || code === "INVALID_AUTH_TOKEN";
}

export function shouldRefreshSession(requiredAction, code) {
  return requiredAction === "refresh_session" || code === "INVALID_SESSION_STATE";
}
