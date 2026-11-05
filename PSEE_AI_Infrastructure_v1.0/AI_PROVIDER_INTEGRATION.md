# PSEE — AI Provider Integration Specification

**Document ID:** PSEE-AI-PROV-005  
**Version:** 1.0.0  
**Status:** Draft for implementation  
**Last updated:** 2026-11-02

## 1. Purpose

Define a consistent adapter contract for 9Router, direct cloud providers, and local Ollama while keeping provider-specific details isolated.

## 2. Adapter interface

Conceptual interface (implementation language may differ):

```ts
interface ProviderAdapter {
  id: string;
  type: "gateway" | "direct" | "local";

  discoverModels?(): Promise<ModelDescriptor[]>;
  healthCheck(): Promise<HealthResult>;
  testModel(modelId: string): Promise<ModelTestResult>;

  generate(request: NormalizedRequest): Promise<NormalizedResponse>;
  stream?(request: NormalizedRequest): AsyncIterable<NormalizedChunk>;
}
```

This is a PSEE interface proposal, not an existing 9Router API.

## 3. Normalized request

```ts
interface NormalizedRequest {
  requestId: string;
  taskId: string;
  runId: string;
  modelId: string;
  systemInstruction?: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs: number;
  metadata?: Record<string, string>;
}
```

Provider-specific fields must be mapped by adapters. Unsupported parameters should be rejected or explicitly reported, not silently ignored.

## 4. Normalized response and errors

```ts
interface NormalizedResponse {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs: number;
  rawProviderRequestId?: string;
}

type NormalizedErrorCode =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MODEL_NOT_FOUND"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "CONTENT_REFUSAL"
  | "INVALID_RESPONSE"
  | "UNKNOWN";
```

Usage fields are optional. If provider usage is unavailable, store `null`/unknown, not zero.

## 5. 9Router adapter

### 5.1 Required verification before implementation
The user has installed 9Router Proxy v0.5.112 and opened its local web dashboard. The user reported seeing:
- Endpoint & Key settings.
- A local endpoint option.
- An API-key requirement toggle and masked default key.
- Provider cards for Antigravity, OpenAI Codex, Gemini, and others.
- Usage and Quota Tracker screens.

These observations do not establish:
- Exact API base URL or path.
- Whether OpenAI-compatible and Anthropic-compatible routes are both enabled.
- Exact authorization header format.
- Whether model IDs need prefixes.
- Whether streaming, tool calls, images, or structured outputs are supported.
- Whether per-account selection can be requested by API.
- Whether 9Router exposes reliable quota data to external clients.

Before coding the adapter:
1. Inspect Endpoint & Key in the installed dashboard.
2. Record endpoint and API-key requirements without copying secrets into documentation.
3. Check the installed version's official README/help or built-in API docs.
4. Run a minimal request against one known passing model.
5. Capture sanitized request/response metadata and error behavior.
6. Test streaming and tool calls separately if PSEE needs them.
7. Store verified behavior in a versioned adapter capability record.

Do not assume `localhost:20128` is the inference API endpoint merely because it is the dashboard URL. Do not assume a masked key is safe to paste into source code.

### 5.2 PSEE configuration placeholders
Names below are PSEE-owned placeholders:
- `PSEE_9ROUTER_ENABLED`
- `PSEE_9ROUTER_BASE_URL`
- `PSEE_9ROUTER_API_KEY`
- `PSEE_9ROUTER_TIMEOUT_MS`

The actual endpoint and authentication details must be filled from verified local configuration.

## 6. Direct provider adapters

Direct adapters are optional. Each requires official API access, documented endpoint/auth, and terms-compliant usage. Do not reuse IDE OAuth session credentials as API credentials.

A direct adapter must be tested independently and identified as `adapter_type=direct`, not conflated with a gateway request.

## 7. Ollama adapter

Ollama is planned as a local adapter. The user previously reported local model inventory:
- `qwen3:14b`
- `qwen2.5-coder:7b`
- `qwen2.5-coder:3b`

These are historical user-reported model names, not a current inventory or test result. Verify with the local Ollama model listing before registration.

Tests:
- Runtime reachable.
- Model present locally.
- Simple generation succeeds.
- Context/output limits recorded.
- Latency and resource use measured.
- PSEE can stop or timeout a generation safely.

Do not assume local model quality or speed based on model name alone.

## 8. Antigravity integration

User-reported status: all tested Antigravity models failed with timeout, not-found, or other errors. Keep this adapter quarantined for automatic production routing.

Diagnosis sequence:
1. Verify provider connection status in 9Router.
2. Verify exact model IDs exposed by the current integration.
3. Inspect sanitized Console Log error details.
4. Test one model with minimal prompt.
5. Distinguish auth, endpoint, model ID, timeout, and compatibility failures.
6. Re-enable only after a successful controlled test and registry update.

Do not rotate accounts to evade service limits.

## 9. Gemini, OpenAI Codex, and Kilo

User-reported observations:
- Gemini: four model labels passed a test, but exact canonical model IDs and per-account evidence are not yet documented.
- OpenAI Codex: user first confirmed two models working; a broader candidate list was later supplied, but final status was clarified as partial.
- Kilo: user supplied a list of candidate model IDs and clarified that only some passed.

Implementation must import candidate IDs as `UNKNOWN` until per-model test outcomes are recorded. Do not mark every supplied ID as passing.

## 10. Secret handling

- Read secrets from environment variables or OS secret storage.
- Provide `.env.example` with placeholders only.
- Add `.env`, token caches, OAuth state, and credential files to `.gitignore`.
- Redact `Authorization`, API keys, cookies, and token-like values in logs.
- Never request the user to paste full keys into chat.
- Rotate a key if it is exposed.

## 11. Acceptance criteria

- [ ] Provider adapters implement a common normalized contract.
- [ ] 9Router endpoint/auth are verified before adapter coding.
- [ ] Dashboard URL is not assumed to be inference endpoint.
- [ ] Direct API access is separate from IDE OAuth connections.
- [ ] Ollama model inventory is checked at runtime.
- [ ] Antigravity remains quarantined until a successful test.
- [ ] Model IDs and outcomes are stored exactly and individually.
- [ ] Secrets are never committed or logged.
