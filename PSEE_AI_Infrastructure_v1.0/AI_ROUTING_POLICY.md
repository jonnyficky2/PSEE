# PSEE — AI Routing Policy

**Document ID:** PSEE-AI-ROUTE-003  
**Version:** 1.0.0  
**Status:** Draft for implementation  
**Last updated:** 2026-11-02

## 1. Purpose

Define how PSEE selects a model for a task. Routing must be explainable, policy-controlled, and based on verified capabilities rather than provider popularity or model names.

## 2. Routing inputs

- Task type and complexity.
- Required capabilities (coding, review, vision, tool calling, etc.).
- Model Registry eligibility.
- Provider/account health.
- Context-window requirement.
- Latency and availability history.
- User-configured cost/usage policy.
- Data sensitivity and permitted provider set.
- User approval requirements.

## 3. Initial task classes

| Task class | Typical requirements |
|---|---|
| Planning | Reasoning, structured decomposition |
| Architecture | Reasoning, long context, design review |
| Coding | Code generation, repository context |
| Debugging | Reasoning, code analysis |
| Research | Retrieval/tool access where configured, synthesis |
| Testing | Test design, result interpretation |
| Review | Code review, security awareness |
| Documentation | Structured writing, consistency |

These classes do not prescribe a specific model until benchmark evidence exists.

## 4. Initial routing policy

1. Filter models by status and capability.
2. Filter by provider permission and user policy.
3. Exclude quarantined, disabled, unauthorized, and rate-limited models.
4. Prefer task-qualified models over connectivity-only models.
5. Rank remaining candidates by task benchmark score, reliability, latency, and configured cost preference.
6. Select the highest-ranked eligible candidate.
7. Record why the model was selected.
8. If no eligible model exists, pause or queue the task and notify the user.

## 5. Provider tiers (initial)

- **Primary candidates:** verified OpenAI Codex and Gemini connections/models, subject to per-model qualification.
- **Secondary candidates:** Kilo models that individually pass connectivity and task tests.
- **Quarantined:** Antigravity until errors are diagnosed and a controlled test passes.
- **Local candidate:** Ollama after local health and generation tests.
- **Not configured:** DeepSeek and Claude Code unless explicitly connected and verified.

This is a provider-level planning view. Actual selection is model-level.

## 6. Round Robin policy

Global Round Robin is **not enabled by default**.

Reasons:
- Models have different capabilities and reliability.
- Some model IDs have not been individually verified.
- Round Robin can send a task to an incompatible model.
- Account rotation must not be used to bypass rate limits or terms.

If a provider supports legitimate load distribution across authorized endpoints, it may be enabled only for equivalent qualified models, within provider terms, and with clear audit logs.

## 7. Fallback policy

Fallback is controlled by `AI_FALLBACK_AND_RECOVERY.md`.

A fallback candidate must:
- Be eligible for the same task class.
- Support the required input/output format.
- Be allowed by data sensitivity policy.
- Have enough context capacity.
- Not be rate-limited or quarantined.

## 8. Data sensitivity routing

Suggested labels:
- `PUBLIC`
- `INTERNAL`
- `CONFIDENTIAL`
- `SECRET`

Default policy:
- `SECRET`: do not send to external providers.
- `CONFIDENTIAL`: require explicit allowlist and user approval.
- `INTERNAL`: use only providers approved in workspace policy.
- `PUBLIC`: may use any configured, permitted provider.

Secrets, API keys, passwords, private tokens, and unrelated personal data must be removed from prompts before provider submission.

## 9. Concurrency and budget controls

- Per-provider and per-model concurrency are configurable.
- Do not launch duplicate requests for the same non-idempotent action.
- Apply request/token budgets where provider usage information is available.
- If usage or cost cannot be measured, show `unknown`, not zero.
- Avoid automatic parallel fan-out unless tasks are independent and budget permits.

## 10. Explainability

For every routing decision, persist:
- task ID and run ID;
- selected provider/model/adapter;
- eligible candidates considered;
- policy version;
- selection reason;
- fallback reason, if any;
- timestamp.

Never log secret values or full sensitive prompts.

## 11. Acceptance criteria

- [ ] Same task and same registry/policy snapshot produce explainable candidate selection.
- [ ] Unknown models are excluded from production routing by default.
- [ ] Round Robin is disabled by default.
- [ ] Routing respects data classification and user approval.
- [ ] Every routing decision is auditable.
- [ ] No eligible model causes a safe pause/queue, not silent substitution.
