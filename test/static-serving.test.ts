import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createOrchestrationHttpServer } from '../src/api/http-server.js';

const root = '.tmp/static-test';
const service = {
  execute: async () => ({ taskId: 'x', executionId: 'e', correlationId: 'c', status: 'SUCCESS' as const }),
  getStatus: async () => null,
  cancel: async () => ({ taskId: 'x', executionId: 'e', correlationId: 'c', status: 'CANCELLED' as const }),
};

async function get(port: number, path: string) {
  return new Promise<{ status: number; type?: string; body: string }>((resolve, reject) => {
    const req = request({ port, path }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, type: res.headers['content-type'], body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves safe frontend assets and preserves API routes', async () => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/index.html`, '<main>PSEE</main>');
  writeFileSync(`${root}/app.js`, 'console.log(1)');
  writeFileSync('.tmp/private.txt', 'secret');
  const server = createOrchestrationHttpServer(service, { staticRoot: root }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as any).port;
  try {
    const html = await get(port, '/');
    assert.equal(html.status, 200);
    assert.equal(html.type, 'text/html; charset=utf-8');
    assert.match(html.body, /PSEE/);
    const js = await get(port, '/app.js');
    assert.equal(js.type, 'text/javascript; charset=utf-8');
    const api = await get(port, '/api/tasks?taskId=missing');
    assert.equal(api.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
    rmSync('.tmp/private.txt', { force: true });
  }
});

test('rejects traversal and missing assets without exposing files', async () => {
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/index.html`, 'home');
  const server = createOrchestrationHttpServer(service, { staticRoot: root }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as any).port;
  try {
    assert.equal((await get(port, '/missing.css')).status, 404);
    assert.equal((await get(port, '/../private.txt')).status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
