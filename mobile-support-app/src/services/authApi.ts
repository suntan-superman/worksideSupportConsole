import { apiRequest } from "@/services/apiClient";

export async function sendLoginOtp(email: string) {
  return apiRequest(
    "/auth/otp/send",
    {
      method: "POST",
      auth: false,
      body: {
        email: email.trim(),
        purpose: "support_console_login"
      }
    }
  );
}

export async function verifyLoginOtp(email: string, code: string) {
  const payload = await apiRequest<any>(
    "/auth/otp/verify",
    {
      method: "POST",
      auth: false,
      body: {
        email: email.trim(),
        code: code.trim(),
        purpose: "support_console_login"
      }
    }
  );

  return (
    payload?.customToken ||
    payload?.firebaseCustomToken ||
    payload?.data?.customToken ||
    payload?.token ||
    payload?.idToken ||
    payload?.firebaseIdToken ||
    payload?.data?.token ||
    ""
  );
}
