import type { CheckpointData, CheckpointEngine } from '../checkpoint/checkpoint.engine.js';
import type { AgentAdapter, AgentRole, TaskExecutionContext } from '../types/index.js';
import type { ExecutionPersistenceService } from '../persistence/execution.persistence.js';
import type { RouteSelection } from '../policy/policy.engine.js';

export type OrchestrationStatus = 'SUCCESS' | 'FAILED' | 'REJECTED' | 'TIMEOUT' | 'INTERRUPTED' | 'CANCELLED' | 'APPROVAL_REQUIRED';

export interface OrchestrationRequest {
  taskId: string;
  title: string;
  role: AgentRole;
  instructions: string;
  dataSensitivity?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
  availableLocalModels: string[];
  availableGatewayModels: string[];
  createdBy: string;
  timeoutMs?: number;
  worktreePath?: string;
  idempotencyKey?: string;
}

export interface OrchestrationResult {
  taskId: string;
  executionId: string;
  correlationId: string;
  status: OrchestrationStatus;
  error?: { code: string; message: string };
}

export interface OrchestrationDependencies {
  persistence: ExecutionPersistenceService;
  adapter: AgentAdapter;
  selectRoute: (request: Pick<OrchestrationRequest, 'taskId' | 'role' | 'dataSensitivity' | 'availableLocalModels' | 'availableGatewayModels'>) => RouteSelection;
  createWorktree: (taskId: string) => Promise<{ worktreePath: string; branchName: string; baseSha: string }>;
  saveCheckpoint: (data: CheckpointData) => void;
}

export class OrchestrationService {
  private readonly idempotentResults = new Map<string, OrchestrationResult>();
  private readonly activeRuns = new Map<string, { executionId: string; cancelled: boolean }>();

  constructor(private readonly deps: OrchestrationDependencies) {}

  async execute(request: OrchestrationRequest): Promise<OrchestrationResult> {
    if (request.idempotencyKey) {
      const existing = this.idempotentResults.get(request.idempotencyKey);
      if (existing) return existing;
    }
    const correlationId = `corr-${request.taskId}-${Date.now()}`;
    const executionId = `execution-${request.taskId}-${Date.now()}`;
    this.deps.persistence.createTask({
      id: request.taskId, title: request.title, status: 'QUEUED', priority: 0,
      workspaceRef: request.worktreePath ?? `.psee/worktrees/task-${request.taskId}`,
      createdBy: request.createdBy,
    });

    let route: RouteSelection;
    try {
      route = this.deps.selectRoute(request);
    } catch (error) {
      this.deps.persistence.updateTaskStatus(request.taskId, 'FAILED');
      const result = this.failure(request.taskId, executionId, correlationId, 'POLICY_REJECTED', error);
      if (request.idempotencyKey) this.idempotentResults.set(request.idempotencyKey, result);
      return result;
    }

    const worktree = await this.deps.createWorktree(request.taskId);
    this.deps.persistence.startExecution({
      id: executionId, taskId: request.taskId, agentId: this.deps.adapter.id,
      runNumber: 1, status: 'RUNNING', selectedModelId: route.modelId, correlationId,
    });
    this.deps.persistence.recordRoutingLog({
      id: `route-${executionId}`, executionId, modelId: route.modelId,
      policyVersion: 'free-first-v1', selectionReason: route.reason, status: 'SELECTED',
    });

    const run = { executionId, cancelled: false };
    this.activeRuns.set(request.taskId, run);
    const context: TaskExecutionContext = {
      taskId: request.taskId, runId: executionId, role: request.role,
      worktreePath: worktree.worktreePath, instructions: request.instructions,
      contextFiles: [], timeoutMs: request.timeoutMs ?? 120000, allowNetwork: route.tier !== 'TIER_0_LOCAL',
    };
    let execution;
    try {
      execution = await this.deps.adapter.executeTask(context);
    } catch (error) {
      this.activeRuns.delete(request.taskId);
      this.deps.persistence.updateExecutionStatus(executionId, 'FAILED', 'ADAPTER_EXCEPTION');
      this.deps.persistence.updateTaskStatus(request.taskId, 'FAILED');
      return this.failure(request.taskId, executionId, correlationId, 'ADAPTER_EXCEPTION', error);
    }
    this.activeRuns.delete(request.taskId);
    if (run.cancelled) {
      this.deps.persistence.updateExecutionStatus(executionId, 'INTERRUPTED', 'CANCELLED');
      this.deps.persistence.updateTaskStatus(request.taskId, 'CANCELLED');
      const result = this.failure(request.taskId, executionId, correlationId, 'CANCELLED', 'Task cancellation requested');
      if (request.idempotencyKey) this.idempotentResults.set(request.idempotencyKey, result);
      return result;
    }
    if (execution.status !== 'SUCCESS') {
      const code = execution.status === 'TIMEOUT' ? 'TIMEOUT' : execution.status === 'INTERRUPTED' ? 'INTERRUPTED' : 'ADAPTER_FAILED';
      this.deps.persistence.updateExecutionStatus(executionId, execution.status, code);
      this.deps.persistence.updateTaskStatus(request.taskId, execution.status === 'TIMEOUT' ? 'FAILED' : execution.status);
      const result = this.failure(request.taskId, executionId, correlationId, code, execution.stderr || execution.sanitizedSummary);
      if (request.idempotencyKey) this.idempotentResults.set(request.idempotencyKey, result);
      return result;
    }

    this.deps.persistence.updateExecutionStatus(executionId, 'SUCCESS');
    this.deps.persistence.updateTaskStatus(request.taskId, 'DONE');
    this.deps.saveCheckpoint({
      taskId: request.taskId, executionId, checkpointNumber: 1,
      workspaceRef: worktree.worktreePath, gitBranch: worktree.branchName,
      gitCommitSha: worktree.baseSha, completedSteps: ['execute'], pendingSteps: [],
      changedFiles: execution.modifiedFiles,
      testSummary: { status: 'not-run-by-orchestrator' },
    });
    const result = { taskId: request.taskId, executionId, correlationId, status: 'SUCCESS' as const };
    if (request.idempotencyKey) this.idempotentResults.set(request.idempotencyKey, result);
    return result;
  }

  getTask(taskId: string) { return this.deps.persistence.getTask(taskId); }

  async cancel(taskId: string): Promise<OrchestrationResult> {
    const run = this.activeRuns.get(taskId);
    if (!run) {
      const task = this.deps.persistence.getTask(taskId);
      if (!task) return { taskId, executionId: '', correlationId: `corr-${taskId}`, status: 'FAILED', error: { code: 'NOT_FOUND', message: 'Task not found' } };
      return { taskId, executionId: '', correlationId: `corr-${taskId}`, status: task.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED', error: { code: 'INVALID_STATE', message: `Task is not running: ${task.status}` } };
    }
    run.cancelled = true;
    await this.deps.adapter.abortTask(run.executionId);
    return { taskId, executionId: run.executionId, correlationId: `corr-${taskId}`, status: 'CANCELLED' };
  }

  private failure(taskId: string, executionId: string, correlationId: string, code: string, error: unknown): OrchestrationResult {
    const message = error instanceof Error ? error.message : String(error);
    const status = code === 'POLICY_REJECTED' ? 'REJECTED' : code === 'TIMEOUT' ? 'TIMEOUT' : code === 'INTERRUPTED' ? 'INTERRUPTED' : code === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    return { taskId, executionId, correlationId, status, error: { code, message } };
  }
}
