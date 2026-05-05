import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import {
  deleteUser,
  initializeAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User
} from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { firebaseConfig } from "@/services/config";
import { setAuthTokenGetter } from "@/services/apiClient";
import { sendLoginOtp, verifyLoginOtp } from "@/services/authApi";

const app = initializeApp(firebaseConfig);
const getReactNativePersistence = (firebaseAuth as any).getReactNativePersistence;
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence ? getReactNativePersistence(AsyncStorage) : undefined
});
const REMEMBER_EMAIL_KEY = "support_mobile_remember_email";

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
      return current ? current.getIdToken() : authToken || (await AsyncStorage.getItem("support_auth_token"));
    });

    let unsubscribed = false;
    AsyncStorage.multiGet(["support_auth_token", "support_user_email", REMEMBER_EMAIL_KEY]).then((items) => {
      if (unsubscribed) return;
      const storedToken = items.find(([key]) => key === "support_auth_token")?.[1] || "";
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
          await AsyncStorage.multiSet([
            ["support_auth_token", token],
            ["support_user_email", nextEmail]
          ]);
        } else {
          await AsyncStorage.setItem("support_auth_token", token);
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
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken(true);
      setAuthToken(token);
      setAuthEmail(result.user.email || email.trim());
      await AsyncStorage.multiSet([
        ["support_auth_token", token],
        ["support_user_email", result.user.email || email.trim()]
      ]);
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
        await AsyncStorage.multiSet([
          ["support_auth_token", idToken],
          ["support_user_email", result.user.email || email.trim()]
        ]);
      } catch {
        setAuthToken(token);
        setAuthEmail(email.trim());
        await AsyncStorage.multiSet([
          ["support_auth_token", token],
          ["support_user_email", email.trim()]
        ]);
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
      await AsyncStorage.multiRemove(["support_auth_token", "support_user_email"]);
    },
    signOut: async () => {
      await firebaseSignOut(auth);
      setAuthToken("");
      setAuthEmail("");
      await AsyncStorage.multiRemove(["support_auth_token", "support_user_email"]);
    }
  }), [authEmail, authToken, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
