import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseError, getApp, getApps, initializeApp } from "firebase/app";
import {
  deleteUser,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User
} from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { assertFirebaseConfig, firebaseConfig, getFirebaseConfigDiagnostics } from "@/services/config";
import { setAuthTokenGetter } from "@/services/apiClient";
import { sendLoginOtp, verifyLoginOtp } from "@/services/authApi";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  migrateLegacyAuthToken,
  setStoredAuthToken
} from "@/services/secureTokenStorage";
import { revokeRegisteredPushToken } from "@/services/pushRegistration";

assertFirebaseConfig();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;
const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence ? getReactNativePersistence(AsyncStorage) : undefined
    });
  } catch (error: any) {
    if (error?.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw error;
  }
})();
const REMEMBER_EMAIL_KEY = "support_mobile_remember_email";

function toAuthError(error: unknown, action: string) {
  const firebaseError = error as FirebaseError & { details?: unknown };
  const code = firebaseError?.code || "unknown";
  const message = firebaseError?.message || "Unable to sign in.";
  const diagnostics = getFirebaseConfigDiagnostics();

  console.error(`[mobile-auth] ${action} failed`, {
    code,
    message,
    diagnostics
  });

  const friendly = new Error(
    `${message}\n\nCode: ${code}\nFirebase project: ${diagnostics.projectId}\nAuth domain: ${diagnostics.authDomain}\nApp ID suffix: ${diagnostics.appIdSuffix}`
  ) as Error & { code?: string; details?: unknown };
  friendly.code = code;
  friendly.details = {
    originalDetails: firebaseError?.details,
    diagnostics
  };
  return friendly;
}

type AuthContextValue = {
  user: User | null;
  authEmail: string;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const current = auth.currentUser;
      return current ? current.getIdToken() : authToken || (await getStoredAuthToken());
    });

    let unsubscribed = false;
    Promise.all([
      migrateLegacyAuthToken(),
      AsyncStorage.multiGet(["support_user_email", REMEMBER_EMAIL_KEY])
    ]).then(([storedToken, items]) => {
      if (unsubscribed) return;
      const storedEmail = items.find(([key]) => key === "support_user_email")?.[1] || "";
      const rememberedEmail = items.find(([key]) => key === REMEMBER_EMAIL_KEY)?.[1] || "";
      if (storedToken) setAuthToken(storedToken);
      if (storedEmail || rememberedEmail) {
        const fallbackEmail = storedEmail || rememberedEmail;
        setAuthEmail(fallbackEmail);
        if (!storedEmail) {
          AsyncStorage.setItem("support_user_email", fallbackEmail).catch(() => {});
        }
      }
      setLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const token = await nextUser.getIdToken();
        const nextEmail = nextUser.email || "";
        setAuthToken(token);
        if (nextEmail) {
          setAuthEmail(nextEmail);
          await setStoredAuthToken(token);
          await AsyncStorage.setItem("support_user_email", nextEmail);
        } else {
          await setStoredAuthToken(token);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribed = true;
      unsubscribe();
    };
  }, [authToken]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    authEmail,
    isAuthenticated: Boolean(user || authToken),
    loading,
    signIn: async (email, password) => {
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const token = await result.user.getIdToken(true);
        setAuthToken(token);
        setAuthEmail(result.user.email || email.trim());
        await setStoredAuthToken(token);
        await AsyncStorage.setItem("support_user_email", result.user.email || email.trim());
      } catch (error) {
        throw toAuthError(error, "password sign-in");
      }
    },
    requestOtp: async (email) => {
      await sendLoginOtp(email);
    },
    verifyOtp: async (email, code) => {
      const token = await verifyLoginOtp(email, code);
      if (!token) {
        throw new Error("OTP verification did not return a Firebase token.");
      }
      try {
        const result = await signInWithCustomToken(auth, token);
        const idToken = await result.user.getIdToken(true);
        setAuthToken(idToken);
        setAuthEmail(result.user.email || email.trim());
        await setStoredAuthToken(idToken);
        await AsyncStorage.setItem("support_user_email", result.user.email || email.trim());
      } catch (error) {
        console.warn("[mobile-auth] custom token sign-in failed; falling back to bearer token", {
          code: (error as FirebaseError)?.code || "unknown",
          diagnostics: getFirebaseConfigDiagnostics()
        });
        setAuthToken(token);
        setAuthEmail(email.trim());
        await setStoredAuthToken(token);
        await AsyncStorage.setItem("support_user_email", email.trim());
      }
    },
    deleteAccount: async () => {
      const current = auth.currentUser;
      if (!current) {
        throw new Error("Sign in with Firebase again before deleting this account.");
      }
      await deleteUser(current);
      setAuthToken("");
      setAuthEmail("");
      await clearStoredAuthToken();
      await AsyncStorage.removeItem("support_user_email");
    },
    signOut: async () => {
      await revokeRegisteredPushToken().catch(() => {});
      await firebaseSignOut(auth);
      setAuthToken("");
      setAuthEmail("");
      await clearStoredAuthToken();
      await AsyncStorage.removeItem("support_user_email");
    }
  }), [authEmail, authToken, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
