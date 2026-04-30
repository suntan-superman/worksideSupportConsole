import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { request } from "./api";

const TOKEN_STORAGE_KEY = "workside_support_auth_token";
const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

let authInstance = null;
let authBridgeInitialized = false;

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function hasFirebaseAuthConfig() {
  return REQUIRED_FIREBASE_KEYS.every((key) => {
    const value = import.meta.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function getFirebaseAuth() {
  if (!hasFirebaseAuthConfig()) return null;
  if (authInstance) return authInstance;

  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  authInstance = getAuth(app);
  return authInstance;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

export function setStoredToken(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
}

export async function initializeAuthBridge() {
  const auth = getFirebaseAuth();
  if (!auth) return;

  window.firebaseAuth = auth;

  if (authBridgeInitialized) return;
  authBridgeInitialized = true;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      setStoredToken(token);
    } catch {
      // Token refresh can fail transiently; request layer handles missing token.
    }
  });

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      setStoredToken(token);
    } catch {
      // Ignore and let user re-authenticate.
    }
  }
}

export async function signInWithFirebaseCredentials(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase auth is not configured in environment variables.");
  }

  const result = await signInWithEmailAndPassword(auth, email, password);
  const token = await result.user.getIdToken(true);
  setStoredToken(token);
  return token;
}

export async function sendFirebasePasswordReset(email) {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase auth is not configured in environment variables.");
  }
  await sendPasswordResetEmail(auth, String(email ?? "").trim());
}

export async function sendLoginOtp(email) {
  return request("/auth/otp/send", {
    method: "POST",
    body: {
      email: String(email ?? "").trim(),
      purpose: "support_console_login",
    },
  });
}

export async function verifyLoginOtp(email, code) {
  const payload = await request("/auth/otp/verify", {
    method: "POST",
    body: {
      email: String(email ?? "").trim(),
      code: String(code ?? "").trim(),
      purpose: "support_console_login",
    },
  });
  const customToken = payload?.customToken ?? payload?.firebaseCustomToken ?? payload?.data?.customToken;
  if (customToken) {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error("Firebase auth is not configured in environment variables.");
    }
    const result = await signInWithCustomToken(auth, customToken);
    const idToken = await result.user.getIdToken(true);
    setStoredToken(idToken);
    return idToken;
  }

  const token = payload?.token ?? payload?.idToken ?? payload?.firebaseIdToken ?? payload?.data?.token;
  if (token) {
    setStoredToken(token);
  }
  return token;
}

export async function refreshStoredFirebaseToken(force = false) {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user || typeof user.getIdToken !== "function") {
    return "";
  }

  const token = await user.getIdToken(Boolean(force));
  setStoredToken(token);
  return token;
}

export function getCurrentFirebaseUser() {
  const auth = getFirebaseAuth();
  return auth?.currentUser ?? null;
}

export async function signOutAllAuth() {
  setStoredToken("");
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    await signOut(auth);
  }
}
