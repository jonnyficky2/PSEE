import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { PseeDatabase } from '../src/db/database.js';
import { FreeFirstPolicyEngine } from '../src/policy/policy.engine.js';
import { ModelRegistryService } from '../src/registry/model.registry.js';

describe('Policy and registry edge cases', () => {
  test('rejects SECRET routing when no local model is available', () => {
    const policy = new FreeFirstPolicyEngine();
    assert.throws(() => policy.selectRoute({
      taskId: 'secret-1', role: 'coder', dataSensitivity: 'SECRET',
      availableLocalModels: [], availableGatewayModels: ['ag/cloud-model'],
    }), /SECURITY VIOLATION/);
  });

  test('falls back to local models when no gateway models are available', () => {
    const policy = new FreeFirstPolicyEngine();
    const route = policy.selectRoute({
      taskId: 'fallback-1', role: 'researcher', dataSensitivity: 'INTERNAL',
      availableLocalModels: ['local-model'], availableGatewayModels: [],
    });
    assert.deepStrictEqual(route, {
      providerId: 'ollama', modelId: 'local-model', tier: 'TIER_0_LOCAL',
      reason: 'Local fallback: gateway unavailable, using local Ollama model.',
    });
  });

  test('rejects routing when no local or gateway models are available', () => {
    const policy = new FreeFirstPolicyEngine();
    assert.throws(() => policy.selectRoute({
      taskId: 'empty-1', role: 'researcher',
      availableLocalModels: [], availableGatewayModels: [],
    }), /ROUTING_EXHAUSTED/);
  });

  test('does not select disabled or quarantined models as verified', () => {
    const dbPath = '.psee/policy-registry-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      registry.registerProvider('provider-1', 'test-provider', 'Test Provider', 'local');
      for (const [id, status, enabled] of [
        ['model-disabled', 'DISABLED' as const, true],
        ['model-quarantined', 'QUARANTINED' as const, true],
        ['model-off', 'QUALIFIED' as const, false],
      ] as const) {
        registry.registerModel({
          id, providerId: 'provider-1', modelKey: id, displayName: id,
          status, contextWindow: null, maxOutputTokens: null, enabled, source: 'verified',
        });
      }
      assert.deepStrictEqual(registry.getVerifiedModels(), []);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    }
  });

  test('updates an existing model without losing known capabilities', () => {
    const dbPath = '.psee/policy-registry-update-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      registry.registerProvider('provider-1', 'test-provider', 'Test Provider', 'local');
      registry.registerModel({
        id: 'model-1', providerId: 'provider-1', modelKey: 'model', displayName: 'Model',
        status: 'CONNECTIVITY_VERIFIED', contextWindow: 8192, maxOutputTokens: 2048,
        enabled: true, source: 'verified',
      });
      registry.registerModel({
        id: 'model-2', providerId: 'provider-1', modelKey: 'model', displayName: 'Updated',
        status: 'QUALIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });
      assert.deepStrictEqual(registry.getVerifiedModels(), [{
        id: 'model-1', providerId: 'provider-1', modelKey: 'model', displayName: 'Updated',
        status: 'QUALIFIED', contextWindow: 8192, maxOutputTokens: 2048,
        enabled: true, source: 'verified',
      }]);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    }
  });

  test('discovers candidates partitioned by tier and excludes invalid states', () => {
    const dbPath = '.psee/policy-registry-candidates-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      registry.registerProvider('p-local', 'local-provider', 'Local', 'local');
      registry.registerProvider('p-gateway', 'gateway-provider', 'Gateway', 'gateway');

      registry.registerModel({
        id: 'm1', providerId: 'p-local', modelKey: 'local-verified', displayName: 'LV',
        status: 'CONNECTIVITY_VERIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });
      registry.registerModel({
        id: 'm2', providerId: 'p-gateway', modelKey: 'gateway-qualified', displayName: 'GQ',
        status: 'QUALIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });
      registry.registerModel({
        id: 'm3', providerId: 'p-local', modelKey: 'local-quarantined', displayName: 'LQ',
        status: 'QUARANTINED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });
      registry.registerModel({
        id: 'm4', providerId: 'p-gateway', modelKey: 'gateway-disabled', displayName: 'GD',
        status: 'QUALIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: false, source: 'verified',
      });

      const candidates = registry.getCandidateModels();
      assert.deepStrictEqual(candidates.local, ['local-verified']);
      assert.deepStrictEqual(candidates.gateway, ['gateway-qualified']);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    }
  });

  test('synchronously invalidates snapshot cache upon model or provider mutation', () => {
    const dbPath = '.psee/policy-registry-cache-invalidation-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      registry.registerProvider('p-local', 'local-provider', 'Local', 'local');
      registry.registerModel({
        id: 'm1', providerId: 'p-local', modelKey: 'model-a', displayName: 'MA',
        status: 'QUALIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });

      let candidates = registry.getCandidateModels();
      assert.deepStrictEqual(candidates.local, ['model-a']);

      // Mutate by registering another model
      registry.registerModel({
        id: 'm2', providerId: 'p-local', modelKey: 'model-b', displayName: 'MB',
        status: 'CONNECTIVITY_VERIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });

      candidates = registry.getCandidateModels();
      assert.deepStrictEqual(candidates.local, ['model-a', 'model-b']);

      // Mutate provider status to INACTIVE
      registry.registerProvider('p-local', 'local-provider', 'Local', 'local', 'INACTIVE');

      candidates = registry.getCandidateModels();
      assert.deepStrictEqual(candidates.local, []);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    }
  });

  test('excludes models with unknown provider types by enforcing check constraint', () => {
    const dbPath = '.psee/policy-registry-unknown-type-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      assert.throws(
        () => registry.registerProvider('p-unknown', 'unknown-provider', 'Unknown', 'custom-type' as any),
        /CHECK constraint failed/
      );
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
    }
  });

  test('returned candidate snapshot is immutable and does not affect cache', () => {
    const dbPath = '.psee/policy-registry-immutability-test.sqlite';
    rmSync(dbPath, { force: true });
    const db = new PseeDatabase({ dbPath });
    const registry = new ModelRegistryService(db);
    try {
      registry.registerProvider('p1', 'p1', 'P1', 'local');
      registry.registerModel({
        id: 'm1', providerId: 'p1', modelKey: 'model-a', displayName: 'MA',
        status: 'QUALIFIED', contextWindow: null, maxOutputTokens: null,
        enabled: true, source: 'verified',
      });

      const candidates = registry.getCandidateModels();
      candidates.local.push('malicious-injection');

      const secondCall = registry.getCandidateModels();
      assert.deepStrictEqual(secondCall.local, ['model-a']);
    } finally {
      db.close();
      rmSync(dbPath, { force: true });
    }
  });
});
