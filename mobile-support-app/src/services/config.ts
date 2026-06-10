import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || Constants.manifest2?.extra || {};
const extraFirebase = (extra.firebaseConfig || {}) as Record<string, string | undefined>;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl || "https://api.merxus.ai";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || extraFirebase.apiKey || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || extraFirebase.authDomain || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || extraFirebase.projectId || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || extraFirebase.appId || ""
};

export function getFirebaseConfigDiagnostics() {
  return {
    apiKeyPresent: Boolean(firebaseConfig.apiKey),
    authDomain: firebaseConfig.authDomain || "(missing)",
    projectId: firebaseConfig.projectId || "(missing)",
    appIdPresent: Boolean(firebaseConfig.appId),
    appIdSuffix: firebaseConfig.appId ? firebaseConfig.appId.slice(-8) : "(missing)",
    source: extraFirebase && Object.keys(extraFirebase).length ? "expo-extra" : "process-env"
  };
}

export function assertFirebaseConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    const error = new Error(`Mobile Firebase config is missing: ${missing.join(", ")}.`) as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = "mobile/firebase-config-missing";
    error.details = getFirebaseConfigDiagnostics();
    throw error;
  }
}
