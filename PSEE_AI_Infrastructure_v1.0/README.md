# PSEE AI Infrastructure v1.0 — Documentation Pack

This pack contains eight implementation specifications:

1. `AI_INFRASTRUCTURE_ARCHITECTURE.md`
2. `AI_MODEL_REGISTRY_SPEC.md`
3. `AI_ROUTING_POLICY.md`
4. `AI_FALLBACK_AND_RECOVERY.md`
5. `AI_PROVIDER_INTEGRATION.md`
6. `AI_MONITORING_SPEC.md`
7. `AI_DATABASE_SCHEMA.md`
8. `AI_TESTING_STRATEGY.md`

## Important status note

These documents reflect user-reported 9Router observations as of 2026-11-02. They deliberately distinguish:
- user-reported test outcomes,
- PSEE-verified outcomes (not yet established unless test evidence is added),
- candidate model IDs,
- proposed PSEE configuration names,
- unverified 9Router endpoint/auth/API behavior.

Do not treat examples or placeholders as live credentials, endpoints, or confirmed provider capabilities.

## Recommended implementation order

1. Verify 9Router inference endpoint/auth and test one known passing model.
2. Capture per-model results for OpenAI, Gemini, and Kilo.
3. Diagnose Antigravity without enabling it for production routing.
4. Verify Ollama runtime and local models.
5. Implement Model Registry and provider adapters.
6. Implement policy routing, bounded fallback, checkpoints, monitoring.
7. Run release gates and user acceptance testing.
