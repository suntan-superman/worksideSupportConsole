diff --git a/src/services/api.js b/src/services/api.js
index 1111111..2222222 100644
--- a/src/services/api.js
+++ b/src/services/api.js
@@ -62,6 +62,43 @@ async function parsePayload(response) {
   }
 }
 
+function extractBackendError(payload) {
+  if (!payload || typeof payload !== "object") {
+    return null;
+  }
+
+  // Shape A (nested): { error: { message, code, requiredAction, ... } }
+  if (payload.error && typeof payload.error === "object") {
+    return payload.error;
+  }
+
+  // Shape B (flat): { error: "message", code, details: { requiredAction, ... } }
+  const details = payload.details && typeof payload.details === "object" ? payload.details : null;
+  const message =
+    (typeof payload.error === "string" ? payload.error : null) ||
+    (typeof payload.message === "string" ? payload.message : null) ||
+    null;
+
+  const code = typeof payload.code === "string" ? payload.code : null;
+  const requiredAction =
+    (typeof payload.requiredAction === "string" ? payload.requiredAction : null) ||
+    (typeof details?.requiredAction === "string" ? details.requiredAction : null) ||
+    null;
+  const missingFields = Array.isArray(payload.missingFields)
+    ? payload.missingFields
+    : Array.isArray(details?.missingFields)
+      ? details.missingFields
+      : [];
+  const sessionId =
+    (typeof payload.sessionId === "string" ? payload.sessionId : null) ||
+    (typeof details?.sessionId === "string" ? details.sessionId : null) ||
+    null;
+
+  return {
+    message,
+    code,
+    requiredAction,
+    missingFields,
+    sessionId,
+  };
+}
+
 export async function request(path, options = {}) {
   const {
     method = "GET",
@@ -91,18 +128,14 @@ export async function request(path, options = {}) {
 
   const payload = await parsePayload(response);
   if (!response.ok) {
-    const backendError =
-      payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
-        ? payload.error
-        : null;
+    const backendError = extractBackendError(payload);
     const message =
       backendError?.message ||
-      (payload && typeof payload === "object" && payload.message) ||
       response.statusText ||
       "Request failed";
     throw new ApiError(message, response.status, payload, {
       code: backendError?.code,
       requiredAction: backendError?.requiredAction,
-      missingFields: Array.isArray(backendError?.missingFields) ? backendError?.missingFields : [],
+      missingFields: backendError?.missingFields ?? [],
       sessionId: backendError?.sessionId,
     });
   }
diff --git a/src/services/chatErrors.js b/src/services/chatErrors.js
index 3333333..4444444 100644
--- a/src/services/chatErrors.js
+++ b/src/services/chatErrors.js
@@ -1,12 +1,52 @@
 import { ApiError } from "./api";
 
+function normalizeErrorCode(code) {
+  const raw = String(code ?? "").trim();
+  if (!raw) return null;
+  return raw.replace(/[\s-]+/g, "_").toUpperCase();
+}
+
+function normalizeRequiredAction(action) {
+  const raw = String(action ?? "").trim();
+  if (!raw) return null;
+  return raw.replace(/[\s-]+/g, "_").toLowerCase();
+}
+
+function resolveBackendError(payload) {
+  if (!payload || typeof payload !== "object") {
+    return null;
+  }
+
+  if (payload.error && typeof payload.error === "object") {
+    return payload.error;
+  }
+
+  const details = payload.details && typeof payload.details === "object" ? payload.details : null;
+  return {
+    message:
+      (typeof payload.error === "string" ? payload.error : null) ||
+      (typeof payload.message === "string" ? payload.message : null) ||
+      null,
+    code:
+      (typeof payload.code === "string" ? payload.code : null) ||
+      (typeof details?.code === "string" ? details.code : null) ||
+      null,
+    requiredAction:
+      (typeof payload.requiredAction === "string" ? payload.requiredAction : null) ||
+      (typeof details?.requiredAction === "string" ? details.requiredAction : null) ||
+      null,
+    missingFields: Array.isArray(payload.missingFields)
+      ? payload.missingFields
+      : Array.isArray(details?.missingFields)
+        ? details.missingFields
+        : [],
+    sessionId:
+      (typeof payload.sessionId === "string" ? payload.sessionId : null) ||
+      (typeof details?.sessionId === "string" ? details.sessionId : null) ||
+      null,
+  };
+}
+
 export function parseChatApiError(error) {
   const payload = error?.details ?? null;
-  const backendError =
-    payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
-      ? payload.error
-      : null;
-
-  const code = backendError?.code ?? error?.code ?? null;
-  const requiredAction = backendError?.requiredAction ?? error?.requiredAction ?? null;
+  const backendError = resolveBackendError(payload);
+  const code = normalizeErrorCode(backendError?.code ?? error?.code);
+  const requiredAction = normalizeRequiredAction(backendError?.requiredAction ?? error?.requiredAction);
   const missingFields = Array.isArray(backendError?.missingFields)
     ? backendError.missingFields
     : Array.isArray(error?.missingFields)
@@ -14,7 +54,7 @@ export function parseChatApiError(error) {
       : [];
 
   const sessionId = backendError?.sessionId ?? error?.sessionId ?? null;
-  const message =
+  const message =
     backendError?.message ??
     (payload && typeof payload === "object" && typeof payload.message === "string" ? payload.message : null) ??
     (typeof error?.message === "string" ? error.message : "Request failed");
@@ -30,10 +70,13 @@ export function parseChatApiError(error) {
 }
 
 export function isAuthErrorCode(code) {
-  return code === "AUTH_REQUIRED" || code === "INVALID_AUTH_TOKEN";
+  return (
+    code === "AUTH_REQUIRED" ||
+    code === "INVALID_AUTH_TOKEN" ||
+    code === "UNAUTHORIZED" ||
+    code === "AUTH_UNAVAILABLE"
+  );
 }
 
 export function shouldRefreshSession(requiredAction, code) {
-  return requiredAction === "refresh_session" || code === "INVALID_SESSION_STATE";
+  return normalizeRequiredAction(requiredAction) === "refresh_session" || normalizeErrorCode(code) === "INVALID_SESSION_STATE";
 }
diff --git a/src/services/chat.js b/src/services/chat.js
index 5555555..6666666 100644
--- a/src/services/chat.js
+++ b/src/services/chat.js
@@ -395,12 +395,18 @@ export async function sendAgentReply({ sessionId, tenantId, product, message, a
 
   return ensureDetail(normalizeSessionAndMessages(payload), sessionId, tenantId, product);
 }
 
-export async function closeSupportSession({ sessionId, tenantId, product, reason }) {
+export async function closeSupportSession({
+  sessionId,
+  tenantId,
+  product,
+  reason,
+  resolutionNote,
+  confirmNoFollowUp,
+}) {
   const body = {
     tenantId,
     product,
-    resolutionNote: reason,
     reason,
   };
+  if (resolutionNote) body.resolutionNote = resolutionNote;
+  if (typeof confirmNoFollowUp === "boolean") body.confirmNoFollowUp = confirmNoFollowUp;
 
   const payload = await requestSupport(
     `/support/sessions/${sessionId}/close`,
diff --git a/src/main.js b/src/main.js
index 7777777..8888888 100644
--- a/src/main.js
+++ b/src/main.js
@@ -54,6 +54,7 @@ const ACCESS_DENIED_CODES = new Set([
   "PRODUCT_ACCESS_DENIED",
   "TENANT_ACCESS_DENIED",
   "GLOBAL_SCOPE_NOT_ALLOWED",
+  "FILTER_ACCESS_DENIED",
 ]);
 const POLLING_INTERVAL_MS = 5000;
@@ -537,6 +538,16 @@ async function handleChatApiError(contextLabel, error) {
     );
     return;
   }
+
+  if (parsed.code === "ANONYMOUS_CLOSE_NOT_ALLOWED" || parsed.requiredAction === "contact_admin") {
+    setBanner(
+      "warning",
+      "Close No Follow-up is not enabled for this tenant. Ask an admin to enable allowAnonymousNoFollowUpClose.",
+    );
+    return;
+  }
 
   if (parsed.requiredAction === "collect_lead" || parsed.code === "LEAD_CAPTURE_REQUIRED") {
     state.showDiagnostics = true;
@@ -1243,6 +1254,8 @@ async function handleCloseNoFollowUp() {
     const detail = await closeSupportSession({
       sessionId: state.selectedSessionId,
       reason: "anonymous_no_follow_up",
+      resolutionNote: "No follow-up required",
+      confirmNoFollowUp: true,
     });
 
     clearAuthBlockedState();
