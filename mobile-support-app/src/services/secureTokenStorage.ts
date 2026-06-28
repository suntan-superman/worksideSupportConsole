import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "support_auth_token";

export async function getStoredAuthToken() {
  const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  return "";
}

export async function setStoredAuthToken(token: string) {
  const trimmed = String(token || "").trim();
  if (!trimmed) {
    await clearStoredAuthToken();
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, trimmed);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function clearStoredAuthToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function migrateLegacyAuthToken() {
  return getStoredAuthToken();
}
