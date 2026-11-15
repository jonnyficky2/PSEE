import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../frontend/src/api-client.ts';

test('frontend API configuration prefers explicit, configured, then same-origin base', () => {
  assert.equal(resolveApiBaseUrl('http://localhost:3000/api', 'http://other/api'), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl(undefined, 'http://localhost:3000/api'), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl(undefined, undefined), '/api');
});
