
# Workside Conversational Platform — Backend Enforcement Layer
## Codex-Ready Production Implementation Guide

**Purpose:** Move chat safety and workflow rules from “frontend guardrails” to **backend-authoritative enforcement**.

This document is written for Codex/Copilot implementation inside the chat engine backend that powers the Workside Support Console and embedded chat widgets.

---

# 1. Goal

The backend must become the final authority for:

1. Lead capture requirements
2. After-hours inquiry capture
3. Human transfer lifecycle
4. Session close rules
5. Firebase authentication
6. Role-based authorization
7. Tenant/product access isolation
8. Audit logging
9. Structured error responses

Frontend checks are still useful for user experience, but they must never be the only enforcement layer.

---

# 2. Non-Negotiable Backend Rules

## Rule 1 — No anonymous escalation

If a tenant requires lead capture, the backend must reject escalation or human transfer unless required lead fields are present.

Required fields vary by tenant config:

```ts
leadCapture: {
  required: true,
  requireName: true,
  requireEmail: true,
  requirePhone?: boolean
}
```

## Rule 2 — No anonymous close

If lead capture is required, the backend must reject session close unless the lead is captured.

## Rule 3 — No after-hours close without inquiry

If the session is in after-hours intake mode, the backend must reject close unless inquiry details are captured.

## Rule 4 — No invalid transfer state transitions

The backend must enforce:

```txt
active_ai -> escalated -> active_human -> closed
```

Valid alternate transitions:

```txt
active_ai -> closed
active_ai -> after_hours_intake -> closed
escalated -> closed
active_human -> closed
```

## Rule 5 — No cross-tenant data access

Every backend query must be scoped by:

```ts
tenantId
product
```

Support console users may only access allowed tenants and products.

---

# 3. Canonical Error Contract

All protected backend routes must return structured errors.

```ts
type ApiErrorResponse = {
  ok: false;
  error: {
    code: ChatErrorCode;
    message: string;
    requiredAction?: ChatRequiredAction;
    missingFields?: string[];
    sessionId?: string;
  };
};

type ChatErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_AUTH_TOKEN"
  | "ROLE_REQUIRED"
  | "PRODUCT_ACCESS_DENIED"
  | "TENANT_ACCESS_DENIED"
  | "SESSION_NOT_FOUND"
  | "SESSION_TENANT_MISMATCH"
  | "INVALID_SESSION_STATE"
  | "LEAD_CAPTURE_REQUIRED"
  | "NAME_REQUIRED"
  | "EMAIL_REQUIRED"
  | "PHONE_REQUIRED"
  | "INQUIRY_CAPTURE_REQUIRED"
  | "TRANSFER_ALREADY_ACTIVE"
  | "TRANSFER_NOT_REQUESTED"
  | "SESSION_ALREADY_CLOSED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

type ChatRequiredAction =
  | "login"
  | "collect_lead"
  | "collect_name"
  | "collect_email"
  | "collect_phone"
  | "collect_inquiry"
  | "refresh_session"
  | "contact_admin";
```

Example:

```json
{
  "ok": false,
  "error": {
    "code": "LEAD_CAPTURE_REQUIRED",
    "message": "Lead capture is required before this action can be completed.",
    "requiredAction": "collect_lead",
    "missingFields": ["name", "email"],
    "sessionId": "sess_123"
  }
}
```

---

# 4. Session State Model

Use a single canonical status enum.

```ts
type ChatSessionStatus =
  | "active_ai"
  | "escalated"
  | "active_human"
  | "after_hours_intake"
  | "closed";
```

Recommended session fields:

```ts
type ChatSession = {
  id: string;
  tenantId: string;
  product: "merxus" | "home_advisor" | "workside_logistics";
  status: ChatSessionStatus;

  lead: {
    name?: string;
    email?: string;
    phone?: string;
    captured: boolean;
    capturedAt?: Date;
  };

  inquiry: {
    required: boolean;
    captured: boolean;
    inquiryId?: string;
    capturedAt?: Date;
  };

  transfer: {
    requested: boolean;
    requestedAt?: Date;
    requestedBy?: "visitor" | "ai" | "agent" | "system";
    reason?: string;
    note?: string;
    accepted: boolean;
    acceptedAt?: Date;
    acceptedBy?: string;
  };

  ai: {
    enabled: boolean;
    lastConfidence?: number;
  };

  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  closedBy?: string;
  resolutionNote?: string;
};
```

---

# 5. Firebase Auth Middleware

Frontend must send:

```http
Authorization: Bearer <firebase_id_token>
```

Auth context:

```ts
type AuthContext = {
  uid: string;
  email?: string;
  role: "super_admin" | "admin" | "support_agent" | "sales_agent" | "dispatcher" | "viewer";
  allowedProducts: Array<"merxus" | "home_advisor" | "workside_logistics">;
  allowedTenantIds: string[];
};
```

Middleware:

```ts
import admin from "firebase-admin";
import type { Request, Response, NextFunction } from "express";

export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication is required.",
          requiredAction: "login"
        }
      });
    }

    const token = header.replace("Bearer ", "").trim();
    const decoded = await admin.auth().verifyIdToken(token);

    req.auth = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || "viewer",
      allowedProducts: decoded.allowedProducts || [],
      allowedTenantIds: decoded.allowedTenantIds || []
    };

    return next();
  } catch {
    return res.status(401).json({
      ok: false,
      error: {
        code: "INVALID_AUTH_TOKEN",
        message: "The authentication token is invalid or expired.",
        requiredAction: "login"
      }
    });
  }
}
```

Type augmentation:

```ts
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
```

---

# 6. Role and Tenant Authorization

```ts
export function assertProductAccess(auth: AuthContext, product: string) {
  if (auth.role === "super_admin") return;

  if (!auth.allowedProducts.includes(product as any)) {
    throw new ChatApiError({
      status: 403,
      code: "PRODUCT_ACCESS_DENIED",
      message: "You do not have access to this product.",
      requiredAction: "contact_admin"
    });
  }
}

export function assertTenantAccess(auth: AuthContext, tenantId: string) {
  if (auth.role === "super_admin") return;

  if (!auth.allowedTenantIds.includes(tenantId)) {
    throw new ChatApiError({
      status: 403,
      code: "TENANT_ACCESS_DENIED",
      message: "You do not have access to this tenant.",
      requiredAction: "contact_admin"
    });
  }
}

export function assertSessionTenantMatch(session: ChatSession, tenantId: string, product: string) {
  if (session.tenantId !== tenantId || session.product !== product) {
    throw new ChatApiError({
      status: 403,
      code: "SESSION_TENANT_MISMATCH",
      message: "This session does not belong to the requested tenant/product.",
      requiredAction: "refresh_session"
    });
  }
}
```

---

# 7. Custom Error Class

```ts
export class ChatApiError extends Error {
  status: number;
  code: ChatErrorCode;
  requiredAction?: ChatRequiredAction;
  missingFields?: string[];
  sessionId?: string;

  constructor(args: {
    status: number;
    code: ChatErrorCode;
    message: string;
    requiredAction?: ChatRequiredAction;
    missingFields?: string[];
    sessionId?: string;
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.requiredAction = args.requiredAction;
    this.missingFields = args.missingFields;
    this.sessionId = args.sessionId;
  }
}

export function chatErrorHandler(err, req, res, next) {
  if (err instanceof ChatApiError) {
    return res.status(err.status).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        requiredAction: err.requiredAction,
        missingFields: err.missingFields,
        sessionId: err.sessionId
      }
    });
  }

  console.error("Unhandled chat error", {
    route: req.originalUrl,
    method: req.method,
    error: err?.message
  });

  return res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred."
    }
  });
}
```

---

# 8. Tenant Config Loader

The enforcement layer must use tenant configuration.

```ts
export async function getTenantChatConfig(tenantId: string, product: string): Promise<TenantChatConfig> {
  const config = await tenantConfigRepo.findByTenantAndProduct(tenantId, product);

  if (!config) {
    throw new ChatApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Tenant chat configuration was not found."
    });
  }

  return config;
}
```

---

# 9. Lead Enforcement

```ts
export function getMissingLeadFields(session: ChatSession, config: TenantChatConfig): string[] {
  const missing: string[] = [];

  if (!config.leadCapture.required) return missing;

  if (config.leadCapture.requireName && !session.lead?.name) {
    missing.push("name");
  }

  if (config.leadCapture.requireEmail && !session.lead?.email) {
    missing.push("email");
  }

  if (config.leadCapture.requirePhone && !session.lead?.phone) {
    missing.push("phone");
  }

  return missing;
}

export function requireLeadCapture(session: ChatSession, config: TenantChatConfig) {
  if (!config.leadCapture.required) return;

  const missingFields = getMissingLeadFields(session, config);

  if (missingFields.length > 0) {
    throw new ChatApiError({
      status: 409,
      code: "LEAD_CAPTURE_REQUIRED",
      message: "Lead capture is required before this action can be completed.",
      requiredAction: "collect_lead",
      missingFields,
      sessionId: session.id
    });
  }
}
```

When lead fields are saved:

```ts
const missingFields = getMissingLeadFields(updatedSession, config);

updatedSession.lead.captured = missingFields.length === 0;
updatedSession.lead.capturedAt = updatedSession.lead.captured
  ? new Date()
  : undefined;
```

---

# 10. Inquiry Enforcement

```ts
export function requireInquiryCapture(session: ChatSession) {
  if (!session.inquiry?.required) return;

  if (!session.inquiry?.captured || !session.inquiry?.inquiryId) {
    throw new ChatApiError({
      status: 409,
      code: "INQUIRY_CAPTURE_REQUIRED",
      message: "Inquiry details are required before this session can be closed.",
      requiredAction: "collect_inquiry",
      sessionId: session.id
    });
  }
}
```

Set `session.inquiry.required = true` when:

1. Business is closed
2. No human agents are available
3. AI determines human follow-up is required
4. Tenant config has `afterHoursMode: "capture_inquiry"`

Example:

```ts
if (!isBusinessOpen(config.businessHours) && config.escalation.afterHoursMode === "capture_inquiry") {
  session.status = "after_hours_intake";
  session.inquiry.required = true;
}
```

---

# 11. Transfer State Machine

```ts
const validTransitions: Record<ChatSessionStatus, ChatSessionStatus[]> = {
  active_ai: ["escalated", "after_hours_intake", "closed"],
  escalated: ["active_human", "closed"],
  active_human: ["closed"],
  after_hours_intake: ["closed"],
  closed: []
};

export function assertValidTransition(current: ChatSessionStatus, next: ChatSessionStatus) {
  const allowed = validTransitions[current] || [];

  if (!allowed.includes(next)) {
    throw new ChatApiError({
      status: 409,
      code: "INVALID_SESSION_STATE",
      message: `Invalid session transition from ${current} to ${next}.`,
      requiredAction: "refresh_session"
    });
  }
}
```

---

# 12. Protected Route Behaviors

## 12.1 Request Transfer

```http
POST /support/sessions/:sessionId/request-transfer
```

Backend must:

1. Authenticate user
2. Load session
3. Verify tenant/product access
4. Load tenant config
5. Require lead capture
6. Validate transition `active_ai -> escalated`
7. Save transfer reason/note
8. Set status `escalated`
9. Disable AI if appropriate
10. Write audit log
11. Send notification if configured

```ts
requireLeadCapture(session, config);
assertValidTransition(session.status, "escalated");
```

## 12.2 Accept Transfer / Takeover

```http
POST /support/sessions/:sessionId/takeover
```

Backend must:

1. Authenticate agent
2. Verify role can take over
3. Load session
4. Verify tenant/product access
5. Confirm session status is `escalated`
6. Set status `active_human`
7. Set assigned agent
8. Disable AI auto-reply
9. Add system message
10. Write audit log

```ts
if (session.status !== "escalated") {
  throw new ChatApiError({
    status: 409,
    code: "TRANSFER_NOT_REQUESTED",
    message: "This session has not been escalated for human takeover.",
    requiredAction: "refresh_session",
    sessionId: session.id
  });
}
```

## 12.3 Send Agent Reply

```http
POST /support/sessions/:sessionId/reply
```

Backend must:

1. Authenticate agent
2. Verify session access
3. Confirm session status is `active_human`
4. Store message as `senderType: "agent"`
5. Push realtime event
6. Write audit log

```ts
if (session.status !== "active_human") {
  throw new ChatApiError({
    status: 409,
    code: "INVALID_SESSION_STATE",
    message: "Agent replies are only allowed during an active human session.",
    requiredAction: "refresh_session",
    sessionId: session.id
  });
}
```

## 12.4 Save Lead

```http
PATCH /support/sessions/:sessionId/lead
```

Backend must:

1. Authenticate user
2. Verify session access
3. Validate email format
4. Validate phone if required
5. Save lead fields
6. Recalculate `lead.captured`
7. Write audit log

## 12.5 Save Inquiry

```http
POST /support/sessions/:sessionId/inquiry
```

Backend must:

1. Authenticate user
2. Verify session access
3. Require lead capture first
4. Validate raw inquiry description
5. Generate or accept summary
6. Create inquiry record
7. Mark session inquiry captured
8. Write audit log
9. Send notification

```ts
requireLeadCapture(session, config);
```

## 12.6 Close Session

```http
POST /support/sessions/:sessionId/close
```

Backend must:

1. Authenticate user
2. Verify session access
3. Load tenant config
4. Require lead capture if configured
5. Require inquiry capture if required
6. Validate transition to `closed`
7. Save resolution note
8. Set closed fields
9. Write audit log
10. Push realtime event

```ts
requireLeadCapture(session, config);
requireInquiryCapture(session);
assertValidTransition(session.status, "closed");
```

---

# 13. Business Hours Enforcement

Use timezone-aware logic. Do not rely on server local time.

Install:

```powershell
npm install luxon
npm install -D @types/luxon
```

```ts
import { DateTime } from "luxon";

export function isBusinessOpen(config: TenantChatConfig, now = new Date()): boolean {
  const timezone = config.businessHours.timezone || "America/Los_Angeles";
  const local = DateTime.fromJSDate(now).setZone(timezone);

  const dayKey = local.toFormat("ccc").toLowerCase().slice(0, 3);
  const dayHours = config.businessHours.days[dayKey];

  if (!dayHours) return false;

  const open = DateTime.fromFormat(dayHours.open, "HH:mm", { zone: timezone }).set({
    year: local.year,
    month: local.month,
    day: local.day
  });

  const close = DateTime.fromFormat(dayHours.close, "HH:mm", { zone: timezone }).set({
    year: local.year,
    month: local.month,
    day: local.day
  });

  return local >= open && local <= close;
}
```

---

# 14. Audit Logging

Every protected action must create an audit log.

```ts
type ChatAuditAction =
  | "transfer_requested"
  | "transfer_accepted"
  | "agent_reply_sent"
  | "lead_saved"
  | "inquiry_saved"
  | "session_closed"
  | "authorization_denied"
  | "enforcement_blocked_action";

export async function writeChatAuditLog(args: {
  tenantId: string;
  product: string;
  sessionId?: string;
  inquiryId?: string;
  actorId?: string;
  actorRole?: string;
  action: ChatAuditAction;
  details?: Record<string, unknown>;
}) {
  await chatAuditRepo.create({
    ...args,
    createdAt: new Date()
  });
}
```

Log blocked actions:

```ts
try {
  requireLeadCapture(session, config);
} catch (err) {
  await writeChatAuditLog({
    tenantId: session.tenantId,
    product: session.product,
    sessionId: session.id,
    actorId: req.auth?.uid,
    actorRole: req.auth?.role,
    action: "enforcement_blocked_action",
    details: {
      code: err.code,
      missingFields: err.missingFields
    }
  });

  throw err;
}
```

---

# 15. Frontend Error Mapping

The support console should map backend errors into user-friendly actions.

```ts
function handleChatApiError(error) {
  const code = error?.response?.data?.error?.code;
  const requiredAction = error?.response?.data?.error?.requiredAction;

  if (requiredAction === "collect_lead") {
    openLeadCapturePanel();
    return;
  }

  if (requiredAction === "collect_inquiry") {
    openInquiryPanel();
    return;
  }

  if (code === "INVALID_AUTH_TOKEN") {
    forceLogout();
    return;
  }

  showToast(error?.response?.data?.error?.message || "Action failed.");
}
```

---

# 16. Testing Requirements

## Unit Tests

Add tests for:

- `getMissingLeadFields`
- `requireLeadCapture`
- `requireInquiryCapture`
- `assertValidTransition`
- `isBusinessOpen`

## Integration Tests

Add tests for:

1. Close without lead returns `LEAD_CAPTURE_REQUIRED`
2. Transfer without lead returns `LEAD_CAPTURE_REQUIRED`
3. After-hours close without inquiry returns `INQUIRY_CAPTURE_REQUIRED`
4. Unauthorized tenant access returns `TENANT_ACCESS_DENIED`
5. Unauthorized product access returns `PRODUCT_ACCESS_DENIED`
6. Viewer cannot takeover
7. Takeover without escalation returns `TRANSFER_NOT_REQUESTED`
8. Agent reply before takeover returns `INVALID_SESSION_STATE`
9. Valid transfer path succeeds:
   - save lead
   - request transfer
   - takeover
   - reply
   - close

---

# 17. Recommended Backend File Structure

```txt
src/
  chat/
    errors/
      ChatApiError.ts
      chatErrorHandler.ts
    middleware/
      requireFirebaseAuth.ts
      requireSupportRole.ts
      requireTenantAccess.ts
    enforcement/
      leadEnforcement.ts
      inquiryEnforcement.ts
      sessionStateMachine.ts
      businessHours.ts
    services/
      chatSessionService.ts
      chatTransferService.ts
      chatInquiryService.ts
      chatAuditService.ts
    repositories/
      chatSessionRepo.ts
      chatMessageRepo.ts
      chatInquiryRepo.ts
      tenantConfigRepo.ts
    routes/
      supportRoutes.ts
      chatRoutes.ts
```

---

# 18. Codex Prompt — Backend Enforcement Layer

Use this directly with Codex:

```txt
Implement the backend enforcement layer for the Workside Conversational Platform.

The current frontend support console has UI guards for lead capture, inquiry capture, transfer request, human takeover, reply, and close. Move all critical rules into the backend.

Add TypeScript middleware and services for:
1. Firebase ID token validation
2. Role and tenant/product access checks
3. Lead capture enforcement
4. After-hours inquiry enforcement
5. Session status transition enforcement
6. Structured API error responses
7. Audit logging for all protected actions
8. Canonical transfer lifecycle persistence

Required behavior:
- Reject escalation/transfer/close when required lead fields are missing.
- Reject after-hours close when inquiry details are missing.
- Reject invalid state transitions.
- Reject cross-tenant and unauthorized product access.
- Disable AI auto-reply when an agent takes over.
- Write audit logs for transfer_requested, transfer_accepted, agent_reply_sent, lead_saved, inquiry_saved, session_closed, and enforcement_blocked_action.
- Return structured errors with code, message, requiredAction, missingFields, and sessionId where applicable.

Use the existing backend architecture where possible. Add repository/service/controller separation if missing. Add unit and integration tests for all enforcement rules.
```

---

# 19. Codex Prompt — Frontend Error Alignment

Use this with Codex after backend errors are implemented:

```txt
Update the Workside Support Console frontend to treat the backend as the enforcement authority.

Replace any optimistic assumptions with structured error handling for:
- LEAD_CAPTURE_REQUIRED
- INQUIRY_CAPTURE_REQUIRED
- INVALID_SESSION_STATE
- TRANSFER_NOT_REQUESTED
- PRODUCT_ACCESS_DENIED
- TENANT_ACCESS_DENIED
- INVALID_AUTH_TOKEN

When the backend returns requiredAction: collect_lead, automatically open the lead capture panel.
When the backend returns requiredAction: collect_inquiry, automatically open the inquiry form.
When auth errors occur, route the user back to login.
Keep frontend guards for user experience, but do not assume they are authoritative.
```

---

# 20. Definition of Done

The backend enforcement layer is complete when:

- [ ] Firebase token validation is active on support routes
- [ ] Role and tenant/product access checks are active
- [ ] Lead capture is enforced server-side
- [ ] Inquiry capture is enforced server-side
- [ ] Transfer state transitions are enforced server-side
- [ ] Agent replies are blocked unless session is `active_human`
- [ ] AI auto-reply is disabled during human takeover
- [ ] Session close rules cannot be bypassed by direct API calls
- [ ] All protected actions create audit logs
- [ ] Frontend maps structured backend errors correctly
- [ ] Integration tests pass for happy paths and blocked paths

---

# 21. Immediate Sprint Order

## Day 1

1. Add error contract
2. Add Firebase auth middleware
3. Add tenant/product access checks
4. Add lead enforcement
5. Add close enforcement

## Day 2

1. Add transfer state machine
2. Add takeover/reply guards
3. Add inquiry enforcement
4. Add audit logs
5. Add frontend error mapping

## Day 3

1. Add tests
2. Remove fallback endpoint dependence where canonical endpoints exist
3. Run end-to-end smoke tests
4. Keep diagnostics panel until all routes are green

---

# 22. Final Architectural Position

After this work, the support console will no longer be merely “frontend integration-ready.”

It will become a backend-verified operational system where:

- UI improves workflow
- Backend enforces truth
- Tenant boundaries are protected
- Human takeover is auditable
- Lead and inquiry capture cannot be bypassed
- The platform is ready to support Merxus, Home Advisor, Workside Logistics, and future Workside products
