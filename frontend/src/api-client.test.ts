import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from './api-client.js';

test('API base URL uses explicit value, meta configuration, then same-origin default', () => {
  assert.equal(resolveApiBaseUrl('http://localhost:3000/api', undefined), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl(undefined, 'http://localhost:3000/api'), 'http://localhost:3000/api');
  assert.equal(resolveApiBaseUrl(undefined, undefined), '/api');
});
