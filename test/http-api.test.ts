import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createOrchestrationHttpServer } from '../src/api/http-server.js';
import type { OrchestrationHttpService } from '../src/api/http-server.js';

describe('orchestration HTTP API', () => {
  const service: OrchestrationHttpService = {
    execute: async (input) => ({ taskId: input.taskId, executionId: 'exec-1', correlationId: input.correlationId ?? 'corr-1', status: 'SUCCESS' }),
    getStatus: async (taskId, correlationId) => taskId === 'missing' ? null : ({ taskId, executionId: 'exec-1', correlationId: correlationId ?? 'corr-1', status: 'RUNNING' }),
    cancel: async (taskId) => taskId === 'missing' ? ({ taskId, executionId: '', correlationId: 'corr-1', status: 'FAILED', error: { code: 'NOT_FOUND', message: 'Task not found' } }) : ({ taskId, executionId: 'exec-1', correlationId: 'corr-1', status: 'CANCELLED' }),
  };

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const server = createOrchestrationHttpServer(service).listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    const response = await new Promise<{ status: number; body: any; headers: any }>((resolve, reject) => {
      const req = request({ port: (address as any).port, method, path, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
        let data = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode!, body: data ? JSON.parse(data) : null, headers: res.headers }));
      });
      req.on('error', reject); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
    });
    server.close();
    return response;
  }

  test('accepts valid submission and preserves headers', async () => {
    const response = await call('POST', '/api/tasks', { taskId: 'task-1', title: 'Test', role: 'coder', instructions: 'run' }, { 'x-correlation-id': 'corr-client', 'idempotency-key': 'idem-1' });
    assert.equal(response.status, 202); assert.equal(response.body.correlationId, 'corr-client'); assert.equal(response.headers['x-correlation-id'], 'corr-client');
  });
  test('rejects invalid body', async () => { const response = await call('POST', '/api/tasks', { taskId: '' }); assert.equal(response.status, 400); assert.equal(response.body.error.code, 'INVALID_REQUEST'); });
  test('returns policy rejection', async () => { const rejected = { ...service, execute: async () => ({ taskId: 'x', executionId: 'e', correlationId: 'c', status: 'REJECTED' as const, error: { code: 'POLICY_REJECTED', message: 'blocked' } }) }; const server = createOrchestrationHttpServer(rejected).listen(0); await new Promise<void>((r) => server.once('listening', () => r())); const port = (server.address() as any).port; const response = await new Promise<any>((r) => { const req = request({ port, method: 'POST', path: '/api/tasks', headers: { 'content-type': 'application/json' } }, (res) => { let d=''; res.on('data', c=>d+=c); res.on('end',()=>r({status:res.statusCode,body:JSON.parse(d)})); }); req.end(JSON.stringify({taskId:'x',title:'x',role:'coder',instructions:'x'})); }); server.close(); assert.equal(response.status, 422); });
  test('looks up task and handles missing task', async () => { const found = await call('GET', '/api/tasks?taskId=task-1'); const missing = await call('GET', '/api/tasks?taskId=missing'); assert.equal(found.status, 200); assert.equal(missing.status, 404); });
  test('cancels task and handles duplicate idempotency key', async () => { const cancelled = await call('POST', '/api/tasks/task-1/cancel'); const duplicate = await call('POST', '/api/tasks', { taskId: 'task-1', title: 'Test', role: 'coder', instructions: 'run' }, { 'idempotency-key': 'idem-1' }); assert.equal(cancelled.status, 202); assert.equal(duplicate.status, 202); });
});
