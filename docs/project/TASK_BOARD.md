# PSEE Operational Task Board

**Canonical path:** `docs/project/TASK_BOARD.md`  
**Purpose:** Primary operational source for implementation backlog, dependencies, progress, verification, and agent handoff.  
**Last reviewed:** 2026-11-18

**Repository state observed:** `main` at `f0927df` with uncommitted Phase 4 changes (adapter, tests, this board, and the TASK-0004 plan)
**Task ID convention:** No prior task IDs or taskboard were found. This board starts the repository-local sequence at `TASK-0001`; future tasks continue it.

## Project Implementation Overview

PSEE is currently a TypeScript 0.1.0 package for free-first multi-agent orchestration. The repository has working, directly tested foundations for SQLite state, model registration, free-first routing, checkpoints, isolated Git worktrees, and end-to-end task orchestration. Provider/model adapters exist for Ollama, 9Router, and OpenCode with classified error normalization and sanitized output. Adapter lifecycle hardening (TASK-0004) is complete and operator-approved; the OpenCode abort path has guarded exactly-once settlement and SIGTERM→SIGKILL escalation with deterministic test coverage.

This board records implementation evidence only. Architecture documents, including the canonical decision register, constrain future work but do not establish implementation completion.

## Current Implementation Status

| Area | Evidence | Status |
|---|---|---|
| TypeScript build | `npm run build` passed | Implemented and verified |
| SQLite schema/state | `src/db/database.ts`; system test 1 passed | Implemented and verified |
| Model/provider registry | `src/registry/model.registry.ts`; system test 2 passed | Implemented and verified |
| Free-first routing | `src/policy/policy.engine.ts`; system test 3 passed | Implemented and verified for covered cases |
| Checkpoint persistence | `src/checkpoint/checkpoint.engine.ts`; system test 4 passed | Implemented and verified for covered case |
| Git worktree isolation | `src/isolation/worktree.manager.ts`; system test 5 passed | Implemented and verified for covered case |
| Ollama adapter | `src/adapters/ollama.adapter.ts`; `test/adapters.test.ts` | Implemented, contract-tested, error-normalized (TASK-0004) |
| 9Router adapter | `src/adapters/ninerouter.adapter.ts`; `test/adapters.test.ts` | Implemented, contract-tested, error-normalized (TASK-0004) |
| OpenCode agent bridge | `src/adapters/opencode.adapter.ts`; `test/adapters.test.ts` | Implemented, contract-tested, hardened and verified (TASK-0004 DONE) |
| End-to-end task orchestration | `src/orchestration/orchestration.service.ts`; `test/orchestration.test.ts` | Implemented and deterministically tested |
| Durable execution/audit lifecycle | `src/persistence/execution.persistence.ts` plus orchestration status updates | Partial / unverified |
| Frontend API contract | `docs/api/openapi.yaml`; `test/contract.test.ts` | Baseline approved; HTTP handlers implemented |
| Local frontend serving and CORS | `src/api/http-server.ts`; `test/static-serving.test.ts`; `docs/project/LOCAL_DEVELOPMENT.md` | Implemented and verified |
| Production operations and deployment | Local runbook present; broader deployment target still unspecified | Partial |

## Priority Backlog

### [TASK-0014] Local deployment and frontend-backend integration

- **Description:** Make the browser frontend connect to the local PSEE runtime with configurable API addressing and documented same-origin/CORS options.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0010, TASK-0011, TASK-0013
- **Acceptance Criteria:** API base configuration, browser request routing, CORS handling, local runbook, and deterministic configuration coverage are implemented; a full live browser deployment is not claimed without a static server verification. **Met:** same-origin `/api` default, meta-configured API base, opt-in `PSEE_CORS_ORIGIN`, runtime static serving of `frontend/` with traversal protection, local runbook, and deterministic tests for config/CORS/static serving.
- **Progress:** 100%
- **Related Docs:** `frontend/src/api-client.ts`, `frontend/index.html`, `src/api/http-server.ts`, `src/runtime/bootstrap.ts`, `docs/project/LOCAL_DEVELOPMENT.md`, `test/frontend-config.test.ts`, `test/static-serving.test.ts`, `test/http-api.test.ts`
- **Notes:** `npm start` serves the dashboard from `PSEE_STATIC_ROOT` (default `frontend`) at `/` while preserving `/api` routes. Browser UAT remains operator-dependent and is not claimed.

### [TASK-0013] PSEE frontend application

- **Description:** Build a browser-native TypeScript dashboard for overview, task submission, and task monitoring using the approved API contract.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0009, TASK-0010, TASK-0011, TASK-0012
- **Acceptance Criteria:** Frontend files exist under `frontend/`; API calls are isolated in `src/api-client.ts`; the three requested interfaces, loading/empty/error/success states, responsive accessible styling, and frontend compilation are implemented.
- **Progress:** 100%
- **Related Docs:** `frontend/index.html`, `frontend/styles.css`, `frontend/src/app.ts`, `frontend/src/api-client.ts`, `frontend/src/types.ts`, `tsconfig.frontend.json`
- **Notes:** Uses browser-native DOM and Fetch APIs with no new dependencies. `npm run build` compiles backend and frontend. No backend files were restructured or behavior changed.

### [TASK-0001] Add automated adapter contract coverage

- **Description:** Test Ollama and 9Router HTTP health/model-discovery/inference normalization, plus OpenCode availability, execution success, timeout, and abort behavior using deterministic local mocks. Keep tests at the adapter boundary; do not require live providers or the `opencode` binary.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** None
- **Acceptance Criteria:**
  - Adapter tests run without network access or external provider processes. **Met:** tests use mocked `fetch` and temporary fake OpenCode executables.
  - Ollama and 9Router map representative OpenAI-compatible responses into `NormalizedResponse`. **Met:** both adapters normalize valid responses and reject malformed response bodies.
  - Non-OK provider responses and request timeouts produce bounded errors. **Met:** 9Router 429 and Ollama abort/timeout behavior are covered.
  - OpenCode maps successful, non-zero, and timed-out child-process outcomes correctly. **Met:** all three outcomes are covered.
  - Existing system tests continue to pass. **Met:** all existing and adapter tests pass.
- **Progress:** 100%
- **Related Docs:** `src/adapters/ollama.adapter.ts`, `src/adapters/ninerouter.adapter.ts`, `src/adapters/opencode.adapter.ts`, `src/types/index.ts`, `src/scripts/verify-adapters.ts`
- **Notes:** Completed with deterministic adapter contract coverage in `test/adapters.test.ts`. Added minimal malformed-response validation to the Ollama and 9Router adapters because the new tests exposed silent acceptance of invalid provider responses. No live-provider verification or manual UAT is claimed.

### [TASK-0012] Production API integration and runtime readiness tests

- **Description:** Verify the complete deterministic runtime through its actual HTTP interface.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0009, TASK-0010, TASK-0011
- **Acceptance Criteria:** Runtime startup/readiness, submission, status, cancellation coverage boundary, invalid errors, correlation IDs, idempotency, shutdown, database cleanup/isolation, and OpenAPI endpoint alignment are tested without live providers.
- **Progress:** 100%
- **Related Docs:** `test/runtime-integration.test.ts`, `src/runtime/bootstrap.ts`, `src/api/http-server.ts`, `docs/api/openapi.yaml`
- **Notes:** Added injectable adapter/worktree overrides for deterministic runtime integration. Fixed production bootstrap seed metadata, correlation ID preservation, and database isolation. The integration test covers submission, replay, status, invalid request, missing task, and clean shutdown; cancellation remains covered by the existing API/service tests.

### [TASK-0011] Production runtime CLI entrypoint

- **Description:** Connect the runtime bootstrap to `npm start` with environment configuration and graceful signal shutdown.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0010
- **Acceptance Criteria:** `npm start` uses `startPseeRuntime()`, SIGINT/SIGTERM close the runtime once, startup failures set non-zero exit status with sanitized errors, and CLI behavior is deterministically tested.
- **Progress:** 100%
- **Related Docs:** `src/runtime/cli.ts`, `test/cli.test.ts`, `package.json`
- **Notes:** No dependency added. Credentials and sensitive configuration are not logged. The previous planned frontend/API integration numbering is preserved; TASK-0011 is the CLI entrypoint.

### [TASK-0010] Production HTTP server bootstrap and runtime configuration

- **Description:** Initialize the database, policy, adapter, worktree, checkpoint, orchestration service, and HTTP server through a configurable runtime bootstrap.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0002, TASK-0009
- **Acceptance Criteria:** Environment configuration, safe defaults, startup failure cleanup, clean shutdown, real component wiring, and deterministic bootstrap tests are implemented.
- **Progress:** 100%
- **Related Docs:** `src/runtime/bootstrap.ts`, `test/bootstrap.test.ts`, `src/api/http-server.ts`
- **Notes:** Uses Node built-ins and existing components only. Resolved the prior numbering conflict by assigning TASK-0010 to runtime bootstrap; API integration tests remain part of TASK-0009 evidence.

### [TASK-0009] Add HTTP API handlers for the orchestration contract

- **Description:** Expose the approved orchestration contract through Node's built-in HTTP server.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** TASK-0002
- **Acceptance Criteria:** `POST /api/tasks`, `GET /api/tasks?taskId=...`, and `POST /api/tasks/{taskId}/cancel` implemented; request validation, errors, correlation IDs, idempotency keys, policy rejection, lookup, cancellation, and missing-task behavior tested.
- **Progress:** 100%
- **Related Docs:** `src/api/http-server.ts`, `test/http-api.test.ts`, `docs/api/openapi.yaml`
- **Notes:** Uses Node built-in `http`; no new dependency added. The adapter/service wiring remains injectable for deterministic tests. A production bootstrap/listen configuration is not added in this task.

### [TASK-0002] Define and implement the task orchestration service

- **Description:** Connect task creation, model/policy selection, adapter execution, execution result persistence, correlation IDs, and checkpoint handoff behind one explicit service API.
- **Priority:** Critical
- **Status:** DONE
- **Dependencies:** TASK-0001, TASK-0003
- **Acceptance Criteria:** Core service and deterministic tests are implemented; canonical frontend contract exists; checkpoint failure handling, recovery execution semantics (`resume`), and invalid state transition enforcement are fully implemented and verified.
- **Progress:** 100%
- **Related Docs:** `src/orchestration/orchestration.service.ts`, `test/orchestration.test.ts`, `docs/api/openapi.yaml`, `src/persistence/execution.persistence.ts`
- **Notes:** Successful, policy-rejected, adapter-failure, timeout/interrupt classification, safe cancellation through `abortTask`, persistence updates, correlation IDs, worktree handoff, checkpoint handoff, in-process idempotency replay, checkpoint persistence failure handling (`CHECKPOINT_ERROR`), invalid state transition enforcement (`INVALID_STATE`), and checkpoint-based recovery execution (`resume`) are fully implemented and deterministically tested.

### [TASK-0003] Add execution persistence and audit service boundaries

- **Description:** Implement typed persistence operations for tasks, agent executions, routing logs, usage records, incidents, and audit events instead of direct raw SQL from callers.
- **Priority:** Critical
- **Status:** DONE
- **Dependencies:** None
- **Acceptance Criteria:** Typed service methods cover the minimum lifecycle needed by orchestration; foreign-key and failure behavior are tested; sensitive values are not persisted as raw secrets; existing schema remains compatible. **Met:** `ExecutionPersistenceService` covers task create/read, execution, routing logs, usage, and audit events; tests cover foreign-key failure and secret-column absence; existing schema remains unchanged.
- **Progress:** 100%
- **Related Docs:** `src/db/database.ts`, `src/persistence/execution.persistence.ts`, `test/persistence.test.ts`, `PSEE_AI_Infrastructure_v1.0/AI_DATABASE_SCHEMA.md`, `PSEE_AI_Infrastructure_v1.0/AI_MONITORING_SPEC.md`
- **Notes:** Added the typed persistence boundary and exported it from `src/index.ts`. Verification: 15 tests passed, TypeScript build passed, and `git diff --check` passed. Incident persistence and execution update methods remain outside this minimal task scope and should be added only when orchestration requires them.

### [TASK-0004] Harden adapter lifecycle and error normalization

- **Description:** After contract tests identify behavior gaps, make provider and process adapters consistently classify timeout, availability, non-OK response, and malformed response failures without leaking secrets.
- **Priority:** High
- **Status:** DONE — implementation and test evidence complete; operator-approved closeout on 2026-11-18.
- **Dependencies:** TASK-0001
- **Acceptance Criteria:**
  - All adapter failure classes have stable, tested behavior and sanitized error details. **Met (Phases 1–2).**
  - OpenCode timeout path escalates from SIGTERM to SIGKILL with bounded cleanup. **Met — genuine SIGTERM-resistant fixture asserts signal order and ≥2800ms grace.**
  - OpenCode `abortTask` does not leave `executeTask` promises unresolved. **Met (Phase 4a; abort settles the promise).**
  - OpenCode `abortTask` escalates to SIGKILL if the process survives SIGTERM. **Met — committed test asserts SIGTERM then SIGKILL, process termination, and empty maps; mutation check confirmed failure when SIGKILL is removed.**
  - Exactly-once promise settlement across error/close/abort/timeout races. **Met — dedicated tests for abort→close, error→close, timeout→abort, abort→timeout, abort-after-exit, repeated abort.**
  - A deterministic test covers the real adapter's abort→close→settlement path. **Met (real `OpenCodeBridgeAdapter` with signal spy).**
  - Assertions explicitly verify SIGTERM and SIGKILL delivery. **Met (`ChildProcess.prototype.kill` spy + SIGTERM marker file).**
  - `npm test` and `npm run build` pass after remediation. **Met (65/65 tests, 20/20 adapter tests, 4/4 sanitization tests, build succeeded).**
- **Progress:** 100%
- **Related Docs:** `src/types/adapter-errors.ts`, `src/adapters/ollama.adapter.ts`, `src/adapters/ninerouter.adapter.ts`, `src/adapters/opencode.adapter.ts`, `test/adapters.test.ts`, `test/sanitization.test.ts`, `docs/project/plans/TASK-0004-IMPLEMENTATION-PLAN.md`
- **Implementation Commits:** `7a89e1f` (error classification foundation), `f0927df` (adapter normalization and OpenCode hardening). Phase 4 changes are uncommitted on `main`.
- **Resolved Defects:** D1 (premature `activeProcesses` deletion) and D2 (missing abort escalation) are fixed. `settle()` is the single terminal path; timers are cleared; both maps are cleaned up exactly once.
- **Test-Evidence Remediation (2026-11-18):**
  - Prior false-positive `trap "" TERM` escalation tests were replaced with a Node.js SIGTERM-resistant fixture (readiness file, SIGTERM marker file, stays alive until SIGKILL) and a `ChildProcess.prototype.kill` spy.
  - Fixtures are SIGKILLed in `afterEach` and temp dirs removed — no orphan processes.
  - Escalation test asserts SIGTERM delivered first, SIGKILL after ≥2800ms, process dead, promise unsettled during grace, and both maps empty. A separate test confirms no delayed SIGKILL after early exit.
  - Mutation check: removing `child.kill('SIGKILL')` made the escalation test fail; source restored and verified.
- **Known Limitations:**
  - Detached subprocess lifecycle is not independently managed. SIGTERM/SIGKILL may not reach grandchild processes.
  - Sanitization covers Bearer tokens and `sk-`/`ag-` key patterns only. Other vendor key formats may appear in output.
  - Live-provider and multi-user/network soak testing have not been performed (deferred to TASK-0007).
- **Notes:** All acceptance criteria are demonstrably satisfied. Formally approved and closed by the operator on 2026-11-18.

### [TASK-0005] Add policy and registry edge-case coverage

- **Description:** Cover empty provider/model availability, unsupported sensitivity/role combinations, disabled/quarantined models, duplicate registrations, and routing fallback behavior.
- **Priority:** High
- **Status:** DONE
- **Dependencies:** None
- **Acceptance Criteria:** Edge cases have deterministic tests and behavior is documented by test names; no unapproved routing policy is introduced. **Met:** five deterministic tests cover secret-without-local rejection, local fallback, exhausted routing, disabled/quarantined filtering, and duplicate model update preservation.
- **Progress:** 100%
- **Related Docs:** `src/policy/policy.engine.ts`, `src/registry/model.registry.ts`, `test/policy-registry.test.ts`, `test/system.test.ts`, `PSEE_AI_Infrastructure_v1.0/AI_ROUTING_POLICY.md`
- **Notes:** No production behavior changes were needed. Verification: 20 tests passed, TypeScript build passed, and `git diff --check` passed.

### [TASK-0006] Add recovery and checkpoint failure-path coverage

- **Description:** Test missing tasks, checkpoint replacement, malformed serialized checkpoint data, dirty-worktree metadata, and recovery handoff boundaries.
- **Priority:** Medium
- **Status:** DONE
- **Dependencies:** None
- **Acceptance Criteria:** Failure and replacement semantics are explicit and tested without claiming Git checkpoints are chain-of-custody evidence.
- **Progress:** 100%
- **Related Docs:** `src/checkpoint/checkpoint.engine.ts`, `src/db/database.ts`, `AI_AGENT_ACCEPTANCE_TESTS.md`
- **Notes:** Dedicated checkpoint coverage in `test/checkpoint.test.ts` for missing tasks, replacement, and malformed data. Recovery handoff boundaries verified in `test/orchestration.test.ts`.

### [TASK-0007] Add integration verification for configured providers and OpenCode bridge

- **Description:** Separate deterministic tests from opt-in environment verification for configured Ollama, 9Router, and OpenCode endpoints/binaries, with sanitized reports and explicit offline outcomes.
- **Priority:** Medium
- **Status:** BLOCKED
- **Dependencies:** TASK-0001, TASK-0004
- **Acceptance Criteria:** Verification distinguishes unavailable dependencies from implementation failures and never requires credentials in source or tests.
- **Progress:** 0%
- **Related Docs:** `src/scripts/verify-adapters.ts`, `config/psee.config.json`, `PSEE_AGENT_DISCOVERY_AND_HEALTHCHECK.md`
- **Notes:** Existing script is a manual spike and depends on local environment state.

### [TASK-0008] Define deployment and operational readiness checks

- **Description:** Establish the minimum supported runtime, database path/backup expectations, provider configuration checks, logging, and shutdown behavior for a runnable development/production process.
- **Priority:** Low
- **Status:** BLOCKED
- **Dependencies:** TASK-0002, TASK-0003, TASK-0007
- **Acceptance Criteria:** A bounded runbook and executable readiness checks exist; deployment claims are backed by execution evidence.
- **Progress:** 0%
- **Related Docs:** `package.json`, `config/psee.config.json`, `PSEE_PHASE0_READINESS_REPORT.md`
- **Notes:** No deployment target is specified in the repository; avoid inventing one.

## Dependency-Aware Execution Order

1. **TASK-0006** — recovery-path coverage alongside orchestration design.
2. **TASK-0004** — complete Phase 4 remediation (D1, D2, abort test, verification).
3. **TASK-0007** — environment verification after deterministic adapter behavior is established.
4. **TASK-0008** — operational readiness after runtime wiring exists.

These are implementation dependencies based on observed code boundaries, not new architecture approvals.

## Blocked Tasks and Reasons

| Task | Reason |
|---|---|
| TASK-0007 | Depends on deterministic adapter behavior and environment-specific verification boundaries. |
| TASK-0008 | Deployment target and runnable operational surface are not specified. |

## Testing and Verification Status

### Verified in this working tree (2026-11-18, final remediation pass)

- `npx tsx --test test/adapters.test.ts` — **20 tests passed, 0 failed** (two consecutive runs; real SIGTERM-resistant escalation and race tests included).
- `npx tsx --test test/sanitization.test.ts` — **4 tests passed, 0 failed** (this file is not in the `npm test` script's file list).
- `npm test` — **65 tests passed, 0 failed** (6 suites).
- `npm run build` — succeeded (TypeScript backend + frontend, no errors).
- `git diff --check` — clean.
- Mutation check: removing `child.kill('SIGKILL')` from the adapter caused the escalation test to fail; source restored and verified.
- The suite covers database initialization, registry registration, policy routes, checkpoint save/read, worktree create/list/remove, adapter normalization, HTTP failure classification, malformed responses, timeout outcomes, sanitization, spawn errors, abort settlement, signal-ordered SIGTERM→SIGKILL escalation, no-delayed-SIGKILL, error/close and timeout/abort races, clean shutdown, orchestration, HTTP API, runtime integration, frontend config, static serving, and CLI entrypoint.

### Not yet verified

- Live provider availability and real service response compatibility; deterministic contract tests do not replace environment verification.
- Multi-user / network soak testing (deferred to TASK-0007).
- Durable execution and audit lifecycle service behavior.
- Deployment and operational readiness.
- Manual UAT; none is claimed.

## Recently Completed Tasks

- **TASK-0014** — Local frontend-backend integration; same-origin static serving, CORS opt-in, API base config, and local runbook completed.
- **TASK-0013** — Native TypeScript orchestration dashboard completed.
- **TASK-0012** — Production API integration and runtime readiness tests completed.
- **TASK-0011** — Production runtime CLI entrypoint completed.
- **TASK-0010** — Production HTTP server bootstrap completed.
- **TASK-0009** — HTTP API handlers for the orchestration contract completed.
- **TASK-0001** — Automated adapter contract coverage; deterministic provider/process tests completed.
- **TASK-0003** — Execution persistence and audit service boundary; typed lifecycle persistence completed.
- **TASK-0005** — Policy and registry edge-case coverage; five deterministic edge-case tests completed.

## Next Recommended Tasks

1. Add recovery and checkpoint failure-path coverage (TASK-0006).
2. Add broader deployment/runbook verification only after a deployment target is specified (TASK-0008).

## Agent Handoff Notes

- Start by reading this file and the task's related source paths.
- Keep one selected task `IN_PROGRESS` at a time unless a dependency explicitly requires parallel work.
- Update progress only from code, test, build, or runtime evidence.
- `DONE` requires acceptance criteria and verification evidence; documentation alone is insufficient.
- `UAT` requires explicit user verification and must not be claimed by an agent.
- Do not stage or commit changes as part of task execution unless separately authorized.
- Preserve unrelated worktree changes, including the existing untracked architecture documentation.
