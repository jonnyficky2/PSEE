/**
 * PSEE Core Types & Interfaces
 * Normalized Contracts for Multi-Agent Orchestration & Provider Abstraction
 */

export type AgentRole =
  | 'planner'
  | 'architect'
  | 'researcher'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'docs';

export type TaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'CHECKPOINTED'
  | 'PAUSED'
  | 'FALLBACK_PENDING'
  | 'VALIDATING'
  | 'DONE'
  | 'FAILED'
  | 'INTERRUPTED'
  | 'RECOVERING'
  | 'NEEDS_USER'
  | 'CANCELLED';

export type ModelLifecycleState =
  | 'UNKNOWN'
  | 'CONNECTIVITY_VERIFIED'
  | 'QUALIFIED'
  | 'QUARANTINED'
  | 'DISABLED';

export interface TaskExecutionContext {
  taskId: string;
  runId: string;
  role: AgentRole;
  worktreePath: string; // Absolute path to .psee/worktrees/task-<id>/
  instructions: string;
  contextFiles: string[];
  timeoutMs: number;
  environmentVariables?: Record<string, string>;
  allowNetwork: boolean;
}

export interface TaskExecutionResult {
  taskId: string;
  runId: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'INTERRUPTED';
  exitCode: number;
  modifiedFiles: string[];
  stdout: string;
  stderr: string;
  sanitizedSummary: string;
  durationMs: number;
}

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<{ healthy: boolean; details: string }>;
  executeTask(context: TaskExecutionContext): Promise<TaskExecutionResult>;
  abortTask(runId: string): Promise<void>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface NormalizedRequest {
  requestId: string;
  taskId: string;
  modelId: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
}

export interface NormalizedResponse {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  latencyMs: number;
}

export interface ModelAdapter {
  readonly id: string;
  readonly type: 'local' | 'gateway' | 'direct';

  discoverModels(): Promise<string[]>;
  healthCheck(): Promise<boolean>;
  generate(request: NormalizedRequest): Promise<NormalizedResponse>;
}

export interface ProviderHealth {
  providerId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
  discoveredModelsCount: number;
  checkedAt: string;
}
