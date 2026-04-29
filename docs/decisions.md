# Workside Support Console Decisions

## 2026-04-28: Codex Context Files
Decision: Add root-level context documents (`AGENTS.md`, `ARCHITECTURE.md`, `AI_CONTRACT.md`, `DECISIONS.md`) and mirror the same content into `docs/` lowercase files.

Why: `docs/codex_workflow_system.md` requires these files, and root-level `AGENTS.md` is the conventional entry point for coding agents. The existing `docs/agents.md` and `docs/architecture.md` were present but empty.

Tradeoff: This duplicates a small amount of documentation, but it gives both tool-facing and human-facing entry points a complete contract.

Future: If documentation grows, keep root files concise and move deeper implementation guides under `docs/`.

## 2026-04-28: Backend as Enforcement Authority
Decision: Treat frontend guards as workflow assistance only. Backend support routes must enforce authentication, role access, product/tenant scope, lead capture, inquiry capture, state transitions, and audit logging.

Why: Direct API calls can bypass UI checks. Sensitive support workflows need server-side truth.

Tradeoff: The frontend still contains some duplicate checks for better agent experience.

Future: Add backend integration tests for blocked close, blocked transfer, invalid takeover, invalid reply, tenant denial, and product denial.

## 2026-04-28: Canonical `/support` Routes
Decision: Use canonical `/support` endpoints from the frontend API client instead of endpoint guessing.

Why: A stable API contract makes diagnostics, backend implementation, and QA repeatable.

Tradeoff: Backend compatibility must be kept current with the documented route contract.

Future: Add contract tests or smoke checks that validate every canonical route used by `src/services/chat.js`.
