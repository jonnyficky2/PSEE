# ADR-AI-007: Server-Side Authoritative Model Availability Discovery

**Document ID:** ADR-AI-007  
**Status:** APPROVED  
**Version:** 2.0  
**Created:** 2026-11-16  
**Approved:** 2026-11-16  
**Approval Provenance:** Explicit project-owner approval  
**Title:** Server-Side Authoritative Model Availability Discovery for Task Routing  

---

## 1. Context

Currently, the PSEE web dashboard submits task requests to `POST /api/tasks` containing only task metadata (`taskId`, `title`, `role`, `instructions`, `dataSensitivity`) per `docs/api/openapi.yaml`. In contrast:
- `RouteRequest` in `src/policy/policy.engine.ts` expects explicit arrays `availableLocalModels` and `availableGatewayModels`.
- `src/api/http-server.ts` defaults missing model lists to empty arrays (`[]`).
- `OrchestrationService` does not resolve model inventory through `ModelRegistryService`.
- Consequently, `FreeFirstPolicyEngine` evaluates an empty candidate list, exhaustively fails all routing rules, and raises `ROUTING_EXHAUSTED`.

## 2. Architecture Decisions

### Decision 1: Server-Side Authoritative Model Discovery
1. The frontend submits task metadata only; it is not responsible for determining model availability.
2. The backend orchestration layer resolves candidate models through `ModelRegistryService` (querying SQLite `ai_models`) before calling `selectRoute`.
3. Client-supplied model inventory (retained for test fixtures) must never override backend-verified registry state.

### Decision 2: Registry Lookup Performance via Controlled Server-Side Snapshot Caching
- **Decision:** Adopt controlled server-side registry snapshot caching within the backend service layer.
- **Requirements & Mechanism:**
  - `ModelRegistryService` remains the sole authority.
  - The runtime maintains a synchronized, in-memory candidate snapshot partitioned by provider tier (`local` vs. `gateway`).
  - Snapshot invalidation is synchronous and event-driven, triggered by `registerModel()`, enable/disable toggles, or lifecycle transitions in the `ModelRegistryService`.
  - No speculative TTLs; consistency is maintained by immediate invalidation upon database mutation.

### Decision 3: Quarantine Duration and Recovery
- **Decision:** Adopt adaptive, evidence-based recovery.
- **Requirements:**
  - No universal quarantine duration. Recovery depends on failure classification and evidence.
  - HTTP 429: Respect provider `Retry-After` (if supplied). Do not retry before that time.
  - HTTP 402: Exclude from Free-First routing. Do not automatically invoke paid models.
  - HTTP 401/403: Mark connection/model as authentication-failure; exclude until verified.
  - Transient 5xx/Timeout: Use bounded recovery and health-check mechanisms (e.g., `model_health_checks` and `provider_health_checks`).
  - Unsupported models: Remain ineligible until configuration/registry update.

### Decision 4: Retry-After Persistence
- **Decision:** Adopt durable persistence where supported; document gaps where not.
- **Requirements:**
  - Inspecting `PSEE_AI_Infrastructure_v1.0/AI_DATABASE_SCHEMA.md` and `src/db/database.ts` reveals no dedicated column for `retry_after` in `model_health_checks` or `ai_models`.
  - **Implementation Gap:** Storing provider-specified `Retry-After` timestamps requires a schema migration to add a `retry_after_at` column to `model_health_checks`.
  - **Interim Approach:** Until the schema is updated, provider `Retry-After` values must be handled transiently (in-memory adapter state). They must **not** be stored in relational tables until a formal schema migration decision is approved.
  - In-memory state should accelerate immediate routing decisions but must not be the sole source of truth if a service restart clears recovery deadlines.

## 3. Consistency and Safety
- Preserves Free-First routing; no automatic paid-model invocations.
- Prevents silent failures by distinguishing specific error categories.
- Ensures recovery relies on verified health evidence rather than arbitrary timers.

## 4. Remaining Unresolved Questions and Implementation Prerequisites

The following items are tracked as distinct prerequisites and are explicitly excluded from the initial ADR-AI-007 implementation scope:
1. **Durable `retry_after_at` Schema Migration:** Storing provider-specified `Retry-After` timestamps requires a separate database migration decision and migration script for `model_health_checks`. Until approved and implemented, Retry-After handling remains bounded to in-memory adapter state.
2. **Health-Check Probing Frequency Specification:** Concrete probing intervals, exponential backoff rates, and quota protection limits must be formally specified in `AI_MONITORING_SPEC.md` prior to deploying high-frequency automated health polling.

## 5. Validation and Provenance
- **Status:** `APPROVED`
- **Approval Date:** 2026-11-16
- **Approval Provenance:** Explicit project-owner approval
- **Verification:** Grounded in `AI_INFRASTRUCTURE_ARCHITECTURE.md`, `AI_MODEL_REGISTRY_SPEC.md`, and `AI_FALLBACK_AND_RECOVERY.md`. No implementation files were modified.
