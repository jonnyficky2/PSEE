import type { PseeDatabase } from '../db/database.js';

export interface CheckpointData {
  taskId: string;
  executionId?: string | null;
  checkpointNumber: number;
  workspaceRef: string;
  gitBranch: string;
  gitCommitSha: string;
  dirtyWorktreeSummary?: string | null;
  completedSteps?: string[];
  pendingSteps?: string[];
  changedFiles?: string[];
  testSummary?: Record<string, unknown>;
  artifactRefs?: string[];
}

export class CheckpointEngine {
  constructor(private readonly pseeDb: PseeDatabase) {}

  saveCheckpoint(data: CheckpointData): void {
    const db = this.pseeDb.rawDb;
    const id = `cp-${data.taskId}-${data.checkpointNumber}-${Date.now()}`;

    const stmt = db.prepare(`
      INSERT INTO task_checkpoints (
        id, task_id, execution_id, checkpoint_number, workspace_ref,
        git_branch, git_commit_sha, dirty_worktree_summary, completed_steps,
        pending_steps, changed_files, test_summary, artifact_refs, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(task_id, checkpoint_number) DO UPDATE SET
        execution_id = excluded.execution_id,
        workspace_ref = excluded.workspace_ref,
        git_branch = excluded.git_branch,
        git_commit_sha = excluded.git_commit_sha,
        dirty_worktree_summary = excluded.dirty_worktree_summary,
        completed_steps = excluded.completed_steps,
        pending_steps = excluded.pending_steps,
        changed_files = excluded.changed_files,
        test_summary = excluded.test_summary,
        artifact_refs = excluded.artifact_refs,
        created_at = datetime('now')
    `);

    stmt.run(
      id,
      data.taskId,
      data.executionId ?? null,
      data.checkpointNumber,
      data.workspaceRef,
      data.gitBranch,
      data.gitCommitSha,
      data.dirtyWorktreeSummary ?? null,
      data.completedSteps ? JSON.stringify(data.completedSteps) : null,
      data.pendingSteps ? JSON.stringify(data.pendingSteps) : null,
      data.changedFiles ? JSON.stringify(data.changedFiles) : null,
      data.testSummary ? JSON.stringify(data.testSummary) : null,
      data.artifactRefs ? JSON.stringify(data.artifactRefs) : null
    );
  }

  getLatestCheckpoint(taskId: string): CheckpointData | null {
    const db = this.pseeDb.rawDb;
    const stmt = db.prepare(`
      SELECT task_id as taskId, execution_id as executionId, checkpoint_number as checkpointNumber,
             workspace_ref as workspaceRef, git_branch as gitBranch, git_commit_sha as gitCommitSha,
             dirty_worktree_summary as dirtyWorktreeSummary, completed_steps as completedSteps,
             pending_steps as pendingSteps, changed_files as changedFiles, test_summary as testSummary,
             artifact_refs as artifactRefs
      FROM task_checkpoints
      WHERE task_id = ?
      ORDER BY checkpoint_number DESC
      LIMIT 1
    `);

    const row = stmt.get(taskId) as {
      taskId: string;
      executionId: string | null;
      checkpointNumber: number;
      workspaceRef: string;
      gitBranch: string;
      gitCommitSha: string;
      dirtyWorktreeSummary: string | null;
      completedSteps: string | null;
      pendingSteps: string | null;
      changedFiles: string | null;
      testSummary: string | null;
      artifactRefs: string | null;
    } | undefined;

    if (!row) return null;

    return {
      taskId: row.taskId,
      executionId: row.executionId,
      checkpointNumber: row.checkpointNumber,
      workspaceRef: row.workspaceRef,
      gitBranch: row.gitBranch,
      gitCommitSha: row.gitCommitSha,
      dirtyWorktreeSummary: row.dirtyWorktreeSummary,
      completedSteps: row.completedSteps ? JSON.parse(row.completedSteps) : undefined,
      pendingSteps: row.pendingSteps ? JSON.parse(row.pendingSteps) : undefined,
      changedFiles: row.changedFiles ? JSON.parse(row.changedFiles) : undefined,
      testSummary: row.testSummary ? JSON.parse(row.testSummary) : undefined,
      artifactRefs: row.artifactRefs ? JSON.parse(row.artifactRefs) : undefined,
    };
  }
}
