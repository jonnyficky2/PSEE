import { spawn, type ChildProcess } from 'node:child_process';
import type {
  AgentAdapter,
  TaskExecutionContext,
  TaskExecutionResult,
} from '../types/index.js';
import { sanitize } from '../types/adapter-errors.js';

export interface OpenCodeAdapterOptions {
  binaryPath?: string;
  defaultModel?: string;
}

export class OpenCodeBridgeAdapter implements AgentAdapter {
  readonly id = 'opencode';
  readonly name = 'OpenCode CLI Bridge Adapter';
  readonly version = '2.2.5';

  private readonly binaryPath: string;
  private readonly defaultModel: string;
  private readonly activeProcesses = new Map<string, ChildProcess>();
  private readonly abortHandlers = new Map<string, () => void>();

  constructor(options: OpenCodeAdapterOptions = {}) {
    this.binaryPath = options.binaryPath || 'opencode';
    this.defaultModel = options.defaultModel || '9router/ag/gemini-3.8-flash-low';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const child = spawn(this.binaryPath, ['--version']);
      return new Promise<boolean>((resolve) => {
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
      });
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details: string }> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          healthy: false,
          details: `Binary '${this.binaryPath}' not found or returned non-zero exit code`,
        };
      }
      return {
        healthy: true,
        details: `Binary '${this.binaryPath}' is available and responding`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { healthy: false, details: msg };
    }
  }

  async executeTask(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    let escalating = false;
    let escalationTimer: ReturnType<typeof setTimeout> | undefined;

    const args = [
      'run',
      '--standalone',
      '--model',
      this.defaultModel,
      context.instructions,
    ];

    return new Promise<TaskExecutionResult>((resolve) => {
      const env = {
        ...process.env,
        ...(context.environmentVariables || {}),
      };

      const child = spawn(this.binaryPath, args, {
        cwd: context.worktreePath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.activeProcesses.set(context.runId, child);

      // Shared cleanup: clears all timers, removes from activeProcesses, resolves once.
      const settle = (result: TaskExecutionResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (escalationTimer !== undefined) clearTimeout(escalationTimer);
        this.activeProcesses.delete(context.runId);
        this.abortHandlers.delete(context.runId);
        resolve(result);
      };

      // Start escalation: SIGTERM now, SIGKILL after 3s grace. Guarded so that
      // timeout and abort races start at most one escalation timer.
      const startEscalation = (): void => {
        if (escalating) return;
        escalating = true;
        child.kill('SIGTERM');
        escalationTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, 3000);
      };
      this.abortHandlers.set(context.runId, startEscalation);

      const timeout = setTimeout(() => {
        startEscalation();
      }, context.timeoutMs || 120000);

      child.stdout?.on('data', (data) => {
        stdoutBuffer += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderrBuffer += data.toString();
      });

      child.on('error', (err) => {
        const sanitizedErr = sanitize(err.message);
        settle({
          taskId: context.taskId,
          runId: context.runId,
          status: 'FAILED',
          exitCode: -1,
          modifiedFiles: [],
          stdout: sanitize(stdoutBuffer),
          stderr: sanitize(`${stderrBuffer}\nProcess spawn error: ${sanitizedErr}`),
          sanitizedSummary: sanitize(`Execution failed: ${sanitizedErr}`),
          durationMs: Date.now() - startTime,
        });
      });

      child.on('close', (code, signal) => {
        const durationMs = Date.now() - startTime;
        let status: TaskExecutionResult['status'] = 'SUCCESS';

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          status = 'TIMEOUT';
        } else if (code !== 0) {
          status = 'FAILED';
        }

        // Basic detection of changed files from output
        const modifiedFiles: string[] = [];
        const fileMatches = stdoutBuffer.match(/(?:wrote|updated|created|modified)\s+([^\s\n]+)/gi);
        if (fileMatches) {
          for (const match of fileMatches) {
            const parts = match.split(/\s+/);
            if (parts[1]) modifiedFiles.push(parts[1]);
          }
        }

        settle({
          taskId: context.taskId,
          runId: context.runId,
          status,
          exitCode: code ?? (signal ? 137 : 1),
          modifiedFiles: [...new Set(modifiedFiles)],
          stdout: sanitize(stdoutBuffer),
          stderr: sanitize(stderrBuffer),
          sanitizedSummary: sanitize(`Task ${context.taskId} completed with status ${status} in ${durationMs}ms`),
          durationMs,
        });
      });
    });
  }

  async abortTask(runId: string): Promise<void> {
    // Do not delete from activeProcesses here — the close/error handler settles
    // the promise. Trigger the same guarded escalation path used by the timeout.
    const startEscalation = this.abortHandlers.get(runId);
    if (startEscalation) startEscalation();
  }
}
