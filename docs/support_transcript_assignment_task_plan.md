# Support Transcript and Assignment Implementation Plan

## Purpose

Add two operational workflows to the Workside Support Console:

1. Send a customer-safe transcript to the contact.
2. Assign or forward a session, contact, and message context to an internal user or department.

This plan is written to keep frontend and backend implementation aligned.

Related backend auth/onboarding plan:

- `docs/backend_support_user_auth_onboarding_tasklist.md`

## Shared Product Rules

### Transcript to Contact

- Only send to an external contact email saved on the session lead/contact record.
- Never include internal notes, diagnostics, audit logs, backend errors, auth details, or private routing metadata.
- Include a clean transcript of visitor, AI, agent, and relevant system-visible messages.
- Add an audit event every time a transcript is sent.
- Show clear success/failure feedback in the console.

### Internal Assignment / Forwarding

- Assignments are internal-only.
- Target users must be active support users.
- Target users must be allowed for the session product/tenant, unless the assigner is `super_admin`.
- A session may have:
  - current owner/assignee
  - department
  - assignment note
  - assignment history
- Assignment notifications may include a transcript summary and latest message content, but not customer-sensitive data beyond what the target user is authorized to see.
- Add audit events for assignment, reassignment, and notification attempts.

## Shared API Contract

### Send Transcript

```http
POST /support/sessions/:sessionId/send-transcript
```

Request:

```json
{
  "to": "contact@example.com",
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
    "to": "contact@example.com",
    "provider": "sendgrid",
    "messageId": "..."
  }
}
```

Expected errors:

```json
{
  "ok": false,
  "error": "Contact email is required before sending a transcript.",
  "code": "CONTACT_EMAIL_REQUIRED",
  "requiredAction": "collect_email",
  "sessionId": "..."
}
```

```json
{
  "ok": false,
  "error": "Transcript has no customer-visible messages to send.",
  "code": "TRANSCRIPT_EMPTY",
  "requiredAction": "refresh_session",
  "sessionId": "..."
}
```

### Assign Session

```http
POST /support/sessions/:sessionId/assign
```

Request:

```json
{
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
    "assignedToUserId": "user_123",
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

Expected errors:

```json
{
  "ok": false,
  "error": "The selected user cannot access this session.",
  "code": "ASSIGNEE_ACCESS_DENIED",
  "requiredAction": "choose_assignee",
  "sessionId": "..."
}
```

### List Support Users

```http
GET /support/users?product=merxus&tenantId=tenantA&departmentId=sales
```

Response:

```json
{
  "items": [
    {
  "id": "user_123",
  "name": "Stan Roy",
  "email": "stan@example.com",
  "phone": "+15555551212",
  "role": "sales_agent",
      "departments": ["sales"],
      "allowedProducts": ["merxus"],
      "allowedTenantIds": ["tenantA"],
      "active": true
    }
  ]
}
```

### List Departments

```http
GET /support/departments?product=merxus
```

Response:

```json
{
  "items": [
    {
      "id": "sales",
      "label": "Sales",
      "active": true,
      "defaultAssigneeIds": ["user_123"]
    }
  ]
}
```

## Backend Tasks

### Phase 1: Data Model

- [ ] Add `supportUsers` collection or equivalent.
- [ ] Add `supportDepartments` collection or equivalent.
- [ ] Define support user fields:
  - `id`
  - `name`
  - `email`
  - `phone`
  - `role`
  - `departments`
  - `allowedProducts`
  - `allowedTenantIds`
  - `active`
  - `createdAt`
  - `updatedAt`
- [ ] Define support department fields:
  - `id`
  - `label`
  - `active`
  - `product`
  - `defaultAssigneeIds`
  - `notificationChannels`
  - `createdAt`
  - `updatedAt`
- [ ] Extend session support model:
  - `support.assignedTo`
  - `support.departmentId`
  - `support.assignmentHistory`
  - `support.lastTranscriptSentAt`
  - `support.lastTranscriptSentTo`

### Phase 2: Backend Services

- [ ] Add transcript builder service.
- [ ] Normalize conversation sources:
  - message records
  - support actions with `action: "reply"`
  - relevant customer-visible system events
- [ ] Filter out internal-only data.
- [ ] Add transcript email service using existing email provider.
- [ ] Add assignment service.
- [ ] Add support user lookup service.
- [ ] Add department lookup service.
- [ ] Add assignee authorization check:
  - active user
  - allowed product
  - allowed tenant
  - department match when department is supplied
- [ ] Add notification service for assignee notifications.

### Phase 3: Backend Routes

- [ ] Add `POST /support/sessions/:id/send-transcript`.
- [ ] Add `POST /support/sessions/:id/assign`.
- [ ] Add `GET /support/users`.
- [ ] Add `GET /support/departments`.
- [ ] Optional admin route: `POST /support/users`.
- [ ] Optional admin route: `PATCH /support/users/:id`.
- [ ] Optional admin route: `POST /support/departments`.
- [ ] Optional admin route: `PATCH /support/departments/:id`.
- [ ] Optional admin route: `DELETE /support/departments/:id`.

### Phase 4: Backend Validation and Error Codes

- [ ] Add `CONTACT_EMAIL_REQUIRED`.
- [ ] Add `TRANSCRIPT_EMPTY`.
- [ ] Add `TRANSCRIPT_SEND_FAILED`.
- [ ] Add `ASSIGNEE_REQUIRED`.
- [ ] Add `ASSIGNEE_NOT_FOUND`.
- [ ] Add `ASSIGNEE_INACTIVE`.
- [ ] Add `ASSIGNEE_ACCESS_DENIED`.
- [ ] Add `DEPARTMENT_NOT_FOUND`.
- [ ] Add `DEPARTMENT_INACTIVE`.
- [ ] Add `ASSIGNMENT_VALIDATION_ERROR`.
- [ ] Ensure all expected errors include:
  - `code`
  - `requiredAction`
  - `sessionId`
  - actionable message

### Phase 5: Backend Audit

- [ ] Write audit event `transcript_sent`.
- [ ] Write audit event `transcript_send_failed`.
- [ ] Write audit event `session_assigned`.
- [ ] Write audit event `assignment_notification_sent`.
- [ ] Write audit event `assignment_notification_failed`.
- [ ] Include actor, tenantId, product, sessionId, target user, and department.
- [ ] Do not log raw full transcript in audit logs.

### Phase 6: Backend Tests

- [ ] Send transcript succeeds when lead email and messages exist.
- [ ] Send transcript fails with `CONTACT_EMAIL_REQUIRED` when no email exists.
- [ ] Send transcript fails with `TRANSCRIPT_EMPTY` when no sendable messages exist.
- [ ] Transcript excludes internal notes and diagnostics.
- [ ] Assignment succeeds for active authorized assignee.
- [ ] Assignment fails for inactive assignee.
- [ ] Assignment fails for unauthorized tenant/product assignee.
- [ ] Assignment fails for invalid department.
- [ ] Assignment writes assignment history.
- [ ] Assignment notification writes success/failure audit.
- [ ] Viewer cannot send transcript.
- [ ] Viewer cannot assign.
- [ ] Super admin can assign across tenants/products.

## Frontend Tasks

### Phase 1: API Client

- [x] Add `sendTranscriptForSession()` in `src/services/chat.js`.
- [x] Add `assignSupportSession()` in `src/services/chat.js`.
- [x] Add `listSupportUsers()` in `src/services/chat.js`.
- [x] Add `listSupportDepartments()` in `src/services/chat.js`.
- [x] Add admin create/edit API methods in `src/services/chat.js`.
- [x] Normalize assignment fields from session payload:
  - `assignedToUserId`
  - `assignedToName`
  - `assignedToEmail`
  - `departmentId`
  - `departmentLabel`
  - `assignmentHistory`
- [x] Normalize transcript sent metadata from session payload.
- [x] Extend error mapping for new backend codes.

### Phase 2: Transcript UI

- [x] Add `Send Transcript` button in session detail actions.
- [x] Disable when:
  - viewer role
  - no contact email
  - session has no sendable messages/actions
  - busy action
- [x] Add confirmation dialog before sending.
- [x] Show recipient email in confirmation.
- [x] Add optional controls:
  - include AI messages
  - include system-visible messages
- [x] Show success toast with recipient email.
- [x] On `CONTACT_EMAIL_REQUIRED`, open/focus Lead Capture email.
- [x] On `TRANSCRIPT_EMPTY`, show guidance to refresh or wait for messages.

### Phase 3: Assignment UI

- [x] Add `Assign` or `Forward` button in session detail actions.
- [x] Add assignment modal/dialog.
- [x] Load departments for current product.
- [x] Load support users filtered by product, tenant, and department.
- [x] Modal fields:
  - department
  - assignee
  - note
  - notify assignee
  - include transcript summary
- [x] Disable submit until valid department/assignee selection exists.
- [x] Show current owner and department in session facts.
- [x] Update session list owner column after assignment.
- [x] Add assignment history section or compact timeline item.
- [x] Show success toast after assignment.
- [x] On `ASSIGNEE_ACCESS_DENIED`, keep modal open and show inline message.

### Phase 4: Admin UI

- [x] Add Settings/Admin section.
- [x] Add Support Users section.
- [x] Add Departments section.
- [x] Present Support Users and Departments in tabs to conserve space.
- [x] Support Users table:
  - name
  - email
  - phone
  - role
  - departments
  - products
  - tenants
  - active
- [x] Departments table:
  - id
  - label
  - product
  - default assignees
  - notification channels
  - active
- [x] Add create/edit user form.
- [x] Add create/edit department form.
- [x] Disable user creation until at least one department exists.
- [x] Use existing departments as support user department choices.
- [x] Use product dropdown for departments.
- [x] Add department deletion action.
- [x] Disable department deletion while users are assigned.
- [x] Treat backend soft-delete as department deactivation in the UI.
- [x] Hide inactive departments by default with a Show inactive toggle.
- [x] Show users associated with each department and allow quick edit.
- [x] Block duplicate department ids in the frontend.
- [x] Add support user phone field for SMS notification support.
- [x] Format support user phone input while typing.
- [x] Disable support user save until required fields are valid.
- [x] Replace freeform allowed tenants/customers with controlled selector.
- [x] Add explicit `__all__` option for all tenants/customers.
- [x] Only show admin UI to `super_admin`.
- [x] Decide whether non-super `admin` should also see admin UI.
  - Initial rollout remains `super_admin` only.

### Phase 5: Frontend UX Polish

- [x] Preserve focus during polling in new modal/form controls.
- [x] Keep selected session visible after assignment refresh.
- [x] Add loading indicators for assignment user/department lists.
- [x] Add inline validation messages instead of hard error banners for expected workflow blockers.
- [x] Add diagnostics labels for new endpoints:
  - Send Transcript
  - Assign Session
  - List Support Users
  - List Departments

### Phase 6: Frontend Tests / Manual QA

- [x] Transcript button disabled without email.
- [x] Transcript button enabled with email and messages.
- [x] Transcript success updates banner and diagnostics.
- [x] Assignment modal loads departments and users.
- [x] Assignment filters users by department.
- [x] Unauthorized assignment shows inline error.
- [x] Successful assignment updates owner in detail and list.
- [x] Polling does not close modal or clear draft note.
- [x] Existing close/transfer/reply flows still work.

## Backend/Frontend Sync Checklist

- [ ] Backend routes deployed.
- [ ] Frontend API functions point to deployed routes.
- [ ] Error codes match exactly.
- [ ] Session payload includes assignment fields.
- [ ] Session payload includes transcript sent metadata.
- [ ] Frontend diagnostics show all new endpoint traces.
- [ ] QA verifies role permissions with:
  - `super_admin`
  - `admin`
  - `support_agent`
  - `sales_agent`
  - `viewer`
- [ ] QA verifies tenant/product isolation.

## Suggested Implementation Order

1. Backend support user and department read models.
2. Backend assignment endpoint.
3. Frontend assignment modal.
4. Backend transcript builder and send endpoint.
5. Frontend send transcript button/dialog.
6. Backend admin create/edit routes.
7. Frontend admin settings pages.
8. Audit and notification hardening.
9. End-to-end QA.

## Definition of Done

- A support user can assign a session to an authorized teammate or department.
- The assignee receives a notification when requested.
- Assignment state is visible in session list and detail.
- A support user can email a safe transcript to the saved contact email.
- Transcript and assignment actions are audited.
- Viewer role cannot perform write actions.
- Unauthorized assignees cannot receive cross-tenant or cross-product sessions.
- Frontend and backend use the same route, payload, and error contracts.
