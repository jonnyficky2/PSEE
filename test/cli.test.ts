import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShutdown } from '../src/runtime/cli.js';

test('shutdown handler runs cleanup only once', async () => {
  let calls = 0;
  const shutdown = createShutdown(async () => { calls += 1; });
  await Promise.all([shutdown(), shutdown()]);
  assert.equal(calls, 1);
});
