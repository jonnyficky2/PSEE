import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  worktreePath: string;
  branchName: string;
  baseSha: string;
}

export interface WorktreeManagerOptions {
  repoRoot?: string;
  worktreeRoot?: string;
}

export class GitWorktreeManager {
  private readonly repoRoot: string;
  private readonly worktreeRoot: string;

  constructor(options: WorktreeManagerOptions = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
    this.worktreeRoot = options.worktreeRoot || join(this.repoRoot, '.psee', 'worktrees');

    if (!existsSync(this.worktreeRoot)) {
      mkdirSync(this.worktreeRoot, { recursive: true });
    }
  }

  private async git(args: string[], cwd: string = this.repoRoot): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, { cwd });
  }

  async getHeadSha(cwd: string = this.repoRoot): Promise<string> {
    const { stdout } = await this.git(['rev-parse', 'HEAD'], cwd);
    return stdout.trim();
  }

  async createWorktree(taskId: string, baseBranch: string = 'main'): Promise<WorktreeInfo> {
    const sanitizedTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const branchName = `task/${sanitizedTaskId}`;
    const worktreePath = resolve(this.worktreeRoot, `task-${sanitizedTaskId}`);

    const baseSha = await this.getHeadSha();

    // Check if branch already exists; if so, create worktree referencing it, or create branch -b
    try {
      await this.git(['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
      // Branch exists, checkout without -b
      await this.git(['worktree', 'add', worktreePath, branchName]);
    } catch {
      // Branch does not exist, create it with -b
      await this.git(['worktree', 'add', '-b', branchName, worktreePath, baseBranch]);
    }

    return {
      worktreePath,
      branchName,
      baseSha,
    };
  }

  async getWorktreeDiff(worktreePath: string): Promise<string> {
    try {
      const { stdout } = await this.git(['diff', 'HEAD'], worktreePath);
      return stdout;
    } catch {
      return '';
    }
  }

  async commitWorktree(worktreePath: string, message: string): Promise<string> {
    await this.git(['add', '-A'], worktreePath);
    await this.git(['commit', '-m', message], worktreePath);
    return this.getHeadSha(worktreePath);
  }

  async removeWorktree(taskId: string, force: boolean = false): Promise<void> {
    const sanitizedTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const worktreePath = resolve(this.worktreeRoot, `task-${sanitizedTaskId}`);

    if (existsSync(worktreePath)) {
      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(worktreePath);

      await this.git(args);
    }
  }

  async listWorktrees(): Promise<Array<{ path: string; branch: string; commit: string }>> {
    const { stdout } = await this.git(['worktree', 'list', '--porcelain']);
    const lines = stdout.split('\n');
    const worktrees: Array<{ path: string; branch: string; commit: string }> = [];

    let currentPath = '';
    let currentCommit = '';
    let currentBranch = '';

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.replace('worktree ', '').trim();
      } else if (line.startsWith('HEAD ')) {
        currentCommit = line.replace('HEAD ', '').trim();
      } else if (line.startsWith('branch ')) {
        currentBranch = line.replace('branch refs/heads/', '').trim();
      } else if (line === '') {
        if (currentPath) {
          worktrees.push({
            path: currentPath,
            branch: currentBranch,
            commit: currentCommit,
          });
          currentPath = '';
          currentCommit = '';
          currentBranch = '';
        }
      }
    }

    return worktrees;
  }
}
