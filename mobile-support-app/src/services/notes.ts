import { apiRequest } from "@/services/apiClient";
import { SupportSession } from "@/services/supportApi";

function sessionRouteBody(session?: SupportSession | null, extra: Record<string, unknown> = {}) {
  return {
    tenantId: session?.tenantId || undefined,
    tenant: session?.tenantId || undefined,
    product: session?.productKey || session?.product || undefined,
    ...extra
  };
}

export async function saveInternalNote(sessionId: string, note: string, session?: SupportSession | null) {
  return apiRequest(`/support/sessions/${sessionId}/notes`, {
    method: "POST",
    body: sessionRouteBody(session, {
      type: "internal",
      note
    })
  });
}
