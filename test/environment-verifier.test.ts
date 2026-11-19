import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { verifyEnvironment } from '../src/verification/environment.verifier.js';

describe('Environment verifier', () => {
  test('correctly reports all healthy providers and sanitizes inference output', async () => {
    const mockOllama = {
      healthCheck: async () => true,
      discoverModels: async () => ['qwen2.5-coder:7b'],
      generate: async () => ({
        content: 'ok Bearer secret-token-12345',
        finishReason: 'stop' as const,
        latencyMs: 15,
      }),
    };

    const mockNineRouter = {
      healthCheck: async () => true,
      discoverModels: async () => ['ag/gemini-3.8-flash-low'],
      generate: async () => ({
        content: 'pong sk-testsecret123456789',
        finishReason: 'stop' as const,
        latencyMs: 30,
      }),
    };

    const mockOpenCode = {
      healthCheck: async () => ({ healthy: true, details: 'OpenCode binary ready at /usr/local/bin/opencode' }),
    };

    const report = await verifyEnvironment({
      ollama: mockOllama as any,
      nineRouter: mockNineRouter as any,
      openCode: mockOpenCode as any,
    });

    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.healthy, 3);
    assert.equal(report.summary.unavailable, 0);
    assert.equal(report.summary.error, 0);

    assert.equal(report.providers.ollama.status, 'HEALTHY');
    assert.equal(report.providers.ollama.testInference?.success, true);
    assert.match(report.providers.ollama.testInference?.output ?? '', /Bearer \[REDACTED\]/);

    assert.equal(report.providers.nineRouter.status, 'HEALTHY');
    assert.equal(report.providers.nineRouter.testInference?.success, true);
    assert.match(report.providers.nineRouter.testInference?.output ?? '', /\[REDACTED_KEY\]/);

    assert.equal(report.providers.openCode.status, 'HEALTHY');
  });

  test('distinguishes unavailable dependencies from implementation failures', async () => {
    const mockOllama = {
      healthCheck: async () => false, // daemon offline
      discoverModels: async () => [],
      generate: async () => ({ content: '', finishReason: 'stop' as const, latencyMs: 0 }),
    };

    const mockNineRouter = {
      healthCheck: async () => false, // gateway standby/offline
      discoverModels: async () => [],
      generate: async () => ({ content: '', finishReason: 'stop' as const, latencyMs: 0 }),
    };

    const mockOpenCode = {
      healthCheck: async () => ({ healthy: false, details: 'Binary opencode not found in PATH' }),
    };

    const report = await verifyEnvironment({
      ollama: mockOllama as any,
      nineRouter: mockNineRouter as any,
      openCode: mockOpenCode as any,
    });

    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.healthy, 0);
    assert.equal(report.summary.unavailable, 3);
    assert.equal(report.summary.error, 0);

    assert.equal(report.providers.ollama.status, 'UNAVAILABLE');
    assert.match(report.providers.ollama.details, /offline/i);

    assert.equal(report.providers.nineRouter.status, 'UNAVAILABLE');
    assert.match(report.providers.nineRouter.details, /offline/i);

    assert.equal(report.providers.openCode.status, 'UNAVAILABLE');
    assert.match(report.providers.openCode.details, /not found/i);
  });

  test('classifies unexpected adapter errors as ERROR and sanitizes error messages', async () => {
    const mockOllama = {
      healthCheck: async () => { throw new Error('Crashed with sk-sensitive-ollama-key'); },
      discoverModels: async () => [],
      generate: async () => ({ content: '', finishReason: 'stop' as const, latencyMs: 0 }),
    };

    const report = await verifyEnvironment({
      ollama: mockOllama as any,
      nineRouter: { healthCheck: async () => false } as any,
      openCode: { healthCheck: async () => ({ healthy: false, details: 'none' }) } as any,
    });

    assert.equal(report.providers.ollama.status, 'ERROR');
    assert.match(report.providers.ollama.details, /\[REDACTED_KEY\]/);
    assert.doesNotMatch(report.providers.ollama.details, /sk-sensitive-ollama-key/);
    assert.equal(report.summary.error, 1);
  });
});
