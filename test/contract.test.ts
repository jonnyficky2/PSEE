import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('OpenAPI contract is versioned and frontend-approved', () => {
  const contract = readFileSync('docs/api/openapi.yaml', 'utf8');
  assert.match(contract, /version: 1\.0\.0/);
  assert.match(contract, /CONTRACT BASELINE — FRONTEND CONSUMPTION APPROVED/);
  assert.match(contract, /\/tasks:/);
  assert.match(contract, /Idempotency-Key/);
  assert.match(contract, /APPROVAL_REQUIRED/);
  assert.match(contract, /X-Correlation-ID/);
});
