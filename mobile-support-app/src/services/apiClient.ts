import { API_BASE_URL } from "@/services/config";

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  auth?: boolean;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const token = options.auth === false ? null : tokenGetter ? await tokenGetter() : null;

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload: any = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload?.error === "string" ? payload.error : null) ||
      `Request failed (${response.status})`;

    const error = new Error(errorMessage) as Error & {
      code?: string;
      requiredAction?: string;
      details?: unknown;
    };

    error.code = payload?.error?.code || payload?.code;
    error.requiredAction = payload?.error?.requiredAction || payload?.requiredAction;
    error.details = payload?.details;
    throw error;
  }

  return payload as T;
}
