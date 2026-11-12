export const TASK_ROLES = ['planner', 'architect', 'researcher', 'coder', 'tester', 'reviewer', 'docs'] as const;
export const DATA_SENSITIVITIES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const;
export type TaskRole = typeof TASK_ROLES[number];
export type DataSensitivity = typeof DATA_SENSITIVITIES[number];
export type TaskStatus = 'QUEUED' | 'RUNNING' | 'CHECKPOINTED' | 'DONE' | 'FAILED' | 'TIMEOUT' | 'INTERRUPTED' | 'CANCELLED' | 'RECOVERING' | 'NEEDS_USER' | 'APPROVAL_REQUIRED' | 'REJECTED';
export interface CreateTaskRequest { taskId: string; title: string; role: TaskRole; instructions: string; dataSensitivity?: DataSensitivity; }
export interface TaskResponse { taskId: string; executionId?: string; correlationId: string; status: TaskStatus; error?: { code: string; message: string; correlationId?: string }; }
export interface ErrorResponse { error: { code: string; message: string; correlationId?: string }; correlationId: string; }
