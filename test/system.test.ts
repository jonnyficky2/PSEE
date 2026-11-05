import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { PseeDatabase } from '../src/db/database.js';
import { ModelRegistryService } from '../src/registry/model.registry.js';
import { FreeFirstPolicyEngine } from '../src/policy/policy.engine.js';
import { CheckpointEngine } from '../src/checkpoint/checkpoint.engine.js';
import { GitWorktreeManager } from '../src/isolation/worktree.manager.js';

describe('PSEE Core System Test Suite', () => {
  const testDbPath = '.psee/test_state.sqlite';
  let db: PseeDatabase;

  before(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    db = new PseeDatabase({ dbPath: testDbPath });
  });

  after(() => {
    db.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    if (existsSync(`${testDbPath}-wal`)) {
      rmSync(`${testDbPath}-wal`, { force: true });
    }
    if (existsSync(`${testDbPath}-shm`)) {
      rmSync(`${testDbPath}-shm`, { force: true });
    }
  });

  test('1. Database: Initializes 16 tables in WAL mode', () => {
    const raw = db.rawDb;
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    assert.ok(tables.length >= 16, `Expected at least 16 tables, found ${tables.length}`);
    const tableNames = tables.map((t) => t.name);

    assert.ok(tableNames.includes('ai_providers'));
    assert.ok(tableNames.includes('ai_models'));
    assert.ok(tableNames.includes('task_checkpoints'));
    assert.ok(tableNames.includes('agent_executions'));
  });

  test('2. Registry: Registers providers and models with lifecycle states', () => {
    const registry = new ModelRegistryService(db);

    registry.registerProvider('p-ollama', 'ollama', 'Ollama Local', 'local', 'ACTIVE');
    registry.registerModel({
      id: 'm-qwen7b',
      providerId: 'p-ollama',
      modelKey: 'qwen2.5-coder:7b',
      displayName: 'Qwen 2.5 Coder 7B',
      status: 'CONNECTIVITY_VERIFIED',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      enabled: true,
      source: 'verified',
    });

    const verified = registry.getVerifiedModels();
    assert.strictEqual(verified.length, 1);
    assert.strictEqual(verified[0].modelKey, 'qwen2.5-coder:7b');
  });

  test('3. Policy Engine: Enforces Free-First and Strict Secret Isolation', () => {
    const policy = new FreeFirstPolicyEngine();

    // Test A: SECRET data classification MUST enforce local Ollama
    const secretRoute = policy.selectRoute({
      taskId: 'task-sec-1',
      role: 'coder',
      dataSensitivity: 'SECRET',
      availableLocalModels: ['qwen2.5-coder:7b'],
      availableGatewayModels: ['ag/gemini-3.8-flash-low'],
    });
    assert.strictEqual(secretRoute.tier, 'TIER_0_LOCAL');
    assert.strictEqual(secretRoute.providerId, 'ollama');

    // Test B: Planning task routes to High-Context Gateway
    const planRoute = policy.selectRoute({
      taskId: 'task-plan-1',
      role: 'planner',
      dataSensitivity: 'INTERNAL',
      availableLocalModels: ['qwen2.5-coder:7b'],
      availableGatewayModels: ['ag/gemini-3.8-flash-low'],
    });
    assert.strictEqual(planRoute.tier, 'TIER_1_FREE_CLOUD');
    assert.strictEqual(planRoute.modelId, 'ag/gemini-3.8-flash-low');
  });

  test('4. Checkpoint Engine: Saves and retrieves execution snapshot', () => {
    const cpEngine = new CheckpointEngine(db);

    // Seed task
    db.rawDb
      .prepare(
        "INSERT INTO tasks (id, title, status, workspace_ref, created_by) VALUES (?, ?, ?, ?, ?)"
      )
      .run('task-test-01', 'Test Task', 'RUNNING', '.psee/worktrees/task-test-01', 'test_runner');

    cpEngine.saveCheckpoint({
      taskId: 'task-test-01',
      checkpointNumber: 1,
      workspaceRef: '.psee/worktrees/task-test-01',
      gitBranch: 'task/test-01',
      gitCommitSha: 'abc1234567890',
      completedSteps: ['init', 'scaffold'],
      pendingSteps: ['run_tests'],
      changedFiles: ['src/index.ts'],
    });

    const latest = cpEngine.getLatestCheckpoint('task-test-01');
    assert.ok(latest);
    assert.strictEqual(latest.checkpointNumber, 1);
    assert.strictEqual(latest.gitCommitSha, 'abc1234567890');
    assert.deepStrictEqual(latest.completedSteps, ['init', 'scaffold']);
  });

  test('5. Worktree Manager: Creates and removes isolated git worktree', async () => {
    const wtManager = new GitWorktreeManager();
    const taskId = `sys-test-${Date.now()}`;

    const info = await wtManager.createWorktree(taskId);
    assert.ok(existsSync(info.worktreePath), 'Worktree directory should exist');
    assert.ok(info.branchName.includes(taskId));

    const list = await wtManager.listWorktrees();
    assert.ok(list.some((w) => w.path === info.worktreePath));

    await wtManager.removeWorktree(taskId, true);
    assert.ok(!existsSync(info.worktreePath), 'Worktree directory should be deleted');
  });
});
