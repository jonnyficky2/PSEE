import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeConfig, createPseeRuntime } from '../src/runtime/bootstrap.js';

test('runtime configuration uses safe defaults and environment overrides', () => {
  const config = createRuntimeConfig({ PSEE_HOST: '127.0.0.1', PSEE_PORT: '4310', PSEE_DB_PATH: '.tmp/state.sqlite' });
  assert.deepStrictEqual(config, { host: '127.0.0.1', port: 4310, dbPath: '.tmp/state.sqlite' });
});

test('runtime rejects invalid port configuration', () => {
  assert.throws(() => createRuntimeConfig({ PSEE_PORT: '0' }), /PSEE_PORT/);
  assert.throws(() => createRuntimeConfig({ PSEE_PORT: 'bad' }), /PSEE_PORT/);
});

test('runtime creates a server and closes database cleanly', async () => {
  const runtime = createPseeRuntime({ PSEE_DB_PATH: '.tmp/bootstrap-test.sqlite', PSEE_PORT: '3001' });
  assert.ok(runtime.server);
  await runtime.close();
});
