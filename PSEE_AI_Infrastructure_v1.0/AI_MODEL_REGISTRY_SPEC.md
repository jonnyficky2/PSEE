# PSEE — AI Model Registry Specification

**Document ID:** PSEE-AI-MREG-002  
**Version:** 1.0.0  
**Status:** Draft for implementation  
**Last updated:** 2026-11-02

## 1. Purpose

Model Registry is the authoritative catalog of providers, accounts, model identifiers, capabilities, verification evidence, and eligibility for PSEE routing.

A model appearing in a provider dropdown is not proof that it works. A successful basic connection test is not proof of coding quality or production reliability.

## 2. Registry entities

### Provider
Represents an integration family, e.g. OpenAI Codex, Gemini, Kilo, Antigravity, or Ollama.

### Account connection
Represents a user-authorized connection under a provider. Store an internal account reference and masked label. Do not store passwords or raw OAuth tokens in registry records.

### Model
Represents the exact model identifier accepted by the configured adapter. Preserve the exact ID, including prefixes, suffixes, and variants such as `[1m]`.

### Capability
Describes tested abilities such as text generation, coding, tool calling, structured output, vision, long context, and streaming. Capabilities must have evidence and test dates.

### Health check
Records connection/model test results and sanitized error details.

## 3. Initial observed inventory

The following is transcribed from user-reported 9Router testing on 2026-11-02. It is not an independent verification by PSEE.

| Provider | User-reported result | Registry treatment |
|---|---|---|
| OpenAI Codex | Some models passed; two were initially confirmed, then a broader list was reported as tested/available without per-model pass/fail mapping | `PARTIAL`; individual model rows remain `UNKNOWN` until exact outcomes are recorded |
| Gemini | Four named model entries reportedly passed | `PARTIAL`; mark only those four as `CONNECTIVITY_PASS_REPORTED`, not production-qualified |
| Kilo | Some models passed, some did not | `PARTIAL`; per-model outcome required |
| Antigravity | All tested models failed with timeout, not-found, or other errors | `QUARANTINED` at provider integration level pending diagnosis |
| Ollama | Installed locally, but no test result supplied in this session | `UNKNOWN` |
| DeepSeek | User reports paid access required / not currently available for this setup | `NOT_CONFIGURED` |
| Claude Code | No connection established; user does not currently plan to add paid access | `NOT_CONFIGURED` |

### 3.1 Reported Gemini model labels
User-reported successful labels (exact upstream model IDs have not yet been confirmed):
- `3.6 Flash`
- `3.1 Flash-Lite Preview`
- `3.5 Flash-Lite`
- `3-Flash-Review`

Do not silently normalize these labels into guessed API model IDs. Capture the exact 9Router model ID and provider response from a test export or UI.

### 3.2 Reported OpenAI model identifiers
The user supplied this list:
- `cx/gpt-6-luna`
- `cx/gpt-6-luna[1m]`
- `cx/gpt-5.6-terra`
- `cx/gpt-5.6-terra[1m]`
- `cx/gpt-5.6-terra-review`
- `cx/gpt-5.6-luna`
- `cx/gpt-5.6-luna[1m]`
- `cx/gpt-5.6-luna-review`
- `cx/gpt-reserve`
- `cx/codex-auto-review`

The user later clarified that OpenAI testing was partial. Therefore these are **reported candidate IDs**, not all confirmed passing models. The initial statement that two OpenAI models passed remains the only unambiguous pass count in the conversation.

### 3.3 Reported Kilo model identifiers
User supplied:
- `kc/kilo-auto/free`
- `kc/nvidia/nemotron-3.5-super-vl:free`
- `kc/reflection/beam-free`
- `kc/stealth/glyph-cluster`
- `kc/dots-studio/dots-3-note-preview:free`
- `kc/nvidia/nemotron-3.5-lightning:free`
- `kc/cohere/north-mini-code:free`
- `kc/nvidia/nemotron-3-ultra-550b-a55b:free`
- `kc/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
- `kc/openrouter/free`
- `kc/inclusionai/ling-3.1-flash-1019-free`

The user later clarified Kilo testing was partial. All IDs remain candidates until individual outcomes are supplied.

## 4. Status lifecycle

Allowed status values:
- `UNKNOWN`: not tested or evidence unavailable.
- `CONNECTIVITY_PASS_REPORTED`: user reports a connection test passed; not independently verified.
- `CONNECTIVITY_VERIFIED`: PSEE test harness completed a controlled request successfully.
- `QUALIFIED`: passed required task-specific benchmark and policy checks.
- `DEGRADED`: works but has reliability or latency concerns.
- `RATE_LIMITED`: provider explicitly reported a limit.
- `QUARANTINED`: excluded from automatic routing pending diagnosis.
- `DISABLED`: manually disabled.
- `NOT_CONFIGURED`: no usable connection configured.

A status change must record actor, timestamp, reason, and evidence reference.

## 5. Eligibility rules

A model is eligible for production routing only if:
1. Its exact model ID is verified for the selected adapter.
2. Its provider connection is active and authorized.
3. It has `CONNECTIVITY_VERIFIED` or `QUALIFIED` status.
4. Required capabilities are tested.
5. It is permitted by user policy and provider terms.
6. It is not quarantined, disabled, or rate-limited.
7. Its context and output limits satisfy the task.

`CONNECTIVITY_PASS_REPORTED` is visible but does not automatically make a model production-eligible.

## 6. Capability evidence

Capabilities must be evidence-based:
- `text_generation`
- `code_generation`
- `code_review`
- `reasoning`
- `tool_calling`
- `structured_output`
- `vision`
- `streaming`
- `long_context`

Store benchmark version, test case, result, and timestamp. Do not infer `code_generation` from a model's name.

## 7. Account mapping and privacy

- Use opaque internal account IDs, e.g. `acct_01`.
- Store provider account label in masked form.
- Never expose full email addresses in logs or dashboards by default.
- Do not assume matching Google email identities imply shared quota between Gemini and Antigravity.
- Do not rotate accounts to evade provider limits or usage restrictions.
- Respect each provider's terms and per-account limits.

## 8. Suggested API contract

```json
{
  "provider_id": "openai_codex",
  "account_ref": "acct_01",
  "adapter_type": "gateway",
  "model_id": "cx/example-model",
  "display_name": "Example model",
  "status": "UNKNOWN",
  "capabilities": [],
  "context_window": null,
  "max_output_tokens": null,
  "last_tested_at": null,
  "evidence_ref": null,
  "enabled": false
}
```

This is a PSEE data contract example, not a 9Router API payload.

## 9. Acceptance criteria

- [ ] Registry preserves exact model IDs.
- [ ] Candidate IDs are not automatically marked healthy.
- [ ] User-reported evidence is distinguished from PSEE-verified evidence.
- [ ] Every health status change has timestamp and reason.
- [ ] Model capabilities require test evidence.
- [ ] Quarantined/disabled models cannot be selected by automatic routing.
- [ ] Account identifiers are masked in normal UI/logs.
- [ ] Registry supports multiple adapters for one provider/model where appropriate.
