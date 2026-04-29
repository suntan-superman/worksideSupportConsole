# Support Integration Status and To-Do

Updated: April 27, 2026 (America/Los_Angeles)

## 1. Status Update

## Objective from `support_next_steps_codex.md`

Connect Support Console frontend to canonical `/support` backend and remove endpoint guessing.

## Result

Substantial completion achieved for frontend integration phase.

Completed:

1. Removed endpoint guessing/fallback logic from chat service.
2. Locked frontend requests to canonical `/support` endpoints.
3. Wired sessions list + detail against `/support/sessions` and `/support/sessions/:id`.
4. Wired transfer request against `/support/sessions/:id/request-transfer`.
5. Wired takeover against `/support/sessions/:id/takeover`.
6. Wired reply against `/support/sessions/:id/reply`.
7. Wired close against `/support/sessions/:id/close`.
8. Wired lead save against `PATCH /support/sessions/:id/lead`.
9. Wired inquiry save against `/support/sessions/:id/inquiry`.
10. Added product-scoped frontend calls (`tenantId` + `product`) to match backend access model.
11. Upgraded backend error alignment:
    - uses backend error codes + required actions
    - maps `collect_lead`, `collect_inquiry`, auth, and refresh-state actions to UX behavior.
12. Extended diagnostics panel to show backend code and requiredAction.
13. Added auth token propagation in API layer (Firebase token if present + localStorage fallback for internal testing).
14. Build validation passes.
15. Added frontend auth/setup gate:
    - token login screen for backend access token + tenant/product scope
    - optional Firebase email/password login when Firebase env config exists
    - logout flow that clears token and stops realtime/polling

## 2. Issues / Constraints

1. This repo is frontend-only.
   - Backend enforcement middleware/services are out-of-repo and must remain authoritative in backend.
2. Login/auth UI flow is not implemented in this repo.
   - Auth failures are handled with warnings and backend error mapping, but no in-app login route exists.
3. Contract tests are not yet automated in this repo.
   - Integration verification is still manual unless backend test harness is added.
4. Confirmed backend persistence/read-model mismatch for lead save.
   - `PATCH /support/sessions/:id/lead` returns `200`, but subsequent list/detail reads may not return persisted lead identity consistently.
   - See `docs/backend_lead_persistence_handoff.md` for required backend fix criteria and validation steps.

## 3. Updated To-Do List (Next Steps)

## P0 - Immediate Integration Hardening

1. Run end-to-end contract smoke against real `/support` backend:
   - list sessions
   - open detail
   - request transfer
   - takeover
   - reply
   - save lead
   - save inquiry
   - close
2. Verify backend-required action paths return expected codes:
   - `LEAD_CAPTURE_REQUIRED`
   - `INQUIRY_CAPTURE_REQUIRED`
   - `INVALID_SESSION_STATE`
   - `TRANSFER_NOT_REQUESTED`
   - `AUTH_REQUIRED`
   - `INVALID_AUTH_TOKEN`
3. Confirm exact response shapes for:
   - list route (`items` vs `sessions`)
   - detail route (`session` + `messages` + optional inquiry/audit blocks)

## P1 - Security and Role UX Alignment

1. Add frontend auth bootstrap for internal users (Firebase session initialization).
2. Add role-based UI visibility states (viewer/support/sales/dispatcher/admin/super_admin).
3. Add explicit unauthorized/forbidden views for product/tenant denial errors.

## P2 - Reliability and Quality

1. Add automated integration tests for canonical `/support` routes.
2. Add deterministic fixtures for status transitions:
   - `active_ai -> escalated -> active_human -> closed`
   - `active_ai -> after_hours_intake -> closed`
3. Add lightweight telemetry around blocked actions and backend error frequencies.

## 4. Validation Performed

- `npm run build` completed successfully after integration changes.
