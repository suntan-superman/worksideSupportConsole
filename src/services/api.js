const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const LOCAL_TOKEN_KEYS = [
  "workside_support_auth_token",
  "firebase_id_token",
  "auth_token",
];

export class ApiError extends Error {
  constructor(message, status, details = null, meta = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = meta.code;
    this.requiredAction = meta.requiredAction;
    this.missingFields = meta.missingFields;
    this.sessionId = meta.sessionId;
  }
}

function buildQuery(query) {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function buildUrl(path, query) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = buildQuery(query);
  if (!API_BASE_URL) {
    return `${normalizedPath}${queryString}`;
  }
  return `${API_BASE_URL}${normalizedPath}${queryString}`;
}

function getTokenFromFirebase() {
  const authRef = window?.firebaseAuth;
  const currentUser = authRef?.currentUser;
  if (!currentUser || typeof currentUser.getIdToken !== "function") {
    return Promise.resolve("");
  }

  return currentUser.getIdToken().catch(() => "");
}

function getTokenFromStorage() {
  for (const key of LOCAL_TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return "";
}

async function getAuthorizationToken() {
  const firebaseToken = await getTokenFromFirebase();
  if (firebaseToken) return firebaseToken;
  return getTokenFromStorage();
}

async function parsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request(path, options = {}) {
  const {
    method = "GET",
    query,
    body,
    headers,
    signal,
    allowTextResponse = true,
  } = options;

  const authToken = await getAuthorizationToken();

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await parsePayload(response);
  if (!response.ok) {
    const backendError =
      payload && typeof payload === "object" && payload.error && typeof payload.error === "object"
        ? payload.error
        : null;
    const message =
      backendError?.message ||
      (payload && typeof payload === "object" && payload.message) ||
      response.statusText ||
      "Request failed";
    throw new ApiError(message, response.status, payload, {
      code: backendError?.code,
      requiredAction: backendError?.requiredAction,
      missingFields: Array.isArray(backendError?.missingFields) ? backendError?.missingFields : [],
      sessionId: backendError?.sessionId,
    });
  }

  if (payload === null && !allowTextResponse) {
    return {};
  }

  return payload;
}
