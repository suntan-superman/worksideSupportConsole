# Backend Tasklist: Support Transcript, Assignment, and Admin Routing

## Purpose

Implement the backend services required for:

1. Sending a customer-safe transcript to the saved contact email.
2. Assigning or forwarding a support session to an internal support user or department.
3. Allowing `super_admin` users to manage support users and departments.

The frontend implementation is already wired to the contracts in this document.

## Current Frontend Expectations

- Assignment modal calls `GET /support/departments`, `GET /support/users`, and `POST /support/sessions/:id/assign`.
- Transcript dialog calls `POST /support/sessions/:id/send-transcript`.
- Super-admin panel calls:
  - `GET /support/admin/users`
  - `POST /support/admin/users`
  - `PATCH /support/admin/users/:id`
  - `GET /support/admin/departments`
  - `POST /support/admin/departments`
  - `PATCH /support/admin/departments/:id`
- Session detail/list should return assignment and transcript metadata so the console can show current routing state.

## Phase 1: Data Models

- [ ] Add `supportUsers` collection or equivalent.
- [ ] Add `supportDepartments` collection or equivalent.
- [ ] Add session assignment fields.
- [ ] Add session transcript receipt fields.
- [ ] Add indexes for product, tenant, department, active status, and email lookups.

### Support User Shape

```json
{
  "id": "user_123",
  "name": "Stan Roy",
  "email": "stan@example.com",
  "phone": "+15555551212",
  "role": "support_agent",
  "departments": ["sales"],
  "allowedProducts": ["merxus"],
  "allowedTenantIds": ["default"],
  "active": true,
  "createdAt": "2026-04-29T00:00:00.000Z",
  "updatedAt": "2026-04-29T00:00:00.000Z"
}
```

### Support Department Shape

```json
{
  "id": "sales",
  "label": "Sales",
  "product": "merxus",
  "active": true,
  "defaultAssigneeIds": ["user_123"],
  "notificationChannels": {
    "email": true
  },
  "createdAt": "2026-04-29T00:00:00.000Z",
  "updatedAt": "2026-04-29T00:00:00.000Z"
}
```

### Session Extensions

```json
{
  "support": {
    "assignedTo": {
      "id": "user_123",
      "name": "Stan Roy",
      "email": "stan@example.com"
    },
    "departmentId": "sales",
    "departmentLabel": "Sales",
    "assignmentHistory": [
      {
        "assignedToUserId": "user_123",
        "assignedToName": "Stan Roy",
        "assignedToEmail": "stan@example.com",
        "departmentId": "sales",
        "departmentLabel": "Sales",
        "note": "Customer asked for pricing follow-up.",
        "assignedBy": "admin_123",
        "assignedAt": "2026-04-29T00:00:00.000Z",
        "notification": {
          "attempted": true,
          "sent": true,
          "channels": ["email"]
        }
      }
    ],
    "lastTranscriptSentAt": "2026-04-29T00:00:00.000Z",
    "lastTranscriptSentTo": "customer@example.com"
  }
}
```

## Phase 2: Read Routes

### List Assignable Users

- [ ] Implement `GET /support/users`.
- [ ] Require authenticated support access.
- [ ] Filter by `product`, `tenantId`, and `departmentId`.
- [ ] Return only active assignable users by default.
- [ ] Enforce tenant/product visibility for non-`super_admin` callers.

Query:

```http
GET /support/users?product=merxus&tenantId=default&departmentId=sales
```

Response:

```json
{
  "items": [
    {
      "id": "user_123",
      "name": "Stan Roy",
      "email": "stan@example.com",
      "role": "sales_agent",
      "departments": ["sales"],
      "allowedProducts": ["merxus"],
      "allowedTenantIds": ["default"],
      "active": true
    }
  ]
}
```

### List Departments

- [ ] Implement `GET /support/departments`.
- [ ] Require authenticated support access.
- [ ] Filter by `product` when supplied.
- [ ] Return active departments by default.

Response:

```json
{
  "items": [
    {
      "id": "sales",
      "label": "Sales",
      "product": "merxus",
      "active": true,
      "defaultAssigneeIds": ["user_123"]
    }
  ]
}
```

## Phase 3: Assignment Endpoint

### Assign Session

- [ ] Implement `POST /support/sessions/:sessionId/assign`.
- [ ] Require authenticated support write access.
- [ ] Reject viewer/read-only roles.
- [ ] Load session and verify caller product/tenant access.
- [ ] Validate target assignee exists and is active.
- [ ] Validate department exists and is active when supplied.
- [ ] Verify target user can access the session product and tenant unless caller is `super_admin`.
- [ ] Verify target user belongs to supplied department when department is supplied.
- [ ] Update session current assignment fields.
- [ ] Append `support.assignmentHistory`.
- [ ] Optionally notify assignee.
- [ ] Audit assignment and notification outcome.
- [ ] Return updated session plus assignment receipt.

Request:

```json
{
  "tenantId": "default",
  "product": "merxus",
  "departmentId": "sales",
  "assignedToUserId": "user_123",
  "note": "Customer asked for pricing follow-up.",
  "notifyAssignee": true,
  "includeTranscriptSummary": true
}
```

Response:

```json
{
  "ok": true,
  "session": {},
  "assignment": {
    "departmentId": "sales",
    "departmentLabel": "Sales",
    "assignedToUserId": "user_123",
    "assignedToName": "Stan Roy",
    "assignedToEmail": "stan@example.com",
    "assignedAt": "2026-04-29T00:00:00.000Z",
    "assignedBy": "admin_123",
    "notification": {
      "attempted": true,
      "sent": true,
      "channels": ["email"]
    }
  }
}
```

## Phase 4: Transcript Endpoint

### Send Transcript

- [ ] Implement `POST /support/sessions/:sessionId/send-transcript`.
- [ ] Require authenticated support write access.
- [ ] Reject viewer/read-only roles.
- [ ] Load session and verify caller product/tenant access.
- [ ] Require saved contact email.
- [ ] Build customer-safe transcript from messages/actions.
- [ ] Exclude internal notes, diagnostics, audit logs, auth data, backend errors, and private routing metadata.
- [ ] Respect include flags:
  - `includeAiMessages`
  - `includeAgentMessages`
  - `includeSystemMessages`
- [ ] Reject when no customer-visible transcript content remains.
- [ ] Send email through the existing email provider.
- [ ] Store transcript receipt on session.
- [ ] Audit send success/failure.
- [ ] Return updated session plus transcript email receipt.

Request:

```json
{
  "tenantId": "default",
  "product": "merxus",
  "to": "customer@example.com",
  "includeAiMessages": true,
  "includeAgentMessages": true,
  "includeSystemMessages": false,
  "subject": "Your conversation transcript"
}
```

Response:

```json
{
  "ok": true,
  "session": {},
  "transcriptEmail": {
    "sentAt": "2026-04-29T00:00:00.000Z",
    "to": "customer@example.com",
    "provider": "sendgrid",
    "messageId": "provider-message-id"
  }
}
```

## Phase 5: Super-Admin Routes

Initial rollout should be `super_admin` only.

### Admin Users

- [ ] Implement `GET /support/admin/users`.
- [ ] Implement `POST /support/admin/users`.
- [ ] Implement `PATCH /support/admin/users/:id`.
- [ ] Enforce `super_admin`.
- [ ] Validate name and email.
- [ ] Store optional phone number for SMS notification support.
- [ ] Validate role is one of the supported support roles.
- [ ] Require at least one department before allowing support user creation.
- [ ] Require each support user to belong to at least one active department.
- [ ] Normalize comma/list fields to arrays.
- [ ] Never allow duplicate active users with the same email.

Create/update request:

```json
{
  "name": "Stan Roy",
  "email": "stan@example.com",
  "phone": "+15555551212",
  "role": "sales_agent",
  "departments": ["sales"],
  "allowedProducts": ["merxus"],
  "allowedTenantIds": ["default"],
  "active": true
}
```

### Admin Departments

- [ ] Implement `GET /support/admin/departments`.
- [ ] Implement `POST /support/admin/departments`.
- [ ] Implement `PATCH /support/admin/departments/:id`.
- [ ] Implement `DELETE /support/admin/departments/:id`.
- [ ] Enforce `super_admin`.
- [ ] Validate department id and label.
- [ ] Reject duplicate department ids.
- [ ] Validate default assignees exist.
- [ ] Validate default assignees are active.
- [ ] Validate default assignees belong to the department or can receive that department's assignments.
- [ ] Prevent deleting departments referenced by active sessions or active support users, unless using an explicit soft-delete/deactivate flow.

Create/update request:

```json
{
  "id": "sales",
  "label": "Sales",
  "product": "merxus",
  "defaultAssigneeIds": ["user_123"],
  "active": true
}
```

## Phase 6: Error Contract

All expected workflow errors should return:

```json
{
  "ok": false,
  "error": "Human-readable message.",
  "code": "CANONICAL_ERROR_CODE",
  "requiredAction": "frontend_action_hint",
  "sessionId": "session-id-when-relevant"
}
```

### Transcript Errors

- [ ] `CONTACT_EMAIL_REQUIRED`
  - `requiredAction`: `collect_email`
- [ ] `TRANSCRIPT_EMPTY`
  - `requiredAction`: `refresh_session`
- [ ] `TRANSCRIPT_SEND_FAILED`
  - `requiredAction`: `retry`

### Assignment Errors

- [ ] `ASSIGNEE_REQUIRED`
  - `requiredAction`: `choose_assignee`
- [ ] `ASSIGNEE_NOT_FOUND`
  - `requiredAction`: `choose_assignee`
- [ ] `ASSIGNEE_INACTIVE`
  - `requiredAction`: `choose_assignee`
- [ ] `ASSIGNEE_ACCESS_DENIED`
  - `requiredAction`: `choose_assignee`
- [ ] `DEPARTMENT_NOT_FOUND`
  - `requiredAction`: `choose_department`
- [ ] `DEPARTMENT_INACTIVE`
  - `requiredAction`: `choose_department`
- [ ] `ASSIGNMENT_VALIDATION_ERROR`
  - `requiredAction`: `choose_assignee`

### Admin Errors

- [ ] `SUPPORT_USER_VALIDATION_ERROR`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_USER_DEPARTMENT_REQUIRED`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_USER_EMAIL_EXISTS`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_DEPARTMENT_VALIDATION_ERROR`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_DEPARTMENT_EXISTS`
  - `requiredAction`: `fix_form`
- [ ] `SUPPORT_DEPARTMENT_IN_USE`
  - `requiredAction`: `fix_form`
- [ ] `ADMIN_PERMISSION_REQUIRED`
  - `requiredAction`: `contact_admin`

## Phase 7: Session Response Contract

Session list and detail responses should include these fields, either top-level or nested under `support` using the shapes below.

- [ ] Current assignment:
  - `assignedToUserId`
  - `assignedToName`
  - `assignedToEmail`
  - `departmentId`
  - `departmentLabel`
- [ ] Assignment history:
  - `assignmentHistory`
  - or `support.assignmentHistory`
- [ ] Transcript receipt:
  - `lastTranscriptSentAt`
  - `lastTranscriptSentTo`
  - or `support.lastTranscriptSentAt`
  - or `support.lastTranscriptSentTo`
- [ ] Preserve existing support fields:
  - `leadCaptured`
  - `inquiryCaptured`
  - `requiresInquiryCapture`
  - `allowAnonymousNoFollowUpClose`

## Phase 8: Audit Requirements

- [ ] Write `session_assigned` on successful assignment.
- [ ] Write `assignment_notification_sent` when notification succeeds.
- [ ] Write `assignment_notification_failed` when notification fails.
- [ ] Write `transcript_sent` when transcript email succeeds.
- [ ] Write `transcript_send_failed` when transcript email fails.
- [ ] Write admin audit events for user/department create/update.
- [ ] Include actor id/email/role.
- [ ] Include product, tenantId, sessionId, target user, and department where relevant.
- [ ] Do not store raw full transcript content in audit logs.

## Phase 9: Notifications

- [ ] Reuse existing email provider if available.
- [ ] Add assignee notification email template.
- [ ] Include session link or session id.
- [ ] Include lead/contact summary.
- [ ] Include assignment note.
- [ ] Include transcript summary only when `includeTranscriptSummary` is true.
- [ ] Do not send internal-only notes to unauthorized users.
- [ ] Record notification attempted/sent/failed status in assignment receipt/history.

## Phase 10: Tests

### Transcript Tests

- [ ] Transcript succeeds when contact email and sendable messages exist.
- [ ] Transcript fails with `CONTACT_EMAIL_REQUIRED` when saved email is missing.
- [ ] Transcript fails with `TRANSCRIPT_EMPTY` when no customer-visible messages exist.
- [ ] Transcript excludes internal notes, diagnostics, audit logs, auth data, and backend errors.
- [ ] Transcript respects `includeAiMessages`.
- [ ] Transcript respects `includeAgentMessages`.
- [ ] Transcript respects `includeSystemMessages`.
- [ ] Transcript writes `transcript_sent` audit event.
- [ ] Transcript writes receipt fields on the session.
- [ ] Viewer cannot send transcript.
- [ ] Cross-tenant user cannot send transcript.

### Assignment Tests

- [ ] Assignment succeeds for active authorized assignee.
- [ ] Assignment succeeds for `super_admin` across tenants/products.
- [ ] Assignment fails with `ASSIGNEE_REQUIRED` when assignee is missing.
- [ ] Assignment fails with `ASSIGNEE_NOT_FOUND` for unknown user.
- [ ] Assignment fails with `ASSIGNEE_INACTIVE` for inactive user.
- [ ] Assignment fails with `ASSIGNEE_ACCESS_DENIED` for unauthorized product/tenant.
- [ ] Assignment fails with `DEPARTMENT_NOT_FOUND` for unknown department.
- [ ] Assignment fails with `DEPARTMENT_INACTIVE` for inactive department.
- [ ] Assignment writes current session assignment fields.
- [ ] Assignment appends `support.assignmentHistory`.
- [ ] Assignment notification success/failure is recorded.
- [ ] Viewer cannot assign.
- [ ] Cross-tenant user cannot assign.

### Admin Tests

- [ ] `super_admin` can list support users.
- [ ] `super_admin` can create support user.
- [ ] `super_admin` can update support user.
- [ ] `super_admin` can list departments.
- [ ] `super_admin` can create department.
- [ ] `super_admin` can update department.
- [ ] Non-super-admin cannot access admin routes.
- [ ] Duplicate active support user email is rejected.
- [ ] Invalid department default assignee is rejected.

## Phase 11: Deployment Checklist

- [ ] Deploy backend routes.
- [ ] Confirm frontend diagnostics show:
  - `List Support Users`
  - `List Departments`
  - `Admin Users`
  - `Admin Departments`
  - `Create Support User`
  - `Update Support User`
  - `Create Department`
  - `Update Department`
  - `Assign Session`
  - `Send Transcript`
- [ ] Verify role claims:
  - `super_admin`
  - `support_agent`
  - `sales_agent`
  - `billing_agent`
  - `viewer`
- [ ] Verify tenant/product isolation manually.
- [ ] Verify assignment appears in session list/detail after refresh.
- [ ] Verify transcript receipt appears in session detail after send.
- [ ] Verify frontend shows inline assignment errors for expected validation failures.
- [ ] Verify transcript errors produce friendly guidance.

## Definition of Done

- Support users and departments can be managed by `super_admin`.
- A support agent can assign a session to an authorized teammate or department.
- Assignment state is visible in session list and detail.
- Assignment history is preserved.
- Assignee notifications are attempted and audited when requested.
- A support agent can email a safe transcript to the saved contact email.
- Transcript send receipt is visible on the session.
- Viewer role cannot perform write actions.
- Cross-tenant and cross-product access is denied by backend enforcement.
- Frontend and backend use the same routes, payloads, response fields, and error codes.
