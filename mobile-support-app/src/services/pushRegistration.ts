import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "@/services/apiClient";

const PUSH_TOKEN_ID_KEY = "support_mobile_push_token_id";
const PUSH_TOKEN_VALUE_KEY = "support_mobile_push_token_value";

type PushRegistrationResponse = {
  tokenId?: string;
  id?: string;
  item?: { id?: string };
  data?: { id?: string; tokenId?: string };
};

export async function registerPushToken(expoPushToken: string) {
  const token = String(expoPushToken || "").trim();
  if (!token) return "";

  const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_VALUE_KEY);
  const previousTokenId = await AsyncStorage.getItem(PUSH_TOKEN_ID_KEY);
  if (previousToken === token && previousTokenId) return previousTokenId;

  const payload = await apiRequest<PushRegistrationResponse>("/support/mobile/push-tokens", {
    method: "POST",
    body: {
      token,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || "unknown",
      deviceName: Constants.deviceName || "",
      installationId: Constants.sessionId || undefined
    }
  });

  const tokenId = payload.tokenId || payload.id || payload.item?.id || payload.data?.tokenId || payload.data?.id || token;
  await AsyncStorage.multiSet([
    [PUSH_TOKEN_VALUE_KEY, token],
    [PUSH_TOKEN_ID_KEY, tokenId]
  ]);
  return tokenId;
}

export async function revokeRegisteredPushToken() {
  const tokenId = await AsyncStorage.getItem(PUSH_TOKEN_ID_KEY);
  await AsyncStorage.multiRemove([PUSH_TOKEN_ID_KEY, PUSH_TOKEN_VALUE_KEY]);
  if (!tokenId) return;

  await apiRequest(`/support/mobile/push-tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE"
  });
}
