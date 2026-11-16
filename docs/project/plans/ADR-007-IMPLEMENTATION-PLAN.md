# Implementation Plan: ADR-AI-007 Server-Side Authoritative Model Discovery

**Associated ADR:** `docs/architecture/decisions/ADR-AI-007-server-side-authoritative-model-discovery.md`  
**Status:** APPROVED FOR IMPLEMENTATION PLANNING  
**Created:** 2026-11-16  
**Document ID:** PSEE-PLAN-ADR-007  

---

## 1. Overview and Objectives

This plan details the implementation steps required to realize **ADR-AI-007** (Server-Side Authoritative Model Availability Discovery for Task Routing). It resolves the runtime `ROUTING_EXHAUSTED` failure occurring during dashboard task submission without requiring the frontend to provide hardware or provider model lists.

---

## 2. Tracked Prerequisites (Outside Current Implementation Scope)

The following items are tracked dependencies requiring separate architectural decisions and are strictly excluded from this implementation pass:
1. **Durable `retry_after_at` Schema Migration:** Requires a dedicated database migration decision to add `retry_after_at` to the `model_health_checks` table. *Interim handling:* Retry-After state will be tracked in-memory by provider adapters.
2. **Health-Check Probing Frequency Specification:** Explicit polling intervals, backoff schedules, and quota bounds must be approved in `AI_MONITORING_SPEC.md` before automated background probing is introduced. *Interim handling:* Relies on passive health tracking during task execution and manual/lightweight endpoint pings.

---

## 3. Work Breakdown Structure

### Phase 1: ModelRegistryService Query & Snapshot Cache Integration
- **Objective:** Enable server-side retrieval of verified models partitioned by provider tier (`local` vs `gateway`).
- **Files Affected:** `src/registry/model.registry.ts`
- **Work Items:**
  1. Add helper method `getVerifiedModelsByTier()` in `ModelRegistryService` that queries active, enabled models with status `CONNECTIVITY_VERIFIED` or `QUALIFIED`, joined with `ai_providers.provider_type`.
  2. Implement a lightweight in-memory candidate snapshot cache inside the service.
  3. Ensure synchronous cache invalidation upon any mutating operations (`registerModel()`, status updates, or enable/disable toggles).

### Phase 2: Orchestration Service & Bootstrap Dependency Wiring
- **Objective:** Wire `ModelRegistryService` into `OrchestrationService` and bootstrap initialization.
- **Files Affected:**
  - `src/orchestration/orchestration.service.ts`
  - `src/runtime/bootstrap.ts`
- **Work Items:**
  1. Extend `OrchestrationDependencies` to accept a candidate model resolver (e.g. `getModelCandidates: () => Promise<{ availableLocalModels: string[]; availableGatewayModels: string[] }>` or `modelRegistry: ModelRegistryService`).
  2. In `OrchestrationService.execute()`, resolve model candidates server-side if `request.availableLocalModels` and `request.availableGatewayModels` are empty or omitted.
  3. Preserve support for explicit test arrays when passed in test suites.
  4. In `src/runtime/bootstrap.ts`, wire the real `ModelRegistryService` instance into the `OrchestrationService` instantiation.

### Phase 3: HTTP API Contract & Error Mapping Alignment
- **Objective:** Ensure incoming HTTP requests without model lists are properly normalized and diagnostic error messages are returned when routing is legitimately exhausted.
- **Files Affected:**
  - `src/api/http-server.ts`
  - `docs/api/openapi.yaml` (validation only; no breaking schema change)
- **Work Items:**
  1. Update `src/api/http-server.ts` to allow `availableLocalModels` and `availableGatewayModels` to be undefined/omitted in `task` input without forcing them to block server-side discovery.
  2. Map `ROUTING_EXHAUSTED` errors to structured HTTP 422 `PolicyRejected` responses with actionable diagnostic messages (e.g., distinguishing between zero models qualified vs. all models quarantined/rate-limited).

### Phase 4: Verification and Test Suite Updates
- **Objective:** Validate end-to-end task submission without client-provided model inventories.
- **Files Affected:**
  - `test/orchestration.test.ts`
  - `test/http-api.test.ts`
  - `test/runtime-integration.test.ts`
  - `test/policy-registry.test.ts`
- **Work Items:**
  1. Unit test: Verify `OrchestrationService` queries registry candidates when request lists are omitted.
  2. Integration test: Verify `POST /api/tasks` accepts task metadata only and successfully routes to seeded/verified models in SQLite without `ROUTING_EXHAUSTED`.
  3. Edge case test: Verify clear 422 diagnostic responses when the database contains no qualified models.
  4. Regression test: Ensure all 42 existing tests continue to pass.

---

## 4. Acceptance Criteria

1. Submitting a task via `POST /api/tasks` with only `taskId`, `title`, `role`, and `instructions` succeeds without `ROUTING_EXHAUSTED` as long as verified/qualified models exist in SQLite.
2. Client-supplied model inventory cannot override or bypass backend status verification.
3. Database mutations immediately invalidate the in-memory candidate snapshot.
4. Existing test suites with explicit test candidate arrays continue to pass without modification.
5. All code and test additions pass TypeScript build and `npm test` with zero console/process errors.
