# Implementation Plan: ADR-AI-007 Server-Side Authoritative Model Discovery

**Associated ADR:** `docs/architecture/decisions/ADR-AI-007-server-side-authoritative-model-discovery.md`  
**Status:** COMPLETED AND VERIFIED  
**Created:** 2026-11-16  
**Document ID:** PSEE-PLAN-ADR-007  
**Final Verification Result:** 52/52 system tests passed; build succeeded.

---

## 1. Overview and Objectives

This plan detailed the implementation steps required to realize **ADR-AI-007** (Server-Side Authoritative Model Availability Discovery for Task Routing). It successfully resolved the runtime `ROUTING_EXHAUSTED` failure occurring during dashboard task submission without requiring the frontend to provide hardware or provider model lists. Implementation and verification (Phases 1–4) are complete.

---

## 2. Tracked Prerequisites (Deferred)

The following items remain deferred and are explicitly excluded from this implementation pass:
1. **Durable `retry_after_at` Schema Migration:** Requires a dedicated database migration decision to add `retry_after_at` to the `model_health_checks` table. *Interim handling:* Retry-After state is tracked in-memory by provider adapters.
2. **Health-Check Probing Frequency Specification:** Explicit polling intervals, backoff schedules, and quota bounds must be approved in `AI_MONITORING_SPEC.md` before automated background probing is introduced. *Interim handling:* Passive health tracking during task execution remains the current method.

---

## 3. Work Breakdown Structure (Completed)

### Phase 1: ModelRegistryService Query & Snapshot Cache Integration
- **Objective:** Enable server-side retrieval of verified models partitioned by provider tier (`local` vs `gateway`).
- **Files Affected:** `src/registry/model.registry.ts`
- **Status:** Verified (Tests: `Policy and registry edge cases`)

### Phase 2: Orchestration Service & Bootstrap Dependency Wiring
- **Objective:** Wire `ModelRegistryService` into `OrchestrationService` and bootstrap initialization.
- **Files Affected:**
  - `src/orchestration/orchestration.service.ts`
  - `src/runtime/bootstrap.ts`
- **Status:** Verified (Tests: `Orchestration service`)

### Phase 3: HTTP API Contract & Error Mapping Alignment
- **Objective:** Ensure incoming HTTP requests without model lists are properly normalized and diagnostic error messages are returned when routing is legitimately exhausted.
- **Files Affected:**
  - `src/api/http-server.ts`
  - `docs/api/openapi.yaml`
- **Status:** Verified (Tests: `orchestration HTTP API`)

### Phase 4: Verification and Test Suite Updates
- **Objective:** Validate end-to-end task submission without client-provided model inventories.
- **Files Affected:**
  - `test/orchestration.test.ts`
  - `test/http-api.test.ts`
  - `test/runtime-integration.test.ts`
  - `test/policy-registry.test.ts`
- **Status:** Verified (Result: 52/52 system tests passed, 0 failures)

---

## 4. Acceptance Criteria (Verified)

1. Submitting a task via `POST /api/tasks` with only `taskId`, `title`, `role`, and `instructions` succeeds without `ROUTING_EXHAUSTED` as long as verified/qualified models exist in SQLite. **Met.**
2. Client-supplied model inventory cannot override or bypass backend status verification. **Met.**
3. Database mutations immediately invalidate the in-memory candidate snapshot. **Met.**
4. Existing test suites with explicit test candidate arrays continue to pass without modification. **Met.**
5. All code and test additions pass TypeScript build and `npm test` with zero console/process errors. **Met.**
