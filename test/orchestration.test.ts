import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { PseeDatabase } from '../src/db/database.js';
import { ExecutionPersistenceService } from '../src/persistence/execution.persistence.js';
import { OrchestrationService } from '../src/orchestration/orchestration.service.js';
import type { AgentAdapter, TaskExecutionContext, TaskExecutionResult } from '../src/types/index.js';

describe('Orchestration service', () => {
  let db: PseeDatabase;
  let persistence: ExecutionPersistenceService;
  const dbPath = '.psee/orchestration-test.sqlite';

  beforeEach(() => {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    db = new PseeDatabase({ dbPath });
    persistence = new ExecutionPersistenceService(db);
    db.rawDb.prepare(`INSERT INTO agent_definitions (id, agent_key, display_name, role_description, default_task_class, permission_profile) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('fake-agent', 'fake-agent', 'Fake Agent', 'Test agent', 'implementation', 'test');
    db.rawDb.prepare(`INSERT INTO agent_definitions (id, agent_key, display_name, role_description, default_task_class, permission_profile) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('failing-agent', 'failing-agent', 'Failing Agent', 'Test agent', 'implementation', 'test');
    db.rawDb.prepare(`INSERT INTO ai_providers (id, provider_key, display_name, provider_type, status) VALUES (?, ?, ?, ?, ?)`)
      .run('local', 'local', 'Local', 'local', 'ACTIVE');
    db.rawDb.prepare(`INSERT INTO ai_models (id, provider_id, model_key, display_name, status, source) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('model-1', 'local', 'model-1', 'Model 1', 'QUALIFIED', 'verified');
  });

  afterEach(() => {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  });

  test('executes a task with policy, persistence, worktree, and checkpoint handoff', async () => {
    const calls: string[] = [];
    const adapter: AgentAdapter = {
      id: 'fake-agent', name: 'Fake', version: '1',
      isAvailable: async () => true,
      healthCheck: async () => ({ healthy: true, details: 'ok' }),
      executeTask: async (context: TaskExecutionContext): Promise<TaskExecutionResult> => {
        calls.push(`execute:${context.runId}:${context.worktreePath}`);
        return { taskId: context.taskId, runId: context.runId, status: 'SUCCESS', exitCode: 0,
          modifiedFiles: ['src/example.ts'], stdout: 'ok', stderr: '', sanitizedSummary: 'done', durationMs: 1 };
      },
      abortTask: async (runId) => calls.push(`abort:${runId}`),
    };
    const service = new OrchestrationService({
      persistence, adapter,
      selectRoute: () => ({ providerId: 'local', modelId: 'model-1', tier: 'TIER_0_LOCAL', reason: 'test' }),
      createWorktree: async (taskId) => ({ worktreePath: `/tmp/${taskId}`, branchName: `task/${taskId}`, baseSha: 'base' }),
      saveCheckpoint: (checkpoint) => { calls.push(`checkpoint:${checkpoint.checkpointNumber}`); },
    });

    const result = await service.execute({ taskId: 'task-1', title: 'Example', role: 'coder', instructions: 'do it',
      dataSensitivity: 'INTERNAL', availableLocalModels: ['model-1'], availableGatewayModels: [], createdBy: 'test' });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.correlationId.length > 0, true);
    assert.equal(result.executionId.length > 0, true);
    assert.deepStrictEqual(calls.map((call) => call.split(':')[0]), ['execute', 'checkpoint']);
    assert.equal(db.rawDb.prepare('SELECT status FROM tasks WHERE id = ?').get('task-1').status, 'DONE');
    assert.equal(db.rawDb.prepare('SELECT status FROM agent_executions WHERE id = ?').get(result.executionId).status, 'SUCCESS');
  });

  test('returns a policy rejection without invoking the adapter', async () => {
    let invoked = false;
    const service = new OrchestrationService({
      persistence, adapter: { executeTask: async () => { invoked = true; throw new Error('unexpected'); } } as AgentAdapter,
      selectRoute: () => { throw new Error('SECURITY VIOLATION: no local model'); },
      createWorktree: async () => { throw new Error('unexpected'); }, saveCheckpoint: () => {},
    });
    const result = await service.execute({ taskId: 'task-2', title: 'Secret', role: 'coder', instructions: 'secret',
      dataSensitivity: 'SECRET', availableLocalModels: [], availableGatewayModels: [], createdBy: 'test' });
    assert.equal(result.status, 'REJECTED');
    assert.equal(result.error.code, 'POLICY_REJECTED');
    assert.equal(invoked, false);
  });

  test('returns the same result for a duplicate idempotency key', async () => {
    let executions = 0;
    const adapter: AgentAdapter = {
      id: 'fake-agent', name: 'Fake', version: '1',
      isAvailable: async () => true, healthCheck: async () => ({ healthy: true, details: 'ok' }),
      executeTask: async (context) => { executions++; return { taskId: context.taskId, runId: context.runId, status: 'SUCCESS', exitCode: 0, modifiedFiles: [], stdout: '', stderr: '', sanitizedSummary: 'done', durationMs: 1 }; },
      abortTask: async () => {},
    };
    const service = new OrchestrationService({ persistence, adapter,
      selectRoute: () => ({ providerId: 'local', modelId: 'model-1', tier: 'TIER_0_LOCAL', reason: 'test' }),
      createWorktree: async () => ({ worktreePath: '/tmp/task-idem', branchName: 'task/task-idem', baseSha: 'base' }), saveCheckpoint: () => {},
    });
    const request = { taskId: 'task-idem', title: 'Idempotent', role: 'coder' as const, instructions: 'run', availableLocalModels: ['model-1'], availableGatewayModels: [], createdBy: 'test', idempotencyKey: 'key-1' };
    const first = await service.execute(request);
    const second = await service.execute(request);
    assert.deepStrictEqual(second, first);
    assert.equal(executions, 1);
  });

  test('cancels a running task safely and prevents checkpoint creation', async () => {
    let releaseExecution: (() => void) | undefined;
    let abortedRun = '';
    let checkpointed = false;
    const adapter: AgentAdapter = {
      id: 'fake-agent', name: 'Fake', version: '1',
      isAvailable: async () => true, healthCheck: async () => ({ healthy: true, details: 'ok' }),
      executeTask: async (context) => {
        await new Promise<void>((resolve) => { releaseExecution = resolve; });
        return { taskId: context.taskId, runId: context.runId, status: 'SUCCESS', exitCode: 0, modifiedFiles: [], stdout: '', stderr: '', sanitizedSummary: 'done', durationMs: 1 };
      },
      abortTask: async (runId) => { abortedRun = runId; releaseExecution?.(); },
    };
    const service = new OrchestrationService({ persistence, adapter,
      selectRoute: () => ({ providerId: 'local', modelId: 'model-1', tier: 'TIER_0_LOCAL', reason: 'test' }),
      createWorktree: async () => ({ worktreePath: '/tmp/task-cancel', branchName: 'task/task-cancel', baseSha: 'base' }),
      saveCheckpoint: () => { checkpointed = true; },
    });
    const execution = service.execute({ taskId: 'task-cancel', title: 'Cancel', role: 'coder', instructions: 'run', availableLocalModels: ['model-1'], availableGatewayModels: [], createdBy: 'test' });
    await new Promise((resolve) => setImmediate(resolve));
    const cancelled = await service.cancel('task-cancel');
    const result = await execution;
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(result.status, 'CANCELLED');
    assert.equal(abortedRun, result.executionId);
    assert.equal(checkpointed, false);
    assert.equal(db.rawDb.prepare('SELECT status FROM tasks WHERE id = ?').get('task-cancel').status, 'CANCELLED');
  });

  test('maps adapter timeout to TIMEOUT without a checkpoint', async () => {
    const service = new OrchestrationService({ persistence, adapter: { id: 'fake-agent', executeTask: async (context) => ({ taskId: context.taskId, runId: context.runId, status: 'TIMEOUT', exitCode: -1, modifiedFiles: [], stdout: '', stderr: 'timed out', sanitizedSummary: 'timeout', durationMs: 1 }) } as AgentAdapter,
      selectRoute: () => ({ providerId: 'local', modelId: 'model-1', tier: 'TIER_0_LOCAL', reason: 'test' }), createWorktree: async () => ({ worktreePath: '/tmp/task-timeout', branchName: 'task/task-timeout', baseSha: 'base' }), saveCheckpoint: () => { throw new Error('must not checkpoint'); },
    });
    const result = await service.execute({ taskId: 'task-timeout', title: 'Timeout', role: 'coder', instructions: 'run', availableLocalModels: ['model-1'], availableGatewayModels: [], createdBy: 'test' });
    assert.equal(result.status, 'TIMEOUT');
    assert.equal(result.error.code, 'TIMEOUT');
  });

  test('persists adapter failure and does not create a checkpoint', async () => {
    let checkpointed = false;
    const service = new OrchestrationService({
      persistence, adapter: { id: 'failing-agent', executeTask: async () => ({ taskId: 'task-3', runId: 'run', status: 'FAILED', exitCode: 1,
        modifiedFiles: [], stdout: '', stderr: 'failed', sanitizedSummary: 'failed', durationMs: 1 }) } as AgentAdapter,
      selectRoute: () => ({ providerId: 'local', modelId: 'model-1', tier: 'TIER_0_LOCAL', reason: 'test' }),
      createWorktree: async () => ({ worktreePath: '/tmp/task-3', branchName: 'task/task-3', baseSha: 'base' }),
      saveCheckpoint: () => { checkpointed = true; },
    });
    const result = await service.execute({ taskId: 'task-3', title: 'Fails', role: 'coder', instructions: 'fail',
      availableLocalModels: ['model-1'], availableGatewayModels: [], createdBy: 'test' });
    assert.equal(result.status, 'FAILED');
    assert.equal(result.error.code, 'ADAPTER_FAILED');
    assert.equal(checkpointed, false);
  });
});
