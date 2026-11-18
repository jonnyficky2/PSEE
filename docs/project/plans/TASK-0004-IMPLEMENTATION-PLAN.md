# Implementation Plan: TASK-0004 Harden Adapter Lifecycle and Error Normalization

**Associated Task:** `docs/project/TASK_BOARD.md` → `[TASK-0004]`  
**Status:** COMPLETED AND VERIFIED — operator-approved closeout 2026-11-18; all acceptance criteria demonstrably satisfied by committed tests
**Created:** 2026-11-18  
**Document ID:** PSEE-PLAN-TASK-0004  
**Repository state:** `main` at `f0927df` (Phase 4 changes uncommitted)  
**Implementation commits:**
- `7a89e1f` — `feat(types): add adapter error classification and sanitization foundation`
- `f0927df` — `feat(adapters): harden error normalization and process lifecycle for TASK-0004`

---

## 1. Overview

TASK-0004 hardens the three PSEE adapters (Ollama, 9Router, OpenCode) so that all failure paths classify errors through `AdapterFailure`, sanitize secrets from output, and manage process lifecycle (OpenCode) with bounded termination and exactly-once promise settlement.

Phases 1–3 are committed on `main`. A closeout audit identified two defects in the OpenCode `abortTask` path and a gap in real-adapter abort test coverage. Phase 4 remediation (4a–4e) is implemented. A final independent audit confirmed the implementation correct but found the committed escalation tests were false positives; that gap has now been remediated with genuine SIGTERM-resistant fixtures and explicit signal assertions (section 7). All acceptance criteria are demonstrably satisfied; formal closeout awaits operator approval.

---

## 2. Known Limitations (Documented)

These are accepted scope boundaries, not defects to fix:

1. **Detached subprocesses.** `spawn()` uses the default `detached: false`. If the OpenCode binary spawns child processes of its own, SIGTERM/SIGKILL sent to the top-level child may not propagate to those grandchildren. Independent subprocess tracking is out of scope for TASK-0004.
2. **Sanitization pattern coverage.** `sanitize()` in `src/types/adapter-errors.ts` currently redacts `Bearer <token>` and `sk-`/`ag-` prefixed API keys. Other key formats (e.g., `gsk_`, `xai-`, `AKIA`, custom vendor prefixes) are not matched and may appear in output. Extending patterns requires evidence of actual exposure; speculative additions are deferred.
3. **Live-provider and soak testing.** All adapter tests use mocked `fetch` or temporary shell scripts. No live Ollama, 9Router, or OpenCode binary has been tested. Multi-user and long-duration soak testing have not been performed. TASK-0007 covers environment verification separately.
4. **Historical 58/58 test count.** A previous report cited 58/58 passing tests. The current HEAD has 62 `test()` calls across 13 test files. The 58/58 figure cannot be independently verified against the current repository state and is not carried forward as evidence.

---

## 3. Work Breakdown Structure

### Phase 1: Error classification and sanitization foundation — COMMITTED

- **Commit:** `7a89e1f`
- **Files created:** `src/types/adapter-errors.ts`, `test/sanitization.test.ts`
- **Files modified:** `src/types/index.ts` (added re-export)
- **Deliverables:**
  - `AdapterFailure` enum with 7 categories (RATE_LIMITED, CREDITS_REQUIRED, AUTH_FAILED, SERVER_ERROR, MALFORMED_RESPONSE, TIMEOUT, UNKNOWN).
  - `AdapterError` class carrying `category`, `message`, and optional `originalError`.
  - `sanitize()` function redacting Bearer tokens and sk-/ag- key patterns.
  - 4 deterministic tests: Bearer redaction, API key redaction, harmless-text preservation, AdapterError construction.
- **Status:** Committed and present in working tree.

### Phase 2: HTTP adapter error normalization (Ollama, 9Router) — COMMITTED

- **Commit:** `f0927df`
- **Files modified:** `src/adapters/ollama.adapter.ts`, `src/adapters/ninerouter.adapter.ts`, `test/adapters.test.ts`
- **Deliverables:**
  - Both adapters import and throw `AdapterError` with classified `AdapterFailure` for all HTTP status codes (401/403 → AUTH_FAILED, 429 → RATE_LIMITED, 402 → CREDITS_REQUIRED, 5xx → SERVER_ERROR, malformed → MALFORMED_RESPONSE, timeout → TIMEOUT, unknown → UNKNOWN).
  - Error message text is passed through `sanitize()`.
  - Catch blocks re-throw `AdapterError` instances and wrap unknown errors.
  - 3 new tests: 9Router 401→AUTH_FAILED with secret redaction, 9Router 502→SERVER_ERROR, Ollama 403→AUTH_FAILED.
- **Status:** Committed and present in working tree.

### Phase 3: OpenCode process lifecycle hardening — COMMITTED (with known defects)

- **Commit:** `f0927df`
- **Files modified:** `src/adapters/opencode.adapter.ts`, `test/adapters.test.ts`
- **Deliverables:**
  - Timeout path: named `escalation` timer variable with `child.on('close', () => clearTimeout(escalation))` cleanup.
  - `error` handler: exactly-once guard via `activeProcesses.has()` check before delete and resolve.
  - `close` handler: exactly-once guard via `activeProcesses.has()` check before delete and resolve.
  - All stdout, stderr, and sanitizedSummary fields passed through `sanitize()`.
  - 3 new tests: stdout/stderr/summary sanitization, spawn-error handling with sanitization, SIGKILL escalation after SIGTERM grace period.
- **Outstanding defects (confirmed by audit):**
  - **D1:** `abortTask()` at L163 deletes from `activeProcesses` before the `close` event fires. This causes the `close` handler's guard (`if (!this.activeProcesses.has(context.runId)) return`) to exit early, leaving the `executeTask` promise permanently unresolved. The caller hangs.
  - **D2:** `abortTask()` sends SIGTERM with no escalation timer. A process that traps SIGTERM survives indefinitely. The timeout path escalates to SIGKILL after 3000ms; the abort path does not.
- **Status:** Committed with D1 and D2 unresolved at the time of commit; both remediated in Phase 4 below.

### Phase 4: Abort lifecycle remediation and final verification — IMPLEMENTED AND VERIFIED

- **Files modified:** `src/adapters/opencode.adapter.ts`, `test/adapters.test.ts`
- **Files updated with evidence:** this plan
- **Work items (all completed):**

  **4a. Fix D1 — prevent premature activeProcesses deletion in abortTask**
  - Removed `activeProcesses.delete(runId)` from `abortTask()`.
  - `abortTask()` now triggers a per-run escalation handler registered by `executeTask()` via a new `abortHandlers` map. The `close`/`error` handler in `executeTask()` performs the single deletion and promise settlement.

  **4b. Fix D2 — add SIGKILL escalation to abortTask**
  - The shared `startEscalation()` helper sends SIGTERM immediately and schedules SIGKILL after 3000ms. Both the timeout path and the abort path call this same helper.
  - A boolean `escalating` guard ensures at most one escalation timer per run even under timeout/abort races.

  **4c. Verify escalation timer cleanup across all paths**
  - A single `settle()` function is the sole terminal path. It clears the timeout timer and the escalation timer, deletes from both `activeProcesses` and `abortHandlers`, and resolves exactly once.
  - `close` and `error` both call `settle()`. No delayed SIGKILL can be sent after termination.
  - No use of `child.killed` as a termination signal.

  **4d. Verify exactly-once settlement across all race conditions**
  - The `settled` boolean in `settle()` guarantees a single resolve regardless of event ordering.
  - `error` then `close`, `close` then `error`, abort then `close`, timeout then `close`, and timeout/abort races all funnel through `settle()`.
  - `activeProcesses` is deleted exactly once inside `settle()`.

  **4e. Add real OpenCodeBridgeAdapter abort lifecycle tests**
  - `OpenCode abort settles executeTask and cleans up activeProcesses` — aborts a sleeping process, asserts `executeTask` resolves with `TIMEOUT`, asserts `activeProcesses.size === 0`.
  - `OpenCode abort escalates to SIGKILL when SIGTERM is ignored` — uses a `trap "" TERM` shell script. **AUDIT CORRECTION:** this fixture was empirically shown to die on SIGTERM on this host, so the test completes in ~55ms and never reaches the 3-second escalation. It confirms settlement but does NOT verify SIGKILL.
  - `OpenCode abort on already-exited process is a no-op` — aborts after completion, asserts no throw and empty `activeProcesses`.
  - The existing escalation test (`OpenCode escalation: SIGKILL sent after grace if process survives SIGTERM`) uses the same ineffective fixture (~14ms) and has the same limitation.

  **4f. Verification (executed)**
  - Targeted: `npx tsx --test test/adapters.test.ts` → **16 tests, 16 pass, 0 fail**.
  - Full: `npm test` → **61 tests, 61 pass, 0 fail** (6 suites).
  - Isolated foundation suite: `npx tsx --test test/sanitization.test.ts` → **4 tests, 4 pass, 0 fail**. (Note: `test/sanitization.test.ts` is not in the `npm test` script's file list.)
  - Build: `npm run build` → **succeeded** (TypeScript backend + frontend compilation, no errors).
  - The historical 58/58 figure is not used as evidence; current verified counts are recorded above.

  **4g. Documentation update**
  - This plan and TASK_BOARD.md updated with Phase 4 implementation evidence and verification results.
  - The final audit's test-evidence gap was resolved by the remediation recorded in section 7. TASK-0004 was formally approved and closed by the operator on 2026-11-18.

---

## 7. Final Independent Audit and Test-Evidence Remediation (2026-11-18)

**7a. Initial audit (pre-remediation):**
- Commands: adapters 16/16, sanitization 4/4, `npm test` 61/61, build succeeded.
- Implementation verified correct: `settle()` is the sole terminal path with `settled` guard; `startEscalation()` guarded by `escalating`; `abortTask()` no longer deletes `activeProcesses`; no `child.killed`.
- Blocker found: both escalation tests used `trap "" TERM; sleep N`, which dies on SIGTERM on this host (~14–55ms). They never reached the 3s escalation; no test asserted signal delivery. External Python `SIG_IGN` diagnostic resolved at 3007ms, proving the implementation correct but not covered by committed tests.

**7b. Test-evidence remediation (this pass):**
- `test/adapters.test.ts` now uses a real Node.js SIGTERM-resistant fixture (`resistantFixture()`): it writes a readiness file at startup, registers a SIGTERM handler that appends a marker to a file, and stays alive via `setInterval` until SIGKILL. A `ChildProcess.prototype.kill` spy records every signal, timestamp, PID, and delivery result. Fixtures are tracked and SIGKILLed in `afterEach`, with temp dirs removed — no orphan processes.
- Two escalation-timing tests:
  - `OpenCode escalation sends SIGTERM first, then SIGKILL after 3000ms grace` — asserts SIGTERM marker file, `killSignals() === ['SIGTERM','SIGKILL']`, both signals delivered, gap ≥ 2800ms, promise NOT settled during the grace window, process dead (`process.kill(pid,0)` throws), both maps empty.
  - `OpenCode sends no delayed SIGKILL when the process exits before grace` — after early SIGTERM-triggered exit and a 3200ms wait (past the grace), asserts `killSignals() === ['SIGTERM']` and both maps empty.
- Five race tests: abort→close, error→close, timeout→abort, abort→timeout, abort-after-exit, plus repeated-abort. All assert signal counts (no duplicates) and empty `activeProcesses`/`abortHandlers`.
- Mutation check: temporarily removing `child.kill('SIGKILL')` from the adapter made the escalation test fail with "Timed out: escalation settlement"; the source was restored immediately and verified clean. Tests therefore fail when escalation is broken.

**7c. Fresh verification results (this pass, not reused):**
- `npx tsx --test test/adapters.test.ts` → **20/20 pass, 0 fail** (twice consecutively; ~10s).
- `npx tsx --test test/sanitization.test.ts` → **4/4 pass, 0 fail**.
- `npm test` → **65/65 pass, 0 fail**, 6 suites.
- `npm run build` → succeeded.
- `git diff --check` → clean.

**Scope confirmation:** no migrations, Retry-After persistence, health polling, automatic retries, or paid-model fallback were introduced. ADR-AI-007 remains APPROVED; its plan remains COMPLETED AND VERIFIED. Free-First routing and `AdapterError`/sanitization files are unchanged.

---

## 4. Acceptance Criteria

1. All `AdapterFailure` categories have stable, tested behavior. **Met (Phases 1–2).**
2. All adapter error messages are sanitized via `sanitize()`. **Met (Phases 1–3).**
3. OpenCode timeout path escalates from SIGTERM to SIGKILL with bounded cleanup. **Met (Phase 3).**
4. OpenCode `abortTask` does not leave `executeTask` promises unresolved. **Met (Phase 4a; verified by abort lifecycle tests).**
5. OpenCode `abortTask` escalates to SIGKILL if the process survives SIGTERM. **Met (committed SIGTERM-resistant fixture test asserts SIGTERM first, SIGKILL after ≥2800ms, process termination, and clean maps; mutation check confirmed the test fails when SIGKILL is removed).**
6. Exactly-once promise settlement is guaranteed across error/close/abort/timeout races. **Met (single `settle()` with `settled` guard; dedicated race tests for abort→close, error→close, timeout→abort, abort→timeout, abort-after-exit, repeated abort).**
7. A deterministic test covers the real adapter's abort→close→settlement path. **Met (real `OpenCodeBridgeAdapter` with signal spy and readiness-controlled fixtures).**
8. `npm test` and `npm run build` pass with zero failures after remediation. **Met (65/65 tests, 20/20 adapter tests, 4/4 sanitization tests, build succeeded).**
9. Test assertions explicitly verify SIGTERM and SIGKILL delivery. **Met (`ChildProcess.prototype.kill` spy records signal order, delivery result, PID, and timestamps; SIGTERM marker file proves delivery to the process).**
10. TASK_BOARD.md accurately reflects implementation evidence. **Met (updated with final verification evidence).**

---

## 5. Scope Exclusions

The following are explicitly outside TASK-0004 scope:

- Schema migrations (including `retry_after_at`).
- Health-check polling or probing frequency.
- Retry-After persistence.
- Automatic retries or paid-model fallback.
- Provider configuration changes.
- Live-provider verification (covered by TASK-0007).
- ADR-AI-007 implementation (completed separately; its plan remains COMPLETED AND VERIFIED).
- Detached subprocess lifecycle management.
- New sanitization pattern additions without exposure evidence.

---

## 6. Dependencies

| Dependency | Status |
|---|---|
| TASK-0001 (adapter contract tests) | DONE — provided the test infrastructure and evidence that unblocked TASK-0004. |
| ADR-AI-007 implementation | COMPLETED AND VERIFIED — not reopened or modified by TASK-0004. |
