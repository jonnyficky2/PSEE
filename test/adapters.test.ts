import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OllamaLocalAdapter } from '../src/adapters/ollama.adapter.js';
import { NineRouterGatewayAdapter } from '../src/adapters/ninerouter.adapter.js';
import { OpenCodeBridgeAdapter } from '../src/adapters/opencode.adapter.js';
import { AdapterFailure, AdapterError } from '../src/types/adapter-errors.js';

const originalFetch = globalThis.fetch;
const tempDirs: string[] = [];
const liveChildren = new Set<ChildProcess>();

afterEach(async () => {
  restoreKill();
  globalThis.fetch = originalFetch;
  for (const child of liveChildren) {
    try { child.kill('SIGKILL'); } catch { /* already exited */ }
  }
  liveChildren.clear();
  await new Promise((r) => setImmediate(r));
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

/**
 * SIGTERM-resistant fixture: a real Node process that records SIGTERM delivery
 * to a file and stays alive until SIGKILL. It signals readiness via a file so
 * tests never race with process startup. Unlike `trap "" TERM` shell scripts,
 * this reliably ignores SIGTERM on every platform Node runs on.
 */
function resistantFixture(): { path: string; ready: string; term: string } {
  const dir = mkdtempSync(join(tmpdir(), 'psee-opencode-resistant-'));
  tempDirs.push(dir);
  const path = join(dir, 'fake-opencode');
  const ready = join(dir, 'ready');
  const term = join(dir, 'term');
  writeFileSync(path, `#!/usr/bin/env node
const fs = require('node:fs');
const ready = process.env.PSEE_FIXTURE_READY;
const term = process.env.PSEE_FIXTURE_TERM;
if (ready) fs.writeFileSync(ready, 'ready');
process.on('SIGTERM', () => { if (term) fs.appendFileSync(term, 'SIGTERM'); });
setInterval(() => {}, 1000);
`);
  chmodSync(path, 0o755);
  return { path, ready, term };
}

/** Fixture that exits on SIGTERM — used to prove no delayed SIGKILL. */
function sigtermExitFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psee-opencode-exit-'));
  tempDirs.push(dir);
  const path = join(dir, 'fake-opencode');
  writeFileSync(path, '#!/bin/sh\nsleep 30\n');
  chmodSync(path, 0o755);
  return path;
}

async function waitForFile(path: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (existsSync(path) && readFileSync(path, 'utf8').length > 0) return;
    } catch { /* file not created yet */ }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

type KillCall = { signal: string; at: number; pid?: number; delivered: boolean };
let originalKill: typeof ChildProcess.prototype.kill | null = null;
let killCalls: KillCall[] = [];

function spyOnKill(): void {
  killCalls = [];
  originalKill = ChildProcess.prototype.kill;
  ChildProcess.prototype.kill = function (this: ChildProcess, signal?: NodeJS.Signals | number) {
    const delivered = originalKill!.call(this, signal);
    killCalls.push({ signal: String(signal), at: Date.now(), pid: this.pid, delivered });
    return delivered;
  } as typeof ChildProcess.prototype.kill;
}

function restoreKill(): void {
  if (originalKill) ChildProcess.prototype.kill = originalKill;
  originalKill = null;
}

function killSignals(): string[] {
  return killCalls.map((c) => c.signal);
}

async function waitForSignal(signal: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (killSignals().includes(signal)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Timed out waiting for signal ${signal}`);
}

async function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Kill via the OS directly so cleanup is not recorded by the kill spy. */
function hardKill(adapter: unknown, runId: string): void {
  const child = (adapter as { activeProcesses: Map<string, { pid?: number }> }).activeProcesses.get(runId);
  if (child?.pid) {
    try { process.kill(child.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

/** Register the spawned child so afterEach can kill it even on test failure. */
function trackChild(adapter: unknown, runId: string): void {
  const child = (adapter as { activeProcesses: Map<string, ChildProcess> }).activeProcesses.get(runId);
  if (child) liveChildren.add(child);
}

const resistantEnv = (ready: string, term: string): Record<string, string> => ({
  PSEE_FIXTURE_READY: ready,
  PSEE_FIXTURE_TERM: term,
});

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

  test('OpenCode escalation sends SIGTERM first, then SIGKILL after 3000ms grace', async () => {
    spyOnKill();
    const fixture = resistantFixture();
    const runId = 'run-real-escalation';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: fixture.path });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 60000, allowNetwork: false,
      environmentVariables: resistantEnv(fixture.ready, fixture.term),
    });
    trackChild(adapter, runId);

    try {
      await waitForFile(fixture.ready);
      await adapter.abortTask(runId);

      // SIGTERM must actually reach the resistant process and be recorded.
      await waitForFile(fixture.term, 2000);
      assert.match(readFileSync(fixture.term, 'utf8'), /SIGTERM/);
      assert.deepStrictEqual(killSignals().slice(0, 1), ['SIGTERM']);
      assert.strictEqual(killCalls[0].delivered, true);

      // The process ignores SIGTERM: the promise must NOT settle before the grace period.
      let settledEarly = false;
      promise.then(() => { settledEarly = true; });
      await new Promise((r) => setTimeout(r, 300));
      assert.strictEqual(settledEarly, false, 'executeTask settled before SIGKILL grace elapsed');

      const result = await withDeadline(promise, 8000, 'escalation settlement');
      assert.strictEqual(result.status, 'TIMEOUT');

      // SIGKILL must have been delivered after the 3000ms grace, in order.
      assert.deepStrictEqual(killSignals(), ['SIGTERM', 'SIGKILL']);
      assert.ok(killCalls[1].delivered, 'SIGKILL was not delivered');
      const gap = killCalls[1].at - killCalls[0].at;
      assert.ok(gap >= 2800, `SIGKILL sent only ${gap}ms after SIGTERM`);

      // The process is gone and both maps are clean.
      const pid = killCalls[0].pid!;
      assert.throws(() => process.kill(pid, 0));
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });

  test('OpenCode sends no delayed SIGKILL when the process exits before grace', async () => {
    spyOnKill();
    const runId = 'run-no-delayed-kill';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: sigtermExitFixture() });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 60000, allowNetwork: false,
    });
    trackChild(adapter, runId);

    try {
      await new Promise((r) => setTimeout(r, 100));
      await adapter.abortTask(runId);
      const result = await withDeadline(promise, 3000, 'early-exit settlement');
      assert.strictEqual(result.status, 'TIMEOUT');

      // Wait past the grace period: no SIGKILL may be sent after termination.
      await new Promise((r) => setTimeout(r, 3200));
      assert.deepStrictEqual(killSignals(), ['SIGTERM']);
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });

  test('OpenCode abort settles executeTask and cleans up both process maps', async () => {
    spyOnKill();
    const runId = 'run-abort-settle';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: sigtermExitFixture() });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 60000, allowNetwork: false,
    });
    trackChild(adapter, runId);

    try {
      await new Promise((r) => setTimeout(r, 50));
      await adapter.abortTask(runId);
      const result = await withDeadline(promise, 3000, 'abort settlement');
      assert.strictEqual(result.status, 'TIMEOUT');
      assert.strictEqual(result.runId, runId);
      assert.deepStrictEqual(killSignals(), ['SIGTERM']);
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });

  test('OpenCode error followed by close settles once and leaves no state', async () => {
    spyOnKill();
    const runId = 'run-error-close';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: '/non/existent/path/opencode' });
    try {
      const result = await withDeadline(adapter.executeTask({
        taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
        instructions: 'test', contextFiles: [], timeoutMs: 5000, allowNetwork: false,
      }), 3000, 'spawn error settlement');
      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.exitCode, -1);
      assert.match(result.stderr, /spawn error/);
      assert.deepStrictEqual(killSignals(), []);
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
      // No second settlement / no-op after the error path.
      await adapter.abortTask(runId);
      assert.deepStrictEqual(killSignals(), []);
    } finally {
      restoreKill();
    }
  });

  test('OpenCode timeout followed by abort sends SIGTERM only once', async () => {
    spyOnKill();
    const fixture = resistantFixture();
    const runId = 'run-timeout-abort';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: fixture.path });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 1000, allowNetwork: false,
      environmentVariables: resistantEnv(fixture.ready, fixture.term),
    });
    trackChild(adapter, runId);

    try {
      await waitForFile(fixture.ready);
      // Wait for the timeout to actually deliver SIGTERM, then abort repeatedly.
      await waitForSignal('SIGTERM', 4000);
      assert.deepStrictEqual(killSignals(), ['SIGTERM']);
      await adapter.abortTask(runId);
      await adapter.abortTask(runId);
      assert.deepStrictEqual(killSignals(), ['SIGTERM'], 'abort must not re-escalate after timeout');
      hardKill(adapter, runId);
      const result = await withDeadline(promise, 3000, 'timeout-abort settlement');
      assert.strictEqual(result.status, 'TIMEOUT');
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });

  test('OpenCode abort followed by timeout sends SIGTERM only once', async () => {
    spyOnKill();
    const fixture = resistantFixture();
    const runId = 'run-abort-timeout';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: fixture.path });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 1000, allowNetwork: false,
      environmentVariables: resistantEnv(fixture.ready, fixture.term),
    });
    trackChild(adapter, runId);

    try {
      await waitForFile(fixture.ready);
      await adapter.abortTask(runId);
      // Let the timeout fire after the abort: guard must prevent a second escalation.
      await new Promise((r) => setTimeout(r, 1150));
      assert.deepStrictEqual(killSignals(), ['SIGTERM']);
      hardKill(adapter, runId);
      const result = await withDeadline(promise, 3000, 'abort-timeout settlement');
      assert.strictEqual(result.status, 'TIMEOUT');
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });

  test('OpenCode abort on already-exited process is a no-op', async () => {
    spyOnKill();
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: fakeOpenCodeScript('done') });
    const runId = 'run-abort-noop';
    try {
      const result = await adapter.executeTask({
        taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
        instructions: 'test', contextFiles: [], timeoutMs: 5000, allowNetwork: false,
      });
      assert.strictEqual(result.status, 'SUCCESS');
      await adapter.abortTask(runId);
      assert.deepStrictEqual(killSignals(), []);
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      restoreKill();
    }
  });

  test('OpenCode repeated abort calls settle once and clean up', async () => {
    spyOnKill();
    const fixture = resistantFixture();
    const runId = 'run-repeated-abort';
    const adapter = new OpenCodeBridgeAdapter({ binaryPath: fixture.path });
    const promise = adapter.executeTask({
      taskId: 'task-1', runId, role: 'coder', worktreePath: process.cwd(),
      instructions: 'test', contextFiles: [], timeoutMs: 60000, allowNetwork: false,
      environmentVariables: resistantEnv(fixture.ready, fixture.term),
    });
    trackChild(adapter, runId);

    try {
      await waitForFile(fixture.ready);
      await Promise.all([adapter.abortTask(runId), adapter.abortTask(runId), adapter.abortTask(runId)]);
      assert.deepStrictEqual(killSignals(), ['SIGTERM'], 'repeated aborts must not duplicate signals');
      hardKill(adapter, runId);
      const result = await withDeadline(promise, 3000, 'repeated-abort settlement');
      assert.strictEqual(result.status, 'TIMEOUT');
      assert.strictEqual((adapter as any).activeProcesses.size, 0);
      assert.strictEqual((adapter as any).abortHandlers.size, 0);
    } finally {
      hardKill(adapter, runId);
      restoreKill();
    }
  });
});
