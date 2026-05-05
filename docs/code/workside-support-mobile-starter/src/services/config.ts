export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.merxus.ai";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
};
