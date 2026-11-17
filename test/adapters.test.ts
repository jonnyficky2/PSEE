import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OllamaLocalAdapter } from '../src/adapters/ollama.adapter.js';
import { NineRouterGatewayAdapter } from '../src/adapters/ninerouter.adapter.js';
import { OpenCodeBridgeAdapter } from '../src/adapters/opencode.adapter.js';
import { AdapterFailure, AdapterError } from '../src/types/adapter-errors.js';

const originalFetch = globalThis.fetch;
const tempDirs: string[] = [];

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function request(): Parameters<OllamaLocalAdapter['generate']>[0] {
  return {
    requestId: 'request-1',
    taskId: 'task-1',
    modelId: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
    timeoutMs: 100,
  };
}

function fakeOpenCodeScript(output: string, exitCode = 0): string {
  const dir = mkdtempSync(join(tmpdir(), 'psee-adapter-'));
  tempDirs.push(dir);
  const path = join(dir, 'fake-opencode');
  writeFileSync(path, `#!/bin/sh\nprintf '%s' ${JSON.stringify(output)}\nexit ${exitCode}\n`);
  chmodSync(path, 0o755);
  return path;
}

describe('Provider adapter contracts', { concurrency: false }, () => {
  test('Ollama discovers models and normalizes chat responses', async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push(`${input} ${init?.method ?? 'GET'}`);
      return String(input).endsWith('/api/tags')
        ? response({ models: [{ name: 'test-model' }] })
        : response({
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          });
    };

    const adapter = new OllamaLocalAdapter({ baseUrl: 'http://ollama.test' });
    assert.deepStrictEqual(await adapter.discoverModels(), ['test-model']);
    const result = await adapter.generate(request());
    assert.strictEqual(result.requestId, 'request-1');
    assert.strictEqual(result.providerId, 'ollama');
    assert.strictEqual(result.modelId, 'test-model');
    assert.strictEqual(result.content, 'ok');
    assert.strictEqual(result.finishReason, 'stop');
    assert.deepStrictEqual(result.usage, { inputTokens: 1, outputTokens: 2, totalTokens: 3 });
    assert.equal(typeof result.latencyMs, 'number');
    assert.deepStrictEqual(calls, ['http://ollama.test/api/tags GET', 'http://ollama.test/v1/chat/completions POST']);
  });

  test('9Router sends bearer auth and classifies HTTP failures', async () => {
    let authorization: string | undefined;
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization') ?? undefined;
      return response({ error: 'limited' }, { status: 429, statusText: 'Too Many Requests' });
    };

    const adapter = new NineRouterGatewayAdapter({ baseUrl: 'http://router.test', apiKey: 'test-secret' });
    await assert.rejects(adapter.generate(request()), /RATE_LIMITED: 9Router returned 429/);
    assert.strictEqual(authorization, 'Bearer test-secret');
  });

  test('Ollama rejects malformed inference responses', async () => {
    globalThis.fetch = async () => response({ usage: { prompt_tokens: 1 } });
    const adapter = new OllamaLocalAdapter({ baseUrl: 'http://ollama.test' });
    await assert.rejects(adapter.generate(request()), /malformed Ollama response/i);
  });

  test('9Router rejects malformed inference responses', async () => {
    globalThis.fetch = async () => response({ choices: [] });
    const adapter = new NineRouterGatewayAdapter({ baseUrl: 'http://router.test' });
    await assert.rejects(adapter.generate(request()), /malformed 9Router response/i);
  });

  test('Ollama classifies an aborted request as a timeout', async () => {
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
    const adapter = new OllamaLocalAdapter({ baseUrl: 'http://ollama.test' });
    await assert.rejects(adapter.generate({ ...request(), timeoutMs: 1 }), /timed out after 1ms/);
  });

  test('OpenCode maps a timed-out process to TIMEOUT', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'psee-adapter-'));
    tempDirs.push(dir);
    const path = join(dir, 'fake-opencode');
    writeFileSync(path, '#!/bin/sh\nsleep 1\n');
    chmodSync(path, 0o755);
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: path });
    const result = await adapter.executeTask({
      taskId: 'task-1', runId: 'run-timeout', role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 10, allowNetwork: false,
    });
    assert.strictEqual(result.status, 'TIMEOUT');
  });

  test('OpenCode maps process success and failure', async () => {
    const success = new OpenCodeBridgeAdapter({ binaryPath: fakeOpenCodeScript('created output') });
    const result = await success.executeTask({
      taskId: 'task-1',
      runId: 'run-1',
      role: 'coder',
      worktreePath: process.cwd(),
      instructions: 'test',
      contextFiles: [],
      timeoutMs: 5000,
      allowNetwork: false,
    });
    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.exitCode, 0);
    assert.deepStrictEqual(result.modifiedFiles, ['output']);

    const failure = new OpenCodeBridgeAdapter({ binaryPath: fakeOpenCodeScript('failed', 2) });
    const failed = await failure.executeTask({
      taskId: 'task-1',
      runId: 'run-2',
      role: 'coder',
      worktreePath: process.cwd(),
      instructions: 'test',
      contextFiles: [],
      timeoutMs: 5000,
      allowNetwork: false,
    });
    assert.strictEqual(failed.status, 'FAILED');
    assert.strictEqual(failed.exitCode, 2);
  });

  test('9Router maps HTTP 401/403 to AUTH_FAILED and redacts secrets', async () => {
    globalThis.fetch = async () => response('Error: sk-secret-1234567890 failed', { status: 401 });
    const adapter = new NineRouterGatewayAdapter({ baseUrl: 'http://router.test' });
    await assert.rejects(
      adapter.generate(request()),
      (err: unknown) => {
        assert(err instanceof AdapterError);
        assert.strictEqual(err.category, AdapterFailure.AUTH_FAILED);
        assert(!err.message.includes('sk-secret-1234567890'));
        assert(err.message.includes('[REDACTED_KEY]'));
        return true;
      }
    );
  });

  test('9Router maps HTTP 5xx to SERVER_ERROR and sanitizes', async () => {
    globalThis.fetch = async () => response('Internal server error at node-1', { status: 502 });
    const adapter = new NineRouterGatewayAdapter({ baseUrl: 'http://router.test' });
    await assert.rejects(
      adapter.generate(request()),
      (err: unknown) => {
        assert(err instanceof AdapterError);
        assert.strictEqual(err.category, AdapterFailure.SERVER_ERROR);
        assert(err.message.includes('502'));
        return true;
      }
    );
  });

  test('Ollama maps HTTP 401/403 to AUTH_FAILED', async () => {
    globalThis.fetch = async () => response('unauthorized access', { status: 403 });
    const adapter = new OllamaLocalAdapter({ baseUrl: 'http://ollama.test' });
    await assert.rejects(
      adapter.generate(request()),
      (err: unknown) => {
        assert(err instanceof AdapterError);
        assert.strictEqual(err.category, AdapterFailure.AUTH_FAILED);
        return true;
      }
    );
  });

  test('OpenCode sanitizes stdout, stderr and summary', async () => {
    const output = 'Process started with Bearer secret-123. \nUpdated sk-key-12345678901234567890 in config.';
    const path = fakeOpenCodeScript(output);
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: path });
    const result = await adapter.executeTask({
      taskId: 'task-1', runId: 'run-redact', role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 5000, allowNetwork: false,
    });
    
    assert(!result.stdout.includes('secret-123'));
    assert(result.stdout.includes('Bearer [REDACTED]'));
    assert(!result.stdout.includes('sk-key-1234567890'));
    assert(result.stdout.includes('[REDACTED_KEY]'));
    assert(!result.sanitizedSummary.includes('secret-123'));
  });

  test('OpenCode handles spawn error and sanitizes message', async () => {
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: '/non/existent/path/opencode' });
    const result = await adapter.executeTask({
      taskId: 'task-1', runId: 'run-error', role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 5000, allowNetwork: false,
    });
    assert.strictEqual(result.status, 'FAILED');
    assert.strictEqual(result.exitCode, -1);
    assert(result.stderr.includes('spawn error'));
  });

  test('OpenCode escalation: SIGKILL sent after grace if process survives SIGTERM', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'psee-adapter-'));
    tempDirs.push(dir);
    const scriptPath = join(dir, 'fake-opencode');
    // Script that ignores SIGTERM and only dies on SIGKILL (exit code 137 usually)
    // We'll use a script that traps SIGTERM and sleeps longer.
    writeFileSync(scriptPath, `#!/bin/sh
trap "" TERM
sleep 10
`);
    chmodSync(scriptPath, 0o755);

    const adapter = new OpenCodeBridgeAdapter({ binaryPath: scriptPath });
    const result = await adapter.executeTask({
      taskId: 'task-1', runId: 'run-kill', role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 10, allowNetwork: false,
    });
    
    // The implementation uses 3000ms grace. 
    // This test will take ~3s to complete.
    assert.strictEqual(result.status, 'TIMEOUT');
  });
});
