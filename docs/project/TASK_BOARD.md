# PSEE Operational Task Board

**Canonical path:** `docs/project/TASK_BOARD.md`  
**Purpose:** Primary operational source for implementation backlog, dependencies, progress, verification, and agent handoff.  
**Last reviewed:** 2026-11-12  
**Repository state observed:** `main` at `c0f9de33ea59286fbdac4d9691e5db8695924042`  
**Task ID convention:** No prior task IDs or taskboard were found. This board starts the repository-local sequence at `TASK-0001`; future tasks continue it.

## Project Implementation Overview

PSEE is currently a TypeScript 0.1.0 package for free-first multi-agent orchestration. The repository has working, directly tested foundations for SQLite state, model registration, free-first routing, checkpoints, and isolated Git worktrees. Provider/model adapters exist for Ollama, 9Router, and OpenCode, but their network/process contracts are not covered by automated tests. There is no discovered end-to-end orchestration service that connects task execution, policy selection, adapter execution, persistence, and recovery.

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
| Ollama adapter | `src/adapters/ollama.adapter.ts`; `test/adapters.test.ts` | Implemented and contract-tested |
| 9Router adapter | `src/adapters/ninerouter.adapter.ts`; `test/adapters.test.ts` | Implemented and contract-tested |
| OpenCode agent bridge | `src/adapters/opencode.adapter.ts`; `test/adapters.test.ts` | Implemented and contract-tested |
| End-to-end task orchestration | `src/orchestration/orchestration.service.ts`; `test/orchestration.test.ts` | Implemented and deterministically tested |
| Durable execution/audit lifecycle | `src/persistence/execution.persistence.ts` plus orchestration status updates | Partial / unverified |
| Frontend API contract | `docs/api/openapi.yaml`; `test/contract.test.ts` | Baseline approved; HTTP handlers pending |
| Production operations and deployment | No deployment/runbook implementation found | Missing |

## Priority Backlog

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
- **Status:** IN_PROGRESS
- **Dependencies:** TASK-0001, TASK-0003
- **Acceptance Criteria:** Core service and deterministic tests are implemented; canonical frontend contract exists; remaining lifecycle handlers are explicit before completion.
- **Progress:** 88%
- **Related Docs:** `src/orchestration/orchestration.service.ts`, `test/orchestration.test.ts`, `docs/api/openapi.yaml`, `src/persistence/execution.persistence.ts`
- **Notes:** Successful, policy-rejected, adapter-failure, timeout/interrupt classification, safe cancellation through `abortTask`, persistence updates, correlation IDs, worktree handoff, checkpoint handoff, and in-process idempotency replay are implemented. Remaining: HTTP handlers, recovery execution semantics, persistence/checkpoint failure handling, invalid transition enforcement, and broader contract validation.

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
- **Status:** BLOCKED
- **Dependencies:** TASK-0001
- **Acceptance Criteria:** All adapter failure classes have stable, tested behavior and sanitized error details.
- **Progress:** 0%
- **Related Docs:** `src/adapters/*.ts`, `src/types/index.ts`, `FREE_TIER_PROVIDER_POLICY.md`
- **Notes:** Do not pre-implement fixes without failing contract evidence.

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
- **Status:** READY
- **Dependencies:** None
- **Acceptance Criteria:** Failure and replacement semantics are explicit and tested without claiming Git checkpoints are chain-of-custody evidence.
- **Progress:** 0%
- **Related Docs:** `src/checkpoint/checkpoint.engine.ts`, `src/db/database.ts`, `AI_AGENT_ACCEPTANCE_TESTS.md`
- **Notes:** Current coverage verifies only one successful save/read path.

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

1. **TASK-0002** — finalize and implement the orchestration service now that adapter, persistence, policy, and registry seams are tested.
2. **TASK-0006** — recovery-path coverage alongside orchestration design.
3. **TASK-0004** — only if further integration evidence identifies adapter lifecycle/error gaps.
4. **TASK-0004** — only if further integration evidence identifies adapter lifecycle/error gaps.
5. **TASK-0007** — environment verification after deterministic adapter behavior is established.
6. **TASK-0008** — operational readiness after runtime wiring exists.

These are implementation dependencies based on observed code boundaries, not new architecture approvals.

## Blocked Tasks and Reasons

| Task | Reason |
|---|---|
| TASK-0002 | Orchestration API and persistence seam are not yet defined; implementation would be speculative. |
| TASK-0004 | Requires concrete failures or gaps from adapter contract tests. |
| TASK-0007 | Depends on deterministic adapter behavior and environment-specific verification boundaries. |
| TASK-0008 | Deployment target and runnable operational surface are not specified. |

## Testing and Verification Status

### Verified in this working tree

- `npm test` — 12 tests passed, 0 failed.
- `npm run build` — TypeScript compilation passed.
- `git diff --check` — passed.
- The suite covers database initialization, registry registration, two policy routes, checkpoint save/read, worktree create/list/remove, adapter normalization, HTTP failure classification, malformed responses, and timeout outcomes.

### Not yet verified

- Live provider availability and real service response compatibility; deterministic contract tests do not replace environment verification.
- End-to-end orchestration.
- Durable execution and audit lifecycle service behavior.
- Deployment and operational readiness.
- Manual UAT; none is claimed.

## Recently Completed Tasks

- **TASK-0001** — Automated adapter contract coverage; deterministic provider/process tests completed.
- **TASK-0003** — Execution persistence and audit service boundary; typed lifecycle persistence completed.
- **TASK-0005** — Policy and registry edge-case coverage; five deterministic edge-case tests completed.

## Next Recommended Tasks

1. Add recovery and durable idempotency semantics.
2. Build the frontend against `docs/api/openapi.yaml`.
3. Add deployment/runbook verification for the configured runtime.

## Agent Handoff Notes

- Start by reading this file and the task's related source paths.
- Keep one selected task `IN_PROGRESS` at a time unless a dependency explicitly requires parallel work.
- Update progress only from code, test, build, or runtime evidence.
- `DONE` requires acceptance criteria and verification evidence; documentation alone is insufficient.
- `UAT` requires explicit user verification and must not be claimed by an agent.
- Do not stage or commit changes as part of task execution unless separately authorized.
- Preserve unrelated worktree changes, including the existing untracked architecture documentation.
