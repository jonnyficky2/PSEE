import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { PseeDatabase } from '../src/db/database.js';
import { CheckpointEngine } from '../src/checkpoint/checkpoint.engine.js';

describe('Checkpoint engine failure paths and edge cases', () => {
  let db: PseeDatabase;
  let cpEngine: CheckpointEngine;
  const dbPath = '.psee/checkpoint-test.sqlite';

  beforeEach(() => {
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
    db = new PseeDatabase({ dbPath });
    cpEngine = new CheckpointEngine(db);

    db.rawDb.prepare(`
      INSERT INTO tasks (id, title, status, workspace_ref, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('task-cp-1', 'CP Task', 'RUNNING', '.psee/worktrees/task-cp-1', 'test');
  });

  afterEach(() => {
    db.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  });

  test('returns null when requesting checkpoint for a missing task', () => {
    const cp = cpEngine.getLatestCheckpoint('non-existent-task');
    assert.equal(cp, null);
  });

  test('replaces existing checkpoint on conflict for same task and checkpoint number', () => {
    cpEngine.saveCheckpoint({
      taskId: 'task-cp-1',
      checkpointNumber: 1,
      workspaceRef: '.psee/worktrees/task-cp-1',
      gitBranch: 'task/cp-1',
      gitCommitSha: 'sha-initial',
      completedSteps: ['step-1'],
    });

    let latest = cpEngine.getLatestCheckpoint('task-cp-1');
    assert.equal(latest?.gitCommitSha, 'sha-initial');
    assert.deepStrictEqual(latest?.completedSteps, ['step-1']);

    // Overwrite checkpoint 1
    cpEngine.saveCheckpoint({
      taskId: 'task-cp-1',
      checkpointNumber: 1,
      workspaceRef: '.psee/worktrees/task-cp-1',
      gitBranch: 'task/cp-1',
      gitCommitSha: 'sha-updated',
      completedSteps: ['step-1', 'step-2'],
      dirtyWorktreeSummary: 'modified src/index.ts',
    });

    latest = cpEngine.getLatestCheckpoint('task-cp-1');
    assert.equal(latest?.gitCommitSha, 'sha-updated');
    assert.deepStrictEqual(latest?.completedSteps, ['step-1', 'step-2']);
    assert.equal(latest?.dirtyWorktreeSummary, 'modified src/index.ts');
  });

  test('handles malformed serialized JSON data in checkpoint retrieval', () => {
    // Insert malformed JSON directly into database row
    db.rawDb.prepare(`
      INSERT INTO task_checkpoints (
        id, task_id, checkpoint_number, workspace_ref, git_branch, git_commit_sha, completed_steps
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('cp-malformed', 'task-cp-1', 2, '.psee/worktrees', 'branch', 'sha', 'NOT-VALID-JSON');

    assert.throws(() => {
      cpEngine.getLatestCheckpoint('task-cp-1');
    }, /SyntaxError/);
  });
});
