# Workside Support Console Product And Codebase Review

Date: 2026-06-28  
Scope: `C:\Users\sjroy\Source\WorksideSupportConsole` only  
Reviewer: Codex, senior systems engineering pass

## Executive Summary

The Workside Support Console is now a credible internal operations product, not just a prototype. The web console supports the main support lifecycle, admin management, assignment, availability, diagnostics, transcript sending, and a broad set of backend error flows. The mobile app is a functional Expo/React Native companion for queue monitoring, takeover, replies, closing, escalation, availability, and local alerts.

Current maturity: controlled internal beta / pilot.

The largest remaining risks are not the absence of core UI. They are contract proof, security hardening, dependency hygiene, backend enforcement verification, notification observability, mobile production readiness, and frontend maintainability. The backend is intentionally out of this repository, so all enforcement claims below should be treated as "must verify in backend," not "solved by this frontend."

## Sources Reviewed

- Root docs: `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `AI_CONTRACT.md`, `DECISIONS.md`
- Project docs: `docs/project_status_update_and_todo.md`, `docs/support_console_accomplishments_and_remaining.md`, `docs/support_integration_status_and_todo.md`, `docs/project_status_assessment_2026-05-03.md`
- Backend handoff/contracts: `docs/backend_support_console_authorization_contract.md`, `docs/backend_lead_persistence_handoff.md`, `docs/workside_backend_enforcement_layer.md`, `docs/mobile_support_app_spec.md`
- Web app: `src/main.js`, `src/services/api.js`, `src/services/auth.js`, `src/services/chat.js`, `src/services/chatErrors.js`, `src/render/*`, `src/state/inactivity.js`, `src/style.css`
- Mobile app: `mobile-support-app/app/*`, `mobile-support-app/src/*`, `mobile-support-app/app.json`, `mobile-support-app/app.config.js`, Android project files
- Tests and tooling: `tests/*`, Playwright configs, `load-tests/*`, `scripts/*`, `release-test.config.js`, `.github/workflows/*`

## Validation Run

Passing checks:

- `npm test`: 6 test files passed, 24 tests passed.
- `npm run build`: Vite production build passed.
- `npm run mobile:typecheck`: Expo/React Native TypeScript check passed.

Security/dependency checks:

- Root `npm audit --omit=dev`: failed with 15 vulnerabilities, including high severity advisories in `axios`, `react-router`, `@grpc/grpc-js`, `protobufjs`, and transitive `firebase-admin` dependencies.
- Mobile `npm audit --omit=dev`: failed with 28 vulnerabilities, including 1 critical `shell-quote` advisory, high severity advisories in `@grpc/grpc-js`, `protobufjs`, `undici`, `ws`, plus Expo/React Native transitive advisories.

Repository hygiene note:

- `git status` shows existing uncommitted changes in `.gitignore`, `package.json`, `package-lock.json`, plus untracked `.github/`, `release-test.config.js`, and `scripts/verify-release.js`.
- `.env` and `.env.local` are ignored.
- `mobile-support-app/android/app/debug.keystore` is tracked.

## Web Product Features

Implemented or substantially implemented:

- Firebase email/password login, password reset, OTP login, custom-token exchange, local token fallback for integration work.
- Authenticated API transport with `Authorization: Bearer <token>`.
- Support-console access gate using recognized support roles and support user lookup behavior.
- Product, tenant/customer, status, urgency, assigned-to, and sort filters.
- Product and tenant option loading from canonical `/support` routes, with fallback product labels.
- Session queue/list and session detail split view.
- Escalation-priority display and active conversation tray.
- Transcript/message rendering with customer, AI, agent, and system message normalization.
- Manual transfer request with reason and note.
- Human takeover.
- Agent reply composer blocked before human takeover in the UI.
- Lead capture form.
- Inquiry capture form.
- Close flow with lead/inquiry UI guards and backend required-action handling.
- Close-no-follow-up flow with explicit confirmation and backend availability guard.
- Internal support notes.
- Resolution note handling on close.
- Session assignment/reassignment by department and support user.
- Transcript sending with default customer-safe options.
- Availability selector and heartbeat while available.
- Auto logout with inactivity warning.
- Admin notification mute.
- Support admin panel for users and departments.
- Invite, password reset, and role-notice actions for support users.
- Department create/edit/delete with local validation.
- Viewer read-only behavior for key actions.
- API diagnostics panel showing action, endpoint, status, backend code, and required action.
- Polling every 5 seconds as the current live-update mechanism.
- Theming support.

Important implementation strengths:

- `src/services/api.js` is a clean transport boundary and preserves structured backend error fields.
- `src/services/chat.js` normalizes many backend shapes during contract convergence.
- Error handling maps backend `requiredAction` values to user-facing lead, inquiry, refresh, auth, and contact-admin flows.
- Render helpers have started to move out of `src/main.js`, which is the right direction.

## Mobile Product Features

Implemented or substantially implemented:

- Expo/React Native app with Expo Router.
- Firebase email/password login.
- OTP login via `/auth/otp/send` and `/auth/otp/verify`.
- Firebase custom-token exchange, with fallback bearer token storage if the OTP route returns an already-minted token.
- Token-bearing API client.
- Support queue dashboard.
- Queue filters: open, waiting, mine, active, closed, all.
- Polling every 5 seconds.
- Local Expo notification when a newly waiting transfer appears while the app is open.
- Notification permission request and Expo push token acquisition.
- Availability toggle between available and away.
- Foreground heartbeat while available.
- Session detail screen with conversation history.
- Accept transfer.
- Reply after takeover.
- Close session.
- Escalate/request transfer.
- Settings screen with current user, notification preference, dark mode, sign out, and delete-account action.

Mobile gaps versus the spec:

- Product scope is hard-coded to `merxus` in `app/dashboard.tsx`.
- Push token is acquired but not registered with the backend.
- Push notification deep linking into a specific session is not implemented.
- Internal notes are specified but not implemented in the mobile UI/API layer.
- Lead and inquiry capture are not implemented on mobile.
- Availability selector only toggles available/away; busy, offline, and do-not-disturb are not first-class controls.
- Assigned sessions are not explicitly requested as `assignedTo=me&status=escalated,active_human`; the app currently fetches broader sessions by product.
- No mobile tests are present beyond TypeScript.
- Token storage uses AsyncStorage; this is acceptable for MVP but should move to secure storage for production.

## Remaining Work

### P0 - Production Blockers

1. Prove backend enforcement end to end.
   - Firebase token validation on every `/support/*` route.
   - Active support-user record required.
   - Role, product, tenant, and department scopes enforced server-side.
   - Reply rejected before takeover.
   - Transfer/takeover/close rejected outside valid state transitions.
   - Close rejected when required lead or inquiry data is missing.
   - Audit logs written for protected actions and blocked attempts.

2. Add deployed contract tests for the complete support lifecycle.
   - Public widget creates session.
   - AI escalates or human transfer is requested.
   - Session appears in console.
   - Agent accepts takeover.
   - Customer-visible history is preserved.
   - Agent reply reaches customer.
   - Lead and inquiry save/read models remain consistent.
   - Close succeeds only when backend rules permit it.

3. Resolve dependency audit findings.
   - Root: update `axios`, `react-router-dom`/`react-router`, `firebase-admin` transitive packages where possible, and protobuf/grpc transitive packages.
   - Mobile: update Expo/React Native dependency chain where compatible; address `shell-quote`, `undici`, `ws`, protobuf/grpc, and related advisories.
   - Re-run both root and mobile audits after lockfile updates.

4. Remove or justify tracked debug keystore.
   - `mobile-support-app/android/app/debug.keystore` is tracked.
   - Debug keystores are not production signing keys, but tracking them is still poor hygiene and can confuse release signing boundaries.

5. Replace mobile token persistence with secure storage.
   - Use Expo SecureStore or platform keystore/keychain storage for fallback bearer tokens.
   - Keep AsyncStorage for non-sensitive preferences only.

6. Complete notification observability.
   - Backend should persist notification receipts: attempted, channel, provider, recipient, status, error/skipped reason, muted state.
   - Web detail should show a complete notification timeline.
   - Mobile push token should be registered and revoke/update behavior should be defined.

7. Clarify realtime versus polling.
   - Current web and mobile behavior is polling.
   - Docs should stop calling this true realtime unless SSE/WebSocket is restored and verified.

### P1 - High Value

1. Split `src/main.js`.
   - Suggested slices: auth screen, session actions, admin workflows, assignment/transcript dialogs, availability, polling, render composition.
   - The file is currently the main maintainability risk.

2. Add mobile feature parity for field support.
   - Internal notes.
   - Lead capture.
   - Inquiry capture.
   - Full availability statuses.
   - Assigned-to-me query.
   - Product selector or backend-derived allowed product scope.

3. Add session audit/history view.
   - Transfer requested.
   - Assignment changed.
   - Takeover accepted.
   - Reply sent.
   - Lead/inquiry saved.
   - Notes saved.
   - Transcript sent.
   - Close/no-follow-up close.

4. Add dedicated queues/views.
   - Inquiry queue.
   - Leads/follow-up queue.
   - Audit timeline.
   - Metrics/dashboard view.

5. Tighten contract normalization after backend stabilizes.
   - Keep broad normalization while integrating.
   - Gradually remove aliases and compatibility fallbacks once canonical response shapes are proven.
   - `sendTranscriptForSession` still falls back from `/transcript` to `/send-transcript`.

6. Build fuller test coverage.
   - Web Playwright smoke for login, session selection, transfer, reply, note, transcript.
   - Failure-path tests for backend codes like `LEAD_CAPTURE_REQUIRED`, `INQUIRY_CAPTURE_REQUIRED`, `INVALID_SESSION_STATE`, `TRANSFER_NOT_REQUESTED`, auth/forbidden codes.
   - Mobile component/integration tests for auth, dashboard filters, session actions, and availability heartbeat.

### P2 - Product Polish And Scale

1. Add pagination/cursors for large session lists.
2. Add operator SLA indicators and aging warnings.
3. Add keyboard shortcuts for web support agents.
4. Add mobile deep linking from push payload to session detail.
5. Add admin coverage view by product, tenant, department, user, and heartbeat freshness.
6. Add production monitoring docs: frontend errors, API error rates, notification failures, stale availability, close failures.
7. Add release certification artifacts for web and mobile.

## Security Risks

### High Priority

- Backend remains the only valid enforcement point. The frontend disables or guides actions, but direct API calls can bypass UI controls if backend checks are incomplete.
- Root and mobile dependency audits currently fail. This should block production release until reviewed and remediated or formally risk-accepted.
- Local token fallback in web `localStorage` and mobile AsyncStorage increases impact if a device/browser profile is compromised.
- Mobile delete-account action deletes the Firebase user from the client. For an internal support app, this may be too powerful and can create support-user/backend mismatch. Prefer admin-driven deactivation or remove this from production builds.
- Mobile auth error messages expose Firebase project diagnostics to users. This is helpful for development but should be reduced in production.
- Diagnostic panels and backend traces must remain role-gated and should not expose raw claims, stack traces, provider credentials, or internal IDs beyond what support admins need.
- Push notification payloads must avoid sensitive transcript content. Current local notification uses only visitor/product, which is reasonable; backend push should keep that discipline.

### Medium Priority

- Web `localStorage` stores filters, role cache, selected session, auth email preference, and fallback token. Treat role cache as display-only; never as authority.
- `app.config.js` reads parent `.env` and `.env.local` into Expo config. Firebase public config is expected, but avoid embedding secrets in Expo `extra`.
- Broad response normalization can mask backend contract drift. Good for pilot, risky for long-term correctness.
- The admin panel allows sensitive support-user and department management. Backend super-admin enforcement and audit logging must be verified.
- Mobile product default falls back to Merxus, which risks accidental cross-product blind spots or wrong queue assumptions.

## Recommended Improvements

### Architecture

- Add `GET /support/me` as the clean source of current support identity and role. Use it on both web and mobile boot.
- Keep Firebase custom claims as cache only; backend support-user record must be source of truth.
- Formalize canonical response shapes for list, detail, action success, and error payloads.
- Add correlation IDs to API responses and client logs.

### Web

- Continue extracting render and workflow helpers from `src/main.js`.
- Hide diagnostics in normal operation unless role and environment allow it.
- Add a visible notification/audit timeline in session detail.
- Add active filter summary everywhere a filter can hide sessions.
- Keep transcript defaults customer-safe.

### Mobile

- Use SecureStore for tokens.
- Register Expo push token with backend and support token revocation/update.
- Implement push deep linking.
- Replace hard-coded Merxus filtering with backend-derived products or assigned-to-me sessions.
- Add internal notes, lead capture, and inquiry capture.
- Remove or protect delete-account behavior for production.

### DevOps And Release

- Fix git dubious ownership locally or document the required `safe.directory` setup for this repo.
- Decide whether release QA files under `.github/`, `scripts/`, and `release-test.config.js` are intended to be committed.
- Add mobile CI for `npm --prefix mobile-support-app run typecheck`.
- Add root and mobile `npm audit` review to release certification, with defined exception handling.

## Suggested Next Sprint

1. Dependency/security remediation.
   - Update packages.
   - Re-run root/mobile audits.
   - Remove tracked debug keystore if appropriate.

2. Backend contract proof.
   - Add/verify integration tests for auth, tenant/product scope, state transitions, lead/inquiry enforcement, notification receipts, and availability expiry.

3. Mobile production hardening.
   - Secure token storage.
   - Assigned-to-me sessions.
   - Push token registration.
   - Remove production delete-account path.

4. Web maintainability.
   - Extract session action workflows and admin workflows from `src/main.js`.
   - Add Playwright happy path and failure path smoke tests.

## Bottom Line

The product has the right shape. The web console is feature-rich enough for internal operations, and the mobile app is a useful MVP companion. The next phase should be less about adding buttons and more about proving authority, reducing security exposure, stabilizing contracts, and making the codebase easier to evolve without regression.
