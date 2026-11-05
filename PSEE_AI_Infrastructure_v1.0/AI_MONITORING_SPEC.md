# PSEE — AI Monitoring Specification

**Document ID:** PSEE-AI-MON-006  
**Version:** 1.0.0  
**Status:** Draft for implementation  
**Last updated:** 2026-11-02

## 1. Purpose

Provide operational visibility into providers, models, Agent runs, task progress, fallback events, checkpoints, usage, and incidents.

## 2. Dashboard sections

1. **Overview:** active tasks, completed/failed tasks, provider availability, recent incidents.
2. **Provider Health:** provider and account connection status.
3. **Model Registry:** model-level status, capability evidence, last test.
4. **Agent Monitor:** queued/running/paused/failed Agents and current task.
5. **Routing Timeline:** selected model, adapter, fallback reason, policy decision.
6. **Usage & Cost:** tokens and cost where actually reported; unknown when unavailable.
7. **Quota Monitor:** provider-reported quota only when an authoritative value is available.
8. **Recovery Center:** interrupted runs, checkpoints, pending user decisions.
9. **Audit Log:** administrative changes, approvals, secret/config events (redacted).

## 3. Metrics

### Provider/model metrics
- Health check success rate.
- Request success/failure count.
- Timeout count.
- Rate-limit count.
- Median and p95 latency when sample size is sufficient.
- Last successful request timestamp.
- Last error category.

### Agent/task metrics
- Tasks queued/running/completed/failed.
- Duration by task class.
- Retry and fallback count.
- Recovery success rate.
- Validation pass/fail.
- Human approval wait time.

### Usage metrics
- Input/output tokens if returned by provider.
- Estimated cost only when a reliable pricing source/config exists.
- Quota remaining only when provider exposes a trustworthy value.
- Missing usage must be shown as `Unknown` rather than `0`.

## 4. Event schema

```json
{
  "event_id": "evt_x",
  "timestamp": "ISO-8601",
  "correlation_id": "corr_x",
  "task_id": "task_x",
  "run_id": "run_x",
  "event_type": "provider.request.failed",
  "provider_id": "provider_x",
  "model_id": "model_x",
  "adapter_type": "gateway",
  "status": "TIMEOUT",
  "latency_ms": 30000,
  "usage": null,
  "sanitized_detail": "Request deadline exceeded"
}
```

Example only. Do not include secrets or raw sensitive prompt content.

## 5. Health checking

- Separate provider connection health from model generation health.
- Use lightweight, bounded checks.
- Do not continuously probe every model at high frequency.
- Configure refresh intervals and backoff.
- A health probe must not consume excessive user quota.
- Distinguish `unknown`, `degraded`, `unavailable`, and `healthy`.

## 6. Alerts

Alert when:
- Primary provider becomes unavailable.
- A model repeatedly times out.
- A model returns 401/403/404.
- Rate limit is reached.
- Fallback chain is exhausted.
- Task remains interrupted beyond a threshold.
- Quota/cost budget reaches configured threshold.
- A credential or policy configuration changes.

Alerts must include actionable context without exposing secrets.

## 7. Usage and quota accuracy

9Router's Usage screen showed zero requests/tokens in the user's screenshot before controlled inference requests were run. This is a baseline observation, not evidence of zero provider usage overall.

Quota Tracker showed provider/account cards, but some cards were still loading. Some displayed values were not sufficiently interpreted. PSEE must not copy these values as verified quota semantics until their meaning and refresh behavior are confirmed.

## 8. Retention and privacy

- Retention periods are configurable.
- Store only the minimum prompt/output detail needed for debugging.
- Support redaction and deletion policies.
- Restrict audit log access.
- Do not expose full account email addresses by default.
- Do not log credentials, cookies, or raw authorization headers.

## 9. Acceptance criteria

- [ ] Every request has a correlation ID.
- [ ] Dashboard distinguishes provider health from model health.
- [ ] Usage unknown is not displayed as zero.
- [ ] Fallback and recovery events are visible.
- [ ] Alerts are actionable and redacted.
- [ ] Health checks are bounded and configurable.
- [ ] Quota semantics are verified before being displayed as authoritative.
- [ ] Monitoring remains available when a provider is offline.
