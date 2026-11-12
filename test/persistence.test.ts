import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { PseeDatabase } from '../src/db/database.js';
import { ExecutionPersistenceService } from '../src/persistence/execution.persistence.js';

describe('Execution persistence service', () => {
  let db: PseeDatabase;
  let persistence: ExecutionPersistenceService;
  const dbPath = '.psee/persistence-test.sqlite';

  beforeEach(() => {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    db = new PseeDatabase({ dbPath });
    persistence = new ExecutionPersistenceService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  });

  test('creates and reads a task without persisting secrets', () => {
    persistence.createTask({
      id: 'task-1', title: 'Run task', status: 'QUEUED', priority: 2,
      workspaceRef: '.psee/worktrees/task-1', createdBy: 'operator',
    });

    assert.deepStrictEqual(persistence.getTask('task-1'), {
      id: 'task-1', title: 'Run task', status: 'QUEUED', priority: 2,
      workspaceRef: '.psee/worktrees/task-1', createdBy: 'operator',
    });
    const columns = db.rawDb.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
    assert.ok(!columns.some((column) => column.name.toLowerCase().includes('secret')));
  });

  test('records execution, routing, usage, and audit lifecycle', () => {
    persistence.createTask({
      id: 'task-1', title: 'Run task', status: 'QUEUED', priority: 0,
      workspaceRef: '.psee/worktrees/task-1', createdBy: 'operator',
    });
    db.rawDb.prepare(`INSERT INTO agent_definitions (id, agent_key, display_name, role_description, default_task_class, permission_profile) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('agent-1', 'coder', 'Coder', 'Writes code', 'implementation', 'standard');
    db.rawDb.prepare(`INSERT INTO ai_providers (id, provider_key, display_name, provider_type, status) VALUES (?, ?, ?, ?, ?)`)
      .run('provider-1', 'test', 'Test Provider', 'local', 'ACTIVE');
    db.rawDb.prepare(`INSERT INTO ai_models (id, provider_id, model_key, display_name, status, source) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('model-1', 'provider-1', 'test-model', 'Test Model', 'QUALIFIED', 'verified');
    persistence.startExecution({
      id: 'execution-1', taskId: 'task-1', agentId: 'agent-1', runNumber: 1,
      status: 'RUNNING', modelId: 'model-1', correlationId: 'corr-1',
    });
    persistence.recordRoutingLog({
      id: 'route-1', executionId: 'execution-1', modelId: 'model-1',
      policyVersion: 'v1', selectionReason: 'free-first', status: 'SELECTED',
    });
    persistence.recordUsage({
      id: 'usage-1', executionId: 'execution-1', providerId: 'provider-1',
      modelId: 'model-1', inputTokens: 10, outputTokens: 20,
      totalTokens: 30, estimatedCost: 0, measurementSource: 'test',
    });
    persistence.recordAuditEvent({
      id: 'audit-1', actorRef: 'operator', action: 'task.started',
      targetType: 'task', targetId: 'task-1', correlationId: 'corr-1',
      metadata: { source: 'test' },
    });

    assert.equal(db.rawDb.prepare('SELECT COUNT(*) AS count FROM agent_executions').get().count, 1);
    assert.equal(db.rawDb.prepare('SELECT COUNT(*) AS count FROM routing_logs').get().count, 1);
    assert.equal(db.rawDb.prepare('SELECT COUNT(*) AS count FROM usage_records').get().count, 1);
    const audit = db.rawDb.prepare('SELECT sanitized_metadata FROM audit_events WHERE id = ?').get('audit-1') as { sanitized_metadata: string };
    assert.deepStrictEqual(JSON.parse(audit.sanitized_metadata), { source: 'test' });
  });

  test('rejects execution references to missing tasks', () => {
    assert.throws(() => persistence.startExecution({
      id: 'execution-1', taskId: 'missing', agentId: 'agent-1', runNumber: 1,
      status: 'RUNNING', correlationId: 'corr-1',
    }), /FOREIGN KEY|constraint/i);
  });
});
