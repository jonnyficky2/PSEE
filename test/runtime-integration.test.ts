import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { rmSync } from 'node:fs';
import { createPseeRuntime } from '../src/runtime/bootstrap.js';
import type { AgentAdapter, TaskExecutionContext } from '../src/types/index.js';

function adapter(): AgentAdapter {
  return {
    id: 'opencode', name: 'Integration', version: 'test',
    isAvailable: async () => true, healthCheck: async () => ({ healthy: true, details: 'ok' }),
    executeTask: async (context: TaskExecutionContext) => ({ taskId: context.taskId, runId: context.runId, status: 'SUCCESS', exitCode: 0, modifiedFiles: [], stdout: '', stderr: '', sanitizedSummary: 'ok', durationMs: 1 }),
    abortTask: async () => {},
  };
}

async function http(port: number, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: any; headers: any }>((resolve, reject) => {
    const req = request({ port, method, path, headers: { 'content-type': 'application/json', ...headers } }, (res) => { let data = ''; res.on('data', (chunk) => data += chunk); res.on('end', () => resolve({ status: res.statusCode!, body: data ? JSON.parse(data) : null, headers: res.headers })); });
    req.on('error', reject); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
  });
}

test('production runtime serves the complete deterministic HTTP lifecycle', async () => {
  rmSync('.tmp/runtime-integration.sqlite', { force: true }); rmSync('.tmp/runtime-integration.sqlite-wal', { force: true }); rmSync('.tmp/runtime-integration.sqlite-shm', { force: true });
  const runtime = createPseeRuntime({ PSEE_DB_PATH: '.tmp/runtime-integration.sqlite', PSEE_PORT: '3012' }, { adapter: adapter(), worktree: async (taskId) => ({ worktreePath: `/tmp/${taskId}`, branchName: `task/${taskId}`, baseSha: 'test' }) });
  await new Promise<void>((resolve) => runtime.server.listen(0, '127.0.0.1', () => resolve()));
  const port = (runtime.server.address() as any).port;
  try {
    const submission = await http(port, 'POST', '/api/tasks', { taskId: 'integration-1', title: 'Test', role: 'coder', instructions: 'run', availableLocalModels: ['runtime-local'] }, { 'x-correlation-id': 'corr-integration', 'idempotency-key': 'idem-integration' });
    assert.equal(submission.status, 202); assert.equal(submission.body.correlationId, 'corr-integration');
    const replay = await http(port, 'POST', '/api/tasks', { taskId: 'integration-1', title: 'Test', role: 'coder', instructions: 'run', availableLocalModels: ['runtime-local'] }, { 'idempotency-key': 'idem-integration' });
    assert.equal(replay.body.executionId, submission.body.executionId);
    const status = await http(port, 'GET', '/api/tasks?taskId=integration-1'); assert.equal(status.status, 200); assert.equal(status.body.status, 'DONE');
    const invalid = await http(port, 'POST', '/api/tasks', { taskId: '' }); assert.equal(invalid.status, 400);
    const missing = await http(port, 'GET', '/api/tasks?taskId=missing'); assert.equal(missing.status, 404);
  } finally { await runtime.close(); }
  assert.equal(runtime.database.rawDb.open, false);
});
