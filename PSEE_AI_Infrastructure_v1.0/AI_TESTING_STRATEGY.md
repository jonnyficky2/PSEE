# PSEE — AI Testing Strategy

**Document ID:** PSEE-AI-TEST-008  
**Version:** 1.0.0  
**Status:** Draft for implementation  
**Last updated:** 2026-11-02

## 1. Purpose

Define a repeatable test process for provider connections, individual models, routing, fallback, Agent orchestration, checkpoint recovery, security, and end-to-end behavior.

## 2. Evidence levels

| Level | Meaning |
|---|---|
| L0 — Listed | Model appears in provider UI/list |
| L1 — User-reported pass | User reports a test passed |
| L2 — Connectivity verified | PSEE test harness completed a controlled request |
| L3 — Capability qualified | Task-specific benchmark passed |
| L4 — Operationally qualified | Reliability, routing, recovery, and policy tests passed |

Do not promote a model to a higher level without recorded evidence.

## 3. Current baseline from user reports

| Provider | Baseline |
|---|---|
| OpenAI Codex | Partial; user initially confirmed two models working. Later candidate list supplied, but per-model pass/fail results remain unspecified. |
| Gemini | Four model labels reported successful; exact canonical IDs and test evidence need capture. |
| Kilo | Partial; some models passed and some failed. Per-model mapping is missing. |
| Antigravity | All tested models reportedly failed with timeout, not-found, or other errors. Quarantined pending diagnosis. |
| Ollama | Not yet tested in this conversation. |
| DeepSeek | Not configured for current plan. |
| Claude Code | Not connected. |

The baseline must be updated only from actual test output. Do not infer a pass count from the number of model names supplied.

## 4. Test suites

### 4.1 Provider connection tests
- Dashboard/config endpoint is reachable.
- Authentication works.
- Minimal request succeeds.
- Error is normalized.
- Secret redaction works.

### 4.2 Model tests
For each exact model ID:
1. Minimal text response.
2. Structured output if required.
3. Long-context test if required.
4. Streaming test if required.
5. Tool-call test if required.
6. Timeout behavior.
7. Repeatability test with bounded sample count.

### 4.3 Task capability benchmark
Use identical, versioned tasks for comparable models:
- Planning: decompose a small product feature into tasks and acceptance criteria.
- Architecture: design a small service and identify risks.
- Coding: implement a bounded, testable change in a disposable repository.
- Debugging: diagnose a seeded bug and propose a minimal fix.
- Review: identify seeded correctness/security defects.
- Documentation: generate a specification and check internal consistency.

Score with a rubric:
- Correctness.
- Completeness.
- Adherence to constraints.
- Test pass rate.
- Safety and secret handling.
- Latency.
- Token usage/cost when measurable.

Do not compare models using different prompts or different task difficulty.

### 4.4 Routing tests
- Eligible model is selected.
- Unknown/quarantined model is excluded.
- Task capability requirements are respected.
- Data classification restrictions are respected.
- Selection reason is recorded.
- No eligible model leads to safe pause/queue.

### 4.5 Fallback tests
Simulate:
- 429 rate limit.
- Timeout.
- 500/503.
- 401/403.
- 404 model not found.
- Invalid request.
- Malformed response.

Assert:
- Retry is bounded.
- Retry-after is respected.
- Non-recoverable errors do not loop.
- Fallback model is eligible.
- No policy refusal is bypassed.
- Fallback chain exhaustion is visible.

### 4.6 Recovery tests
- Stop process after checkpoint.
- Restart PSEE.
- Recover task and checkpoint.
- Inspect Git state before resuming.
- Confirm no duplicate file mutation or external side effect.
- Confirm task cannot become `DONE` without validation.

### 4.7 Security tests
- Secret scanning of repository.
- Log redaction tests.
- Permission boundary tests.
- Prompt-injection tests using untrusted repository/document content.
- SSRF/path traversal tests for tools if applicable.
- Approval tests for destructive operations.
- Data-classification routing tests.

## 5. Antigravity diagnosis test plan

Because all tested models reportedly failed:
1. Select one exact model ID shown by the current 9Router UI.
2. Record exact error category and sanitized response.
3. Confirm account connection state.
4. Run one minimal request with conservative timeout.
5. Compare with another provider through the same gateway.
6. If all gateway providers fail, inspect gateway configuration.
7. If only Antigravity fails, isolate provider integration/model mapping.
8. Keep quarantined until L2 connectivity verification passes.

## 6. Ollama qualification plan

- Verify local runtime is running.
- Query installed model inventory.
- Test one small model first.
- Measure first-token and total response latency if supported.
- Test a short coding task.
- Record memory/CPU pressure and context constraints.
- Test cancellation and timeout.
- Mark `CONNECTIVITY_VERIFIED` only after a real successful generation.

## 7. Test environments

- Unit tests: mocked adapters and deterministic policy.
- Integration tests: dedicated test credentials and low-risk prompts.
- Recovery tests: disposable Git repository/worktree.
- End-to-end tests: user-approved environment and explicit budget.
- Never use production secrets in automated test fixtures.

## 8. Release gates

### Gate A — Registry
- Exact model IDs captured.
- Unknown models excluded from automatic routing.
- Health evidence persisted.

### Gate B — Provider adapters
- Gateway endpoint/auth verified.
- Direct adapter independently verified if enabled.
- Local adapter independently verified if enabled.

### Gate C — Routing
- Policy tests pass.
- Fallback is bounded and explainable.
- Round Robin remains off unless separately justified and tested.

### Gate D — Recovery
- Checkpoint survives restart.
- Interrupted workspace state is inspected.
- No duplicate non-idempotent action.

### Gate E — Security and UAT
- Secret scan passes.
- Permission and approval tests pass.
- User accepts dashboard and recovery workflow.
- Documentation matches implemented behavior.

## 9. Acceptance criteria

- [ ] Every model has an evidence level.
- [ ] Each test run records exact model ID and adapter.
- [ ] Per-model pass/fail is not inferred from provider-level result.
- [ ] Routing and fallback tests cover recoverable and non-recoverable errors.
- [ ] Recovery tests verify workspace state before replay.
- [ ] Security tests cover secret leakage and tool permissions.
- [ ] Release gates are enforced.
- [ ] User UAT is required before production status.
