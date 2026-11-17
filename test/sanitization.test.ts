import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, AdapterFailure, AdapterError } from '../src/types/adapter-errors.js';

describe('Sanitization & Error Classification Foundation', () => {
  test('redacts Bearer tokens accurately', () => {
    const raw = 'Request failed: Authorization: Bearer secret-token-12345 in header';
    const sanitized = sanitize(raw);
    assert.strictEqual(sanitized, 'Request failed: Authorization: Bearer [REDACTED] in header');
  });

  test('redacts common API key structures', () => {
    const raw = 'Invalid key sk-abcdef12345678901234567890 provided for authentication';
    const sanitized = sanitize(raw);
    assert.strictEqual(sanitized, 'Invalid key [REDACTED_KEY] provided for authentication');
  });

  test('preserves harmless text without false positives', () => {
    const raw = 'Standard error: Connection reset by peer at /tmp/models';
    const sanitized = sanitize(raw);
    assert.strictEqual(sanitized, raw);
  });

  test('AdapterError holds category and message properly', () => {
    const err = new AdapterError(AdapterFailure.RATE_LIMITED, 'Rate limit exceeded');
    assert.strictEqual(err.category, AdapterFailure.RATE_LIMITED);
    assert.strictEqual(err.message, 'Rate limit exceeded');
  });
});
